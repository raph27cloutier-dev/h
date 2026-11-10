/* Remembers the apps opened last (the "Recent" row): pure functions, no DOM. */
(function (root) {
  'use strict';

  function isKey(value) {
    return typeof value === 'string' && value !== '';
  }

  /** Reads the saved list; anything unexpected gives an empty list. */
  function parseRecent(raw) {
    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return [];
    }
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(function (key, index) {
      return isKey(key) && parsed.indexOf(key) === index;
    });
  }

  /** New list with `key` first, without duplicates, at most `max` long. */
  function addRecent(list, key, max) {
    return [key]
      .concat(
        list.filter(function (item) {
          return item !== key;
        })
      )
      .slice(0, max);
  }

  /** Tiles for the saved keys, in order; apps no longer on the TV are skipped. */
  function recentTiles(keys, tiles) {
    return keys
      .map(function (key) {
        for (var i = 0; i < tiles.length; i += 1) {
          if (tiles[i].key === key) {
            return tiles[i];
          }
        }
        return null;
      })
      .filter(Boolean);
  }

  var api = { parseRecent: parseRecent, addRecent: addRecent, recentTiles: recentTiles };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.Launcher = root.Launcher || {};
    root.Launcher.recent = api;
  }
})(typeof window !== 'undefined' ? window : this);
