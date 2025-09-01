
export function calculateTimestamps(
    positionSec: number | null,
    durationSec: number | null
): { startTime?: number; endTime?: number } {
    // Validate required inputs
    if (positionSec == null || positionSec < 0) {
        return {};
    }

    const currentUnixTimeSec = Math.floor(Date.now() / 1000);

    // Calculate start time (when the track started playing)
    const startTime = currentUnixTimeSec - Math.round(positionSec);

    // Calculate end time if we have valid duration and haven't reached the end
    let endTime: number | undefined;
    if (durationSec != null && durationSec > 0 && positionSec < durationSec) {
        const remainingSeconds = durationSec - positionSec;
        endTime = currentUnixTimeSec + Math.round(remainingSeconds);
    }

    return { startTime, endTime };
}