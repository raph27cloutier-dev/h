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

  // A Samsung TV lists hundreds of internal parts next to the real apps. Apps from the
  // store have an id made of a 10-character code, a dot and a name ("9Ur5IzDKqV.TizenYouTube").
  var STORE_APP_ID = /^[A-Za-z0-9]{10}\.[^.]+$/;
  var NOT_AN_APP = /service|preview|promotion|devicecare/i;
  // Apps Samsung builds into the TV under other kinds of ids.
  var BUILT_IN_APPS = [
    'org.tizen.netflix-app',
    'org.tizen.primevideo',
    'org.tizen.apple.apple-music',
    'com.samsung.tv.aria-video',
    'org.tizen.browser',
    'com.samsung.tv.gallery',
    'com.samsung.tv.samsung-health',
    'com.samsung.tv.iot-dashboard'
  ];

  /**
   * True for something a person would open. `ownPackage` is My Home's own code, so it
   * does not list itself. Numbered ids (TV network service) and preview ids are kept.
   */
  function isUserApp(app, ownPackage) {
    if (/^[0-9]+$/.test(app.id) || app.id.indexOf('preview.') === 0) {
      return true;
    }
    if (BUILT_IN_APPS.indexOf(app.id) !== -1) {
      return true;
    }
    if (ownPackage && app.id.indexOf(ownPackage + '.') === 0) {
      return false;
    }
    return STORE_APP_ID.test(app.id) && !NOT_AN_APP.test(app.id) && !NOT_AN_APP.test(app.name);
  }

  /** Validates what the TV returned; never trusts its shape. */
  function normalizeInstalled(raw, ownPackage) {
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw.filter(isUsableApp).filter(function (item) {
      return isUserApp(item, ownPackage);
    }).map(function (item) {
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
      // The TV's status service only knows apps by their store number.
      statusId: entry && entry.fallbackId ? entry.fallbackId : app.id,
      iconPath: app.iconPath,
      logo: entry && entry.logo ? entry.logo : ''
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
      statusId: entry.fallbackId,
      iconPath: '',
      logo: entry.logo || ''
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

  var NEUTRAL_ACCENT = '#8e8e93';
  var LIGHT_LIMIT = 0.8;
  var DARK_LIMIT = 0.12;

  /** Relative brightness 0..1 of a #rrggbb colour, or -1 if it is not one. */
  function brightness(hex) {
    var match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex));
    if (!match) {
      return -1;
    }
    var r = parseInt(match[1], 16);
    var g = parseInt(match[2], 16);
    var b = parseInt(match[3], 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  /**
   * Glow colour for the banner behind a tile: its own colour, or its text colour
   * when the tile is almost white (YouTube), or a neutral grey.
   */
  function accentFor(tile) {
    var level = brightness(tile && tile.color);
    var textLevel = brightness(tile && tile.text);
    var textIsColourful = textLevel >= DARK_LIMIT && textLevel < LIGHT_LIMIT;
    if (level >= DARK_LIMIT && level < LIGHT_LIMIT) {
      return tile.color;
    }
    // Almost white (YouTube) or almost black (Netflix, Spotify): glow in the logo colour.
    if (level >= 0 && textIsColourful) {
      return tile.text;
    }
    return NEUTRAL_ACCENT;
  }

  var api = {
    accentFor: accentFor,
    normalizeInstalled: normalizeInstalled,
    isUserApp: isUserApp,
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
