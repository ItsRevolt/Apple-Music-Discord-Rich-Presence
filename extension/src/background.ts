import type { PlaybackStatePayload, RuntimeMessage, WebSocketMessage } from "./types";
import { calculateTimestamps } from "./utils";
import browser from "webextension-polyfill";

const WEBSOCKET_URL = "ws://127.0.0.1:9224";
const RECONNECT_INTERVAL_MS = 5000;
let ws: WebSocket | null = null;
let pendingMessage: WebSocketMessage | null = null;

function connect(): void {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        return;
    }

    console.log("Attempting to connect to WebSocket...");
    ws = new WebSocket(WEBSOCKET_URL);

    ws.onopen = () => {
        console.log("WebSocket connection established.");

        if (pendingMessage) {
            try {
                ws!.send(JSON.stringify(pendingMessage));
                console.log("Sent pending message:", pendingMessage);
            } catch (error) {
                console.error("Failed to send pending message:", error);
            }
            pendingMessage = null;
        }
    };

    ws.onclose = (event) => {
        console.log(`WebSocket closed. Reconnecting in ${RECONNECT_INTERVAL_MS / 1000}s...`, event.reason);
        ws = null;
        setTimeout(connect, RECONNECT_INTERVAL_MS);
    };

    ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        ws?.close();
    };
}

function sendPlaybackState(payload: PlaybackStatePayload): void {
    let message: WebSocketMessage;

    if (!payload.isPlaying) {
        message = { type: "STOP" };
    } else {
        const timestamps = calculateTimestamps(payload.positionSec, payload.durationSec);

        message = {
            type: "PLAYING",
            state: payload.artist || "",
            details: payload.title || "",
            large_image: payload.artworkUrl,
            start_time: timestamps.startTime || null,
            end_time: timestamps.endTime || null,
        };
    }

    if (ws?.readyState !== WebSocket.OPEN) {
        console.warn("WebSocket not open. Queueing message and attempting to reconnect.");
        pendingMessage = message;
        connect();
        return;
    }

    try {
        ws.send(JSON.stringify(message));
        console.log("Sent message:", message);
    } catch (error) {
        console.error("Failed to send WebSocket message:", error);
    }
}

browser.runtime.onMessage.addListener((message: unknown) => {
    const runtimeMessage = message as RuntimeMessage;
    if (runtimeMessage.type === "NOW_PLAYING_DATA") {
        sendPlaybackState(runtimeMessage.payload);
    }
});

connect();