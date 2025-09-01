import type { PlaybackStatePayload, RuntimeMessage } from "./types";
import browser from "webextension-polyfill";

/**
 * Injects a script into the main page context to access `window.MusicKit`.
 * This is necessary to bypass the content script's isolated world.
 * It injects the script via `src` to comply with Content Security Policies (CSP).
 */
function injectMusicKitScript(): void {
  try {
    const script = document.createElement('script');
    script.src = browser.runtime.getURL('injected.js');
    (document.head || document.documentElement).appendChild(script);
    script.onload = () => script.remove(); // Clean up the DOM after execution
  } catch (error) {
    console.error("Failed to inject MusicKit script:", error);
  }
}

function sendToBackground(payload: PlaybackStatePayload): void {
  const message: RuntimeMessage = {
    type: "NOW_PLAYING_DATA",
    payload,
  };

  browser.runtime.sendMessage(message).catch(error => {
    console.warn("Could not send message to background script:", error);
  });
}

window.addEventListener('MusicKitDataEvent', (event: Event) => {
  const customEvent = event as CustomEvent<PlaybackStatePayload>;
  if (customEvent.detail) {
    sendToBackground(customEvent.detail);
  }
});

injectMusicKitScript();

console.log("[CONTENT] Now Playing content script initialized.");
