'use strict';

// The one session rule that strips frame-blocking headers. It is scoped to the
// browser tabs that show the TulipLot dashboard (see registerTab), NOT to the
// request initiator: initiatorDomains does not match iframe navigations that
// the page itself creates, so an initiator-scoped static rule never fires for
// real dashboard cells. A tab-scoped session rule matches them reliably.
var FRAME_RULE_ID = 1;
var TULIPLOT_TAB_URLS = ['*://tuliplot.com/*', 'http://localhost/*'];

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

function frameRule(tabIds) {
  return {
    id: FRAME_RULE_ID,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      responseHeaders: [
        { header: 'x-frame-options', operation: 'remove' },
        { header: 'content-security-policy', operation: 'remove' },
      ],
    },
    condition: {
      resourceTypes: ['sub_frame'],
      tabIds: tabIds,
    },
  };
}

function getRuleTabIds() {
  return new Promise(function (resolve) {
    chrome.declarativeNetRequest.getSessionRules(function (rules) {
      var rule = (rules || []).find(function (r) {
        return r.id === FRAME_RULE_ID;
      });
      var ids = rule && rule.condition && rule.condition.tabIds ? rule.condition.tabIds : [];
      resolve(ids);
    });
  });
}

// Replaces the session rule so it covers exactly `tabIds`. An empty list
// removes the rule entirely.
function setRuleTabIds(tabIds) {
  return new Promise(function (resolve) {
    var unique = Array.from(new Set(tabIds)).filter(function (id) {
      return typeof id === 'number' && id >= 0;
    });
    var update = { removeRuleIds: [FRAME_RULE_ID] };
    if (unique.length > 0) {
      update.addRules = [frameRule(unique)];
    }
    chrome.declarativeNetRequest.updateSessionRules(update, function () {
      resolve();
    });
  });
}

// Adds a dashboard tab to the rule. Called for TAB_HELLO and PING, both of
// which only the tuliplot.com/localhost content script can send.
function registerTab(tabId) {
  if (typeof tabId !== 'number') {
    return Promise.resolve();
  }
  return getRuleTabIds().then(function (ids) {
    if (ids.indexOf(tabId) !== -1) {
      return undefined;
    }
    return setRuleTabIds(ids.concat(tabId));
  });
}

function unregisterTab(tabId) {
  return getRuleTabIds().then(function (ids) {
    if (ids.indexOf(tabId) === -1) {
      return undefined;
    }
    return setRuleTabIds(ids.filter(function (id) {
      return id !== tabId;
    }));
  });
}

// Rebuilds the rule from the dashboard tabs that are open now. Runs on every
// worker start, so the rule survives worker sleep, browser restart, and tabs
// that navigated away from the dashboard.
function resyncFromOpenTabs() {
  return new Promise(function (resolve) {
    chrome.tabs.query({ url: TULIPLOT_TAB_URLS }, function (tabs) {
      var ids = (tabs || []).map(function (t) {
        return t.id;
      }).filter(function (id) {
        return typeof id === 'number';
      });
      setRuleTabIds(ids).then(resolve);
    });
  });
}

// Handles messages forwarded from the tuliplot.com content script.
// Returning true keeps the message channel open for an async sendResponse.
function handleMessage(message, sender, sendResponse) {
  const known =
    message &&
    (message.type === 'PING' ||
      message.type === 'REQUEST_HOST' ||
      message.type === 'CHECK_HOST' ||
      message.type === 'TAB_HELLO');
  if (!known) {
    return false;
  }

  const senderTabId = sender && sender.tab ? sender.tab.id : undefined;

  if (message.type === 'TAB_HELLO') {
    void registerTab(senderTabId);
    return false; // fire-and-forget, no response
  }

  if (message.type === 'PING') {
    // PING also registers the tab, in case the TAB_HELLO message was lost.
    void registerTab(senderTabId);
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
if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.onRemoved) {
  chrome.tabs.onRemoved.addListener(function (tabId) {
    void unregisterTab(tabId);
  });
}
if (
  typeof chrome !== 'undefined' &&
  chrome.declarativeNetRequest &&
  chrome.tabs &&
  typeof chrome.tabs.query === 'function'
) {
  void resyncFromOpenTabs();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    handleMessage: handleMessage,
    isConcreteOrigin: isConcreteOrigin,
    frameRule: frameRule,
    registerTab: registerTab,
    unregisterTab: unregisterTab,
    resyncFromOpenTabs: resyncFromOpenTabs,
  };
}
