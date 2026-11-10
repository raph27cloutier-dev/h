/*
 * Brings My Home back when the app it opened is closed. Only works when My Home is
 * installed as a real TV app and the TV lets it keep running in the background.
 * The TV's own service says which app is on screen; nothing else can tell us.
 */
(function (root) {
  'use strict';

  var CHECK_MS = 2500;
  var MAX_CHECKS_BEFORE_SEEN = 12; // the opened app gets 30 s to appear

  /**
   * What to do after one check. `seen`: the followed app has been on screen at least once.
   * Returns 'wait', 'look-around' (see whether another known app took over) or 'give-up'.
   */
  function decide(seen, visible, checks) {
    if (visible) {
      return 'wait';
    }
    if (seen) {
      return 'look-around';
    }
    return checks >= MAX_CHECKS_BEFORE_SEEN ? 'give-up' : 'wait';
  }

  var api = { decide: decide };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return;
  }

  var L = root.Launcher;
  var timer = null;
  var followed = '';
  var seen = false;
  var checks = 0;
  var others = [];

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  // Another known app is on screen (opened from Samsung's bar): follow that one instead.
  function lookAround() {
    return Promise.all(
      others.map(function (appId) {
        return L.tv.appVisible(appId).catch(function () {
          return false;
        });
      })
    ).then(function (results) {
      var index = results.indexOf(true);
      if (index !== -1) {
        followed = others[index];
        return;
      }
      stop();
      L.tv.bringToFront().catch(function (error) {
        console.error('Could not come back to My Home', error);
      });
    });
  }

  function check() {
    if (!document.hidden) {
      stop();
      return;
    }
    checks += 1;
    L.tv
      .appVisible(followed)
      .then(function (visible) {
        seen = seen || visible;
        var step = decide(seen, visible, checks);
        if (step === 'give-up') {
          stop();
        } else if (step === 'look-around') {
          return lookAround();
        }
        return undefined;
      })
      .catch(function (error) {
        console.error('Could not check the opened app', error);
      });
  }

  /** Starts following `appId`; `knownIds` are the other apps My Home can show. */
  function follow(appId, knownIds) {
    stop();
    followed = appId;
    seen = false;
    checks = 0;
    others = knownIds.filter(function (id) {
      return id && id !== appId;
    });
    timer = setInterval(check, CHECK_MS);
  }

  L.watcher = { decide: decide, follow: follow, stop: stop };
})(typeof window !== 'undefined' ? window : this);
