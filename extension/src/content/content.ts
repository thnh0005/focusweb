chrome.runtime.onMessage.addListener((message) => {
  if (!message || typeof message.type !== "string") {
    return;
  }

  window.postMessage(message, window.location.origin);
});
