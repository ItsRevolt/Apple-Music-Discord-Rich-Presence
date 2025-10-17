(function () {
    console.log("[INJECTED] Script is running in the main world.");

    interface MusicKitInstance {
        nowPlayingItem?: any;
        currentPlaybackTime?: number;
        isPlaying?: boolean;
        addEventListener(event: string, handler: (event?: any) => void): void;
    }

    const state = {
        lastPosition: 0,
        musicKit: null as MusicKitInstance | null,
        currentTrackId: null as string | null,
        currentIsPlaying: false,
        pendingUpdate: null as number | null
    };

    function extractMusicKitData() {
        const item = state.musicKit?.nowPlayingItem;
        const attrs = item?.attributes;

        const artworkTemplate = attrs?.artwork?.url as string | undefined;
        const artworkUrl = artworkTemplate?.replace('{w}', '300').replace('{h}', '300') ?? null;

        const durationMillis = attrs?.durationInMillis;
        const durationSec = typeof durationMillis === 'number' ? Math.round(durationMillis / 1000) : null;

        return {
            title: attrs?.name ?? null,
            artist: attrs?.artistName ?? null,
            album: attrs?.albumName ?? null,
            artworkUrl,
            durationSec,
            positionSec: state.musicKit?.currentPlaybackTime ?? null,
            isPlaying: state.musicKit?.isPlaying ?? false,
            url: window.location.href
        };
    }

    function emitUpdate(musicData: any) {
        const trackId = `${musicData.title}|${musicData.artist}`;
        const trackChanged = trackId !== state.currentTrackId;
        const playStateChanged = musicData.isPlaying !== state.currentIsPlaying;

        if (trackChanged || playStateChanged) {
            state.currentTrackId = trackId;
            state.currentIsPlaying = musicData.isPlaying;
            window.dispatchEvent(new CustomEvent('MusicKitDataEvent', { detail: musicData }));
        }
    }

    function scheduleUpdate(immediate = false) {
        if (state.pendingUpdate) {
            clearTimeout(state.pendingUpdate);
            state.pendingUpdate = null;
        }

        const musicData = extractMusicKitData();
        if (!musicData.title || !musicData.artist) return;

        if (immediate) {
            emitUpdate(musicData);
        } else {
            state.pendingUpdate = setTimeout(() => {
                state.pendingUpdate = null;
                emitUpdate(musicData);
            }, 100);
        }
    }

    function handlePlaybackTimeChange() {
        const currentPosition = state.musicKit?.currentPlaybackTime || 0;
        const positionDifference = Math.abs(currentPosition - state.lastPosition);

        // Only send update for significant position jumps (manual scrubbing)
        if (positionDifference > 1) {
            const data = extractMusicKitData();
            data.positionSec = currentPosition;
            data.isPlaying = true; // Force playing state on scrubbing
            emitUpdate(data);
        }

        state.lastPosition = currentPosition;
    }

    function handleTrackChange() {
        scheduleUpdate();
    }

    function handlePlaybackStateChange(event: any) {
        const states = (window as any).MusicKit?.PlaybackStates;
        if (!states) return;

        const newState = event?.state;

        // Only handle meaningful states, ignore transitional ones
        if (newState === states.playing || newState === states.paused || newState === states.stopped) {
            scheduleUpdate();
        }
    }

    function setupMusicKitListeners() {
        try {
            state.musicKit = (window as any).MusicKit?.getInstance?.();
            if (!state.musicKit) {
                setTimeout(setupMusicKitListeners, 1000);
                return;
            }

            console.log("[INJECTED] Setting up MusicKit event listeners");
            state.musicKit.addEventListener('nowPlayingItemDidChange', handleTrackChange);
            state.musicKit.addEventListener('playbackStateDidChange', handlePlaybackStateChange);
            state.musicKit.addEventListener('playbackTimeDidChange', handlePlaybackTimeChange);

            state.lastPosition = state.musicKit.currentPlaybackTime || 0;
            scheduleUpdate(true);
        } catch (error) {
            console.log("[INJECTED] Error setting up MusicKit listeners:", error);
            setTimeout(setupMusicKitListeners, 2000);
        }
    }

    if ((window as any).MusicKit) {
        setupMusicKitListeners();
    } else {
        const checkForMusicKit = setInterval(() => {
            if ((window as any).MusicKit) {
                clearInterval(checkForMusicKit);
                setupMusicKitListeners();
            }
        }, 500);
    }
})();