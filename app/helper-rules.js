/*
 * Rules of the background helper (see service/watcher-service.js), kept apart so they
 * can be tested on a computer.
 */
(function (root) {
  'use strict';

  /**
   * Applies one message from the My Home page to the helper's state; returns a new state.
   * Messages: 'front' (My Home is on screen), 'back' (it was hidden), 'opened' (it opened a
   * watchable app), 'pause' (it opened an app the TV cannot report on), 'stop' (Exit to TV).
   * `graceMs`: how long an opened app gets to appear before the helper looks at the screen.
   */
  function applyMessage(state, message, now, graceMs) {
    if (message === 'front') {
      return { homeFront: true, paused: false, stopped: false, graceUntil: 0 };
    }
    if (message === 'back') {
      return { homeFront: false, paused: state.paused, stopped: state.stopped, graceUntil: state.graceUntil };
    }
    if (message === 'opened') {
      return { homeFront: false, paused: false, stopped: state.stopped, graceUntil: now + graceMs };
    }
    if (message === 'pause') {
      return { homeFront: false, paused: true, stopped: state.stopped, graceUntil: state.graceUntil };
    }
    if (message === 'stop') {
      return { homeFront: false, paused: state.paused, stopped: true, graceUntil: state.graceUntil };
    }
    return state;
  }

  /** True when the helper should look at what is on screen now. */
  function shouldScan(state, now) {
    return !state.stopped && !state.paused && !state.homeFront && now >= state.graceUntil;
  }

  var api = { applyMessage: applyMessage, shouldScan: shouldScan };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : this);
