/* Turns the TV's installed-app list and the catalog into tiles: pure functions, no DOM. */
(function (root) {
  'use strict';

  var SOURCE_COLOR = '#3a3a3c';
  var FALLBACK_COLORS = ['#5e5ce6', '#0a84ff', '#30b0c7', '#34c759', '#ff9f0a', '#ff375f', '#bf5af2', '#8e8e93'];

  function isUsableApp(item) {
    return Boolean(
      item &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        item.id !== '' &&
        typeof item.name === 'string' &&
        item.name !== '' &&
        item.show !== false
    );
  }

  /** Validates what the TV returned; never trusts its shape. */
  function normalizeInstalled(raw) {
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw.filter(isUsableApp).map(function (item) {
      return {
        id: item.id,
        name: item.name,
        iconPath: typeof item.iconPath === 'string' ? item.iconPath : ''
      };
    });
  }

  function colorFor(text) {
    var hash = 0;
    for (var i = 0; i < text.length; i += 1) {
      hash = (hash * 31 + text.charCodeAt(i)) % 100000;
    }
    return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
  }

  function findCatalogEntry(name, catalog) {
    var lower = name.toLowerCase();
    for (var i = 0; i < catalog.length; i += 1) {
      if (lower.indexOf(catalog[i].match) !== -1) {
        return catalog[i];
      }
    }
    return null;
  }

  function tileFromInstalled(app, entry) {
    return {
      key: entry ? entry.key : app.id,
      label: entry ? entry.label : app.name,
      type: 'app',
      color: entry ? entry.color : colorFor(app.id),
      text: entry && entry.text ? entry.text : '#ffffff',
      appId: app.id,
      iconPath: app.iconPath
    };
  }

  function tileFromCatalog(entry) {
    return {
      key: entry.key,
      label: entry.label,
      type: 'app',
      color: entry.color,
      text: entry.text || '#ffffff',
      appId: entry.fallbackId,
      iconPath: ''
    };
  }

  function compareText(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
  }

  // Ties are broken by key so the order is the same on every TV browser.
  function byLabel(a, b) {
    return compareText(a.label.toLowerCase(), b.label.toLowerCase()) || compareText(a.key, b.key);
  }

  // Shortest name first, so "Netflix" claims the Netflix entry before "Netflix Kids".
  function byNameLength(a, b) {
    return a.name.length - b.name.length || compareText(a.id, b.id);
  }

  /** Each catalog entry is given to at most one installed app. */
  function decorate(installed, catalog) {
    var claimed = {};
    return installed
      .slice()
      .sort(byNameLength)
      .map(function (app) {
        var entry = findCatalogEntry(app.name, catalog);
        if (!entry || claimed[entry.key]) {
          return tileFromInstalled(app, null);
        }
        claimed[entry.key] = true;
        return tileFromInstalled(app, entry);
      });
  }

  /**
   * All app tiles, A to Z. If the TV gave no list, falls back to the catalog
   * entries that carry a known app id.
   */
  function buildTiles(installed, catalog) {
    if (installed.length === 0) {
      return catalog
        .filter(function (entry) {
          return Boolean(entry.fallbackId);
        })
        .map(tileFromCatalog);
    }
    return decorate(installed, catalog).sort(byLabel);
  }

  /** Favourites in the configured order; apps that are not on the TV are skipped. */
  function pickFavourites(tiles, favouriteKeys) {
    return favouriteKeys
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

  function sourceTiles(sources) {
    return sources.map(function (source) {
      return {
        key: 'source-' + source.type + '-' + source.number,
        label: source.label,
        type: 'source',
        color: SOURCE_COLOR,
        source: { type: source.type, number: source.number }
      };
    });
  }

  function initials(name) {
    var words = String(name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (words.length === 0) {
      return '?';
    }
    return words
      .slice(0, 2)
      .map(function (word) {
        return word.charAt(0).toUpperCase();
      })
      .join('');
  }

  var api = {
    normalizeInstalled: normalizeInstalled,
    buildTiles: buildTiles,
    pickFavourites: pickFavourites,
    sourceTiles: sourceTiles,
    initials: initials
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.Launcher = root.Launcher || {};
    root.Launcher.apps = api;
  }
})(typeof window !== 'undefined' ? window : this);
