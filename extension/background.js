'use strict';

// Handles messages forwarded from the dashdash.app content script.
// Returning true keeps the message channel open for an async sendResponse.
function handleMessage(message, sender, sendResponse) {
  if (!message || (message.type !== 'PING' && message.type !== 'REQUEST_HOST')) {
    return false;
  }

  if (message.type === 'PING') {
    const version = chrome.runtime.getManifest().version;
    sendResponse({ source: 'dashdash-ext', type: 'PONG', version: version });
    return false; // synchronous response
  }

  // REQUEST_HOST: ask for the per-site host permission for this origin.
  const origin = message.origin;
  chrome.permissions.request({ origins: [origin + '/*'] }, function (granted) {
    sendResponse({
      source: 'dashdash-ext',
      type: 'HOST_RESULT',
      origin: origin,
      granted: !!granted,
    });
  });
  return true; // async response
}

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener(handleMessage);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { handleMessage: handleMessage };
}
