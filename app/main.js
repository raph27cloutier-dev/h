/* Wires everything together: loads the apps, listens to the remote, opens things. */
(function (root) {
  'use strict';

  var L = root.Launcher;
  var CLOCK_REFRESH_MS = 30000;
  var ALL_APPS_TILE = { key: 'all-apps', label: 'All Apps', type: 'all', color: '#2c2c2e' };

  // Replaced, never modified in place.
  var state = {
    screen: 'home',
    homeTiles: [],
    allTiles: [],
    focus: { home: 0, all: 0 },
    sourceShowing: false,
    switchingSource: false
  };

  function setSourceShowing(showing) {
    update({ sourceShowing: showing });
    // Both <html> and <body> must turn transparent for the input to show through.
    document.documentElement.classList.toggle('source-showing', showing);
    document.body.classList.toggle('source-showing', showing);
  }

  function update(changes) {
    var next = {};
    Object.keys(state).forEach(function (key) {
      next[key] = Object.prototype.hasOwnProperty.call(changes, key) ? changes[key] : state[key];
    });
    state = next;
  }

  function tilesFor(screen) {
    return screen === 'home' ? state.homeTiles : state.allTiles;
  }

  function gridFor(screen) {
    return document.getElementById(screen === 'home' ? 'home-grid' : 'all-grid');
  }

  function setFocusIndex(screen, index) {
    var focus = { home: state.focus.home, all: state.focus.all };
    focus[screen] = index;
    update({ focus: focus });
    L.view.setFocus(gridFor(screen), index);
  }

  function goTo(screen) {
    update({ screen: screen });
    L.view.showScreen(screen);
    L.view.setFocus(gridFor(screen), state.focus[screen]);
  }

  function describe(error) {
    return (error && (error.message || error.name)) || 'unknown error';
  }

  // On a real TV that still reports "preview", show what the page can see so the cause can be found.
  function previewNotice(wording) {
    if (L.tv.looksLikeTv()) {
      L.view.toast('TV functions not found. ' + L.tv.envInfo(), 20000);
    } else {
      L.view.toast('Preview: this would ' + wording + ' on the TV.');
    }
  }

  function openApp(tile) {
    L.view.toast('Opening ' + tile.label + ' (' + tile.appId + ')');
    L.tv
      .launchApp(tile.appId)
      .then(function (result) {
        if (result.preview) {
          previewNotice('open ' + tile.label);
        }
      })
      .catch(function (error) {
        console.error('Launch failed', tile.appId, error);
        L.view.toast('Could not open ' + tile.label + ' (' + describe(error) + ').');
      });
  }

  function hideSourceQuietly() {
    L.tv.hideSource().catch(function (error) {
      console.error('Could not hide the input', error);
    });
  }

  // The remote is ignored while the switch is in progress (see handleAction).
  function openSource(tile) {
    update({ switchingSource: true });
    L.tv
      .showSource(tile.source)
      .then(function (result) {
        update({ switchingSource: false });
        if (result.preview) {
          previewNotice('switch to ' + tile.label);
          return;
        }
        setSourceShowing(true);
      })
      .catch(function (error) {
        update({ switchingSource: false });
        console.error('Input switch failed', tile.source, error);
        // If the TV answers late, make sure the input does not stay on screen.
        hideSourceQuietly();
        L.view.toast('Could not switch to ' + tile.label + ' (' + describe(error) + ').');
      });
  }

  function leaveSource() {
    setSourceShowing(false);
    hideSourceQuietly();
  }

  function select(tile) {
    if (!tile) {
      return;
    }
    if (tile.type === 'all') {
      goTo('all');
    } else if (tile.type === 'source') {
      openSource(tile);
    } else {
      openApp(tile);
    }
  }

  function handleAction(action) {
    if (state.switchingSource) {
      return;
    }
    if (state.sourceShowing) {
      if (action === 'back') {
        leaveSource();
      }
      return;
    }
    var screen = state.screen;
    var tiles = tilesFor(screen);
    if (action === 'select') {
      select(tiles[state.focus[screen]]);
    } else if (action === 'back') {
      if (screen === 'all') {
        goTo('home');
      }
    } else if (action === 'debug') {
      document.body.classList.toggle('show-ids');
    } else {
      setFocusIndex(screen, L.nav.move(state.focus[screen], action, tiles.length, L.config.gridColumns));
    }
  }

  function onKeyDown(event) {
    var action = L.nav.actionForKey(event.keyCode);
    if (!action) {
      return;
    }
    // Back on the home screen must always get you out of the launcher.
    if (action === 'back' && state.screen === 'home' && !state.sourceShowing) {
      L.tv.leaveApp();
      return;
    }
    event.preventDefault();
    handleAction(action);
  }

  function setStatus(text) {
    document.getElementById('status').textContent = text;
  }

  function showTiles(rawInstalled, source) {
    var installed = L.apps.normalizeInstalled(rawInstalled);
    if (source === 'tv') {
      setStatus(
        installed.length > 0
          ? 'TV app list: ' + installed.length + ' apps'
          : 'TV gave an empty app list: using the built-in list'
      );
    } else if (L.tv.looksLikeTv()) {
      setStatus('Built-in app list (opens apps through the TV network service)');
    } else {
      setStatus('Preview: built-in app list');
    }
    var allTiles = L.apps.buildTiles(installed, L.config.catalog);
    var homeTiles = L.apps
      .pickFavourites(allTiles, L.config.favourites)
      .concat(L.apps.sourceTiles(L.config.sources), [ALL_APPS_TILE]);
    update({ allTiles: allTiles, homeTiles: homeTiles });
    L.view.renderGrid(gridFor('home'), homeTiles);
    L.view.renderGrid(gridFor('all'), allTiles);
    goTo('home');
  }

  function start() {
    L.view.updateClock(L.config.locale);
    setInterval(function () {
      L.view.updateClock(L.config.locale);
    }, CLOCK_REFRESH_MS);
    document.addEventListener('keydown', onKeyDown);
    if (L.config.showDebug) {
      document.body.classList.add('show-ids');
    }

    L.tv
      .listInstalled(L.config.catalog)
      .then(function (raw) {
        showTiles(raw, L.tv.onTv() ? 'tv' : 'builtin');
      })
      .catch(function (error) {
        console.error('Could not read the installed apps', error);
        showTiles([], 'builtin');
      });
  }

  start();
})(window);
