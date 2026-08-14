'use strict';

// True only for genuine same-window messages from the TulipLot page.
function isPageMessage(event) {
  return (
    event.source === window &&
    !!event.data &&
    event.data.source === 'tuliplot' &&
    (event.data.type === 'PING' ||
      event.data.type === 'REQUEST_HOST' ||
      event.data.type === 'CHECK_HOST')
  );
}

function handleWindowMessage(event) {
  if (!isPageMessage(event)) {
    return;
  }
  const outbound =
    event.data.type === 'PING'
      ? { type: 'PING' }
      : { type: event.data.type, origin: event.data.origin };

  chrome.runtime.sendMessage(outbound, function (response) {
    if (response) {
      window.postMessage(response, window.location.origin);
    }
  });
}

if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('message', handleWindowMessage);
}

// Register this dashboard tab with the worker at document_start, before any
// cell iframe mounts, so the tab-scoped header rule is in place first.
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
  chrome.runtime.sendMessage({ type: 'TAB_HELLO' }, function () {
    void chrome.runtime.lastError; // worker unavailable; the PING retries the registration
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { handleWindowMessage: handleWindowMessage, isPageMessage: isPageMessage };
}
