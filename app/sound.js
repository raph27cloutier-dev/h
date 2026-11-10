/*
 * Soft Apple TV-style clicks, made with the Web Audio API (no sound files).
 * Silently does nothing if the TV browser has no audio support.
 */
(function (root) {
  'use strict';

  var context = null;
  var failed = false;

  function audio() {
    if (context || failed) {
      return context;
    }
    var AudioContextClass = root.AudioContext || root.webkitAudioContext;
    if (!AudioContextClass) {
      failed = true;
      return null;
    }
    try {
      context = new AudioContextClass();
    } catch (error) {
      console.error('Sounds unavailable', error);
      failed = true;
    }
    return context;
  }

  function enabled() {
    return root.Launcher.config.sounds !== false;
  }

  /** A short tick: a sine blip that fades out in a few milliseconds. */
  function tick(frequency, durationS, volume) {
    if (!enabled()) {
      return;
    }
    var ctx = audio();
    if (!ctx) {
      return;
    }
    try {
      if (ctx.state === 'suspended' && ctx.resume) {
        ctx.resume();
      }
      var now = ctx.currentTime;
      var oscillator = ctx.createOscillator();
      var gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.6, now + durationS);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durationS);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(now);
      oscillator.stop(now + durationS + 0.01);
    } catch (error) {
      console.error('Could not play a sound', error);
      failed = true;
    }
  }

  root.Launcher.sound = {
    move: function () {
      tick(1800, 0.03, 0.05);
    },
    select: function () {
      tick(900, 0.08, 0.09);
    },
    back: function () {
      tick(600, 0.06, 0.07);
    }
  };
})(window);
