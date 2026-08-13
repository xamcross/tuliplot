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

// Handles messages forwarded from the tuliplot.com content script.
// Returning true keeps the message channel open for an async sendResponse.
function handleMessage(message, sender, sendResponse) {
  const known =
    message &&
    (message.type === 'PING' || message.type === 'REQUEST_HOST' || message.type === 'CHECK_HOST');
  if (!known) {
    return false;
  }

  if (message.type === 'PING') {
    const version = chrome.runtime.getManifest().version;
    sendResponse({ source: 'tuliplot-ext', type: 'PONG', version: version });
    return false; // synchronous response
  }

  // REQUEST_HOST asks for the per-site host permission; CHECK_HOST only reads
  // whether the permission is already granted. Both validate that the
  // page-supplied origin is a single concrete origin first, so a
  // wildcard/malformed value cannot escalate.
  const responseType = message.type === 'REQUEST_HOST' ? 'HOST_RESULT' : 'HOST_STATUS';
  const origin = message.origin;
  if (!isConcreteOrigin(origin)) {
    sendResponse({
      source: 'tuliplot-ext',
      type: responseType,
      origin: origin,
      granted: false,
    });
    return false; // synchronous rejection, no permission API call issued
  }

  const respond = function (granted) {
    sendResponse({
      source: 'tuliplot-ext',
      type: responseType,
      origin: origin,
      granted: !!granted,
    });
  };
  if (message.type === 'REQUEST_HOST') {
    chrome.permissions.request({ origins: [origin + '/*'] }, respond);
  } else {
    chrome.permissions.contains({ origins: [origin + '/*'] }, respond);
  }
  return true; // async response
}

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener(handleMessage);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { handleMessage: handleMessage, isConcreteOrigin: isConcreteOrigin };
}
