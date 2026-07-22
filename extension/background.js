'use strict';

// Validates that a page-supplied string is a single concrete web origin:
// http(s) scheme, a non-empty host with no '*' wildcard, and no path/query/
// fragment beyond a bare '/'. Rejects wildcards and malformed values.
function isConcreteOrigin(origin) {
  if (typeof origin !== 'string' || origin.length === 0) {
    return false;
  }
  let url;
  try {
    url = new URL(origin);
  } catch (e) {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false;
  }
  if (!url.hostname || url.hostname.indexOf('*') !== -1) {
    return false;
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    return false;
  }
  if (url.search || url.hash || url.username || url.password) {
    return false;
  }
  return true;
}

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
  // Validate that the page-supplied origin is a single concrete origin before
  // requesting host permissions, so a wildcard/malformed value cannot escalate.
  const origin = message.origin;
  if (!isConcreteOrigin(origin)) {
    sendResponse({
      source: 'dashdash-ext',
      type: 'HOST_RESULT',
      origin: origin,
      granted: false,
    });
    return false; // synchronous rejection, no permission request issued
  }

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
  module.exports = { handleMessage: handleMessage, isConcreteOrigin: isConcreteOrigin };
}
