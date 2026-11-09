/* Remote-control navigation: pure functions, no DOM. */
(function (root) {
  'use strict';

  var KEY_ACTIONS = {
    37: 'left',
    38: 'up',
    39: 'right',
    40: 'down',
    13: 'select',
    10009: 'back', // Samsung remote Back
    27: 'back', // Escape (computer preview)
    8: 'back', // Backspace (computer preview)
    68: 'debug' // D key (computer preview / USB keyboard)
  };

  function actionForKey(keyCode) {
    return Object.prototype.hasOwnProperty.call(KEY_ACTIONS, keyCode) ? KEY_ACTIONS[keyCode] : null;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  /**
   * Returns the tile index reached by moving in `direction` inside a grid of
   * `count` tiles laid out in `columns` columns. Never wraps between rows.
   */
  function move(index, direction, count, columns) {
    if (!(count > 0)) {
      return 0;
    }
    var cols = columns > 0 ? Math.min(columns, count) : count;
    var current = clamp(Math.floor(Number(index)) || 0, 0, count - 1);
    var column = current % cols;
    var row = Math.floor(current / cols);
    var lastRow = Math.floor((count - 1) / cols);

    if (direction === 'left') {
      return column > 0 ? current - 1 : current;
    }
    if (direction === 'right') {
      return column < cols - 1 && current + 1 < count ? current + 1 : current;
    }
    if (direction === 'up') {
      return row > 0 ? current - cols : current;
    }
    if (direction === 'down') {
      if (row >= lastRow) {
        return current;
      }
      return Math.min(current + cols, count - 1);
    }
    return current;
  }

  var api = { move: move, actionForKey: actionForKey };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.Launcher = root.Launcher || {};
    root.Launcher.nav = api;
  }
})(typeof window !== 'undefined' ? window : this);
