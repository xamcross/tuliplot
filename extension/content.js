'use strict';

// True only for genuine same-window messages from the DashDash page.
function isPageMessage(event) {
  return (
    event.source === window &&
    !!event.data &&
    event.data.source === 'dashdash' &&
    (event.data.type === 'PING' || event.data.type === 'REQUEST_HOST')
  );
}

function handleWindowMessage(event) {
  if (!isPageMessage(event)) {
    return;
  }
  const outbound =
    event.data.type === 'PING'
      ? { type: 'PING' }
      : { type: 'REQUEST_HOST', origin: event.data.origin };

  chrome.runtime.sendMessage(outbound, function (response) {
    if (response) {
      window.postMessage(response, window.location.origin);
    }
  });
}

if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('message', handleWindowMessage);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { handleWindowMessage: handleWindowMessage, isPageMessage: isPageMessage };
}
