//MusicKit has been very unreliable when sending events.
//This is why the code seems hacky/not clean :(
(function () {
    console.log("[INJECTED] Script is running in the main world.");

    interface MusicKitInstance {
        nowPlayingItem?: any;
        currentPlaybackTime?: number;
        isPlaying?: boolean;
        addEventListener(event: string, handler: (event?: any) => void): void;
    }

    // State tracking to prevent duplicate events
    const state = {
        lastPosition: 0,
        musicKit: null as MusicKitInstance | null,
        currentTrackId: null as string | null,
        currentIsPlaying: false,
        lastSeekAt: 0,
        lastTrackChangeAt: 0
    };

    function extractMusicKitData(nowPlayingItem?: any) {
        const item = nowPlayingItem || state.musicKit?.nowPlayingItem;

        const attrs = item?.attributes || undefined;
        const title = attrs?.name ?? null;
        const artist = attrs?.artistName ?? null;
        const album = attrs?.albumName ?? null;

        const artworkTemplate = attrs?.artwork?.url as string | undefined;
        const artworkUrl = artworkTemplate
            ? artworkTemplate.replace('{w}', '300').replace('{h}', '300')
            : null;

        const durationMillis = typeof attrs?.durationInMillis === 'number' ? attrs!.durationInMillis : null;
        const durationSec = durationMillis != null ? Math.round(durationMillis / 1000) : null;
        const positionSec = typeof state.musicKit?.currentPlaybackTime === 'number' ? state.musicKit!.currentPlaybackTime : null;

        return {
            title,
            artist,
            album,
            artworkUrl,
            durationSec,
            positionSec,
            isPlaying: !!(state.musicKit?.isPlaying),
            url: window.location.href
        };
    }

    function sendDataToContentScript(data?: any, source?: string) {
        const musicData = data || extractMusicKitData();
        const hasMeta = !!(musicData.title && musicData.artist);
        const isPlaying = !!musicData.isPlaying;

        if (!hasMeta) return;

        const trackId = musicData.title + '|' + musicData.artist;
        const trackChanged = trackId !== state.currentTrackId;
        const playStateChanged = isPlaying !== state.currentIsPlaying;

        if (trackChanged) {
            state.currentTrackId = trackId;
            state.currentIsPlaying = isPlaying;
            window.dispatchEvent(new CustomEvent('MusicKitDataEvent', { detail: musicData }));
            return;
        }

        if (source === 'scrubbing') {
            window.dispatchEvent(new CustomEvent('MusicKitDataEvent', { detail: musicData }));
            return;
        }

        if (playStateChanged) {
            if (!isPlaying) {
                const now = Date.now();
                const recentTrackChange = now - state.lastTrackChangeAt < 2000;
                const recentSeek = now - state.lastSeekAt < 1000;
                if (recentTrackChange || recentSeek) return;
            }

            state.currentIsPlaying = isPlaying;
            window.dispatchEvent(new CustomEvent('MusicKitDataEvent', { detail: musicData }));
        }
    }

    function handlePlaybackTimeChange() {
        const currentPosition = state.musicKit?.currentPlaybackTime || 0;
        const positionDifference = Math.abs(currentPosition - state.lastPosition);

        // Only send update for significant position jumps (manual scrubbing)
        if (positionDifference > 1) {
            state.lastSeekAt = Date.now();
            const data = extractMusicKitData();
            data.positionSec = currentPosition;
            // Force NOW PLAYING on scrubbing (MusicKit may send pause if position not loaded)
            data.isPlaying = true;
            sendDataToContentScript(data, 'scrubbing');
        }

        state.lastPosition = currentPosition;
    }

    function handleTrackChange() {
        state.lastTrackChangeAt = Date.now();
        const data = extractMusicKitData();
        // Force NOW PLAYING on track change
        data.isPlaying = true;
        sendDataToContentScript(data, 'trackChange');
    }

    function handlePlaybackStateChange(event?: any) {
        const mk: any = (window as any).MusicKit;
        const states = mk?.PlaybackStates || {};
        const eventData = event || {};
        const newState = eventData.state;

        if (newState === states.playing) {
            const data = extractMusicKitData();
            data.isPlaying = true;
            sendDataToContentScript(data, 'playbackState');
            return;
        }

        if (newState === states.paused || newState === states.stopped) {
            const data = extractMusicKitData();
            data.isPlaying = false;
            sendDataToContentScript(data, 'playbackState');
            return;
        }

        // Ignore transitional states (loading, waiting, stalled, seeking, ended)
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

            state.lastPosition = state.musicKit?.currentPlaybackTime || 0;

            const initialData = extractMusicKitData();
            if (initialData.isPlaying) {
                sendDataToContentScript(initialData, 'init');
            }

        } catch (error) {
            console.log("[INJECTED] Error setting up MusicKit listeners:", error);
            setTimeout(setupMusicKitListeners, 2000);
        }
    }

    // Wait for MusicKit to be available and set up listeners
    if ((window as any).MusicKit) {
        setupMusicKitListeners();
    } else {
        // Wait for MusicKit to load
        const checkForMusicKit = setInterval(() => {
            if ((window as any).MusicKit) {
                clearInterval(checkForMusicKit);
                setupMusicKitListeners();
            }
        }, 500);
    }
})();