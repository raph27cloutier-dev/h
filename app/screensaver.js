/*
 * Aerial screensaver: after a few idle minutes, plays Apple's aerial videos with the
 * place and time, like Apple TV. Any button closes it.
 */
(function (root) {
  'use strict';

  var L = root.Launcher;
  var MAX_FAILURES_IN_A_ROW = 3;
  var IDLE_CHECK_MS = 15000;

  var lastActivity = Date.now();
  var showing = false;
  var failures = 0;
  var previousUrl = '';
  var canStart = function () {
    return true;
  };

  function overlay() {
    return document.getElementById('saver');
  }

  function video() {
    return document.getElementById('saver-video');
  }

  function idleLimitMs() {
    var minutes = Number(L.config.screensaverMinutes);
    return minutes > 0 ? minutes * 60000 : 0;
  }

  function updateTime() {
    var node = document.getElementById('saver-time');
    if (node) {
      node.textContent = new Date().toLocaleTimeString(L.config.locale, { hour: 'numeric', minute: '2-digit' });
    }
  }

  // No video could play: keep a slowly moving colour background instead.
  function showWithoutVideo() {
    overlay().classList.add('no-video');
    document.getElementById('saver-place').textContent = '';
  }

  function playNext() {
    if (!showing) {
      return;
    }
    if (failures >= MAX_FAILURES_IN_A_ROW) {
      showWithoutVideo();
      return;
    }
    var pick = L.aerials.pickAerial(L.aerials.list, new Date().getHours(), previousUrl, Math.random);
    if (!pick) {
      showWithoutVideo();
      return;
    }
    previousUrl = pick.url;
    document.getElementById('saver-place').textContent = pick.place;
    var player = video();
    player.classList.remove('is-playing');
    player.src = pick.url;
    var started = player.play();
    if (started && started.catch) {
      started.catch(function (error) {
        console.error('Aerial video did not start', pick.url, error);
      });
    }
  }

  function onPlaying() {
    failures = 0;
    overlay().classList.remove('no-video');
    video().classList.add('is-playing');
  }

  function onError() {
    if (!showing) {
      return;
    }
    failures += 1;
    console.error('Aerial video failed', previousUrl);
    playNext();
  }

  function start() {
    if (showing) {
      return;
    }
    showing = true;
    failures = 0;
    updateTime();
    overlay().classList.add('is-visible');
    playNext();
  }

  function stop() {
    if (!showing) {
      return;
    }
    showing = false;
    overlay().classList.remove('is-visible', 'no-video');
    var player = video();
    player.pause();
    player.classList.remove('is-playing');
    // Frees the network and the video decoder.
    player.removeAttribute('src');
    player.load();
  }

  /** Called on every button press. Returns true if the press only closed the screensaver. */
  function wake() {
    lastActivity = Date.now();
    if (showing) {
      stop();
      return true;
    }
    return false;
  }

  // Never play behind another app (Netflix...): only when My Home is on screen and in focus.
  function pageInFront() {
    return !document.hidden && (typeof document.hasFocus !== 'function' || document.hasFocus());
  }

  function onLeavePage() {
    lastActivity = Date.now();
    stop();
  }

  function checkIdle() {
    updateTime();
    var limit = idleLimitMs();
    if (!showing && limit > 0 && pageInFront() && canStart() && Date.now() - lastActivity >= limit) {
      start();
    }
  }

  /** `allowed` says whether the screensaver may start now (not while an input is shown). */
  function init(allowed) {
    canStart = allowed;
    var player = video();
    player.muted = true;
    player.addEventListener('playing', onPlaying);
    player.addEventListener('ended', playNext);
    player.addEventListener('error', onError);
    root.addEventListener('blur', onLeavePage);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        onLeavePage();
      }
    });
    setInterval(checkIdle, IDLE_CHECK_MS);
  }

  L.screensaver = {
    init: init,
    start: start,
    stop: stop,
    wake: wake,
    isShowing: function () {
      return showing;
    }
  };
})(window);
