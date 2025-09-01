/**
 * Internal data structure for current playback state information.
 * Used for data flow between injected script, content script, and background script.
 */
export interface PlaybackStatePayload {
  title: string | null;
  artist: string | null;
  album: string | null;
  artworkUrl: string | null;
  durationSec: number | null;
  positionSec: number | null;
  isPlaying: boolean;
  url: string | null;
}

/**
 * Message structure for communication between content script and background script.
 * Uses Chrome extension runtime messaging API.
 */
export interface RuntimeMessage {
  type: "NOW_PLAYING_DATA";
  payload: PlaybackStatePayload;
}

/**
 * WebSocket message for sending track information to the daemon.
 * Sent when a track is playing, changed, or position is scrubbed.
 */
export interface PlayingMessage {
  type: "PLAYING";
  state: string; // Artist name
  details: string; // Track title
  large_image: string | null; // Artwork URL
  start_time: number | null; // Unix timestamp when track started
  end_time: number | null; // Unix timestamp when track will end
}

/**
 * WebSocket message for indicating playback has stopped or paused.
 * Simple message with no additional data needed.
 */
export interface StopMessage {
  type: "STOP";
}

/**
 * Union type for all possible WebSocket messages sent to the daemon.
 * Ensures type safety when sending messages over WebSocket connection.
 */
export type WebSocketMessage = PlayingMessage | StopMessage;