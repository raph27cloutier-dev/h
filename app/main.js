/* Wires everything together: loads the apps, listens to the remote, opens things. */
(function (root) {
  'use strict';

  var L = root.Launcher;
  var CLOCK_REFRESH_MS = 30000;
  var ALL_APPS_TILE = { key: 'all-apps', label: 'All Apps', type: 'all', color: '#2c2c2e' };

  // Replaced, never modified in place.
  var state = {
    screen: 'home',
    homeRows: [],
    allTiles: [],
    focus: { home: { row: 0, col: 0 }, all: 0 },
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

  function homeElement() {
    return document.getElementById('home-rows');
  }

  function allGrid() {
    return document.getElementById('all-grid');
  }

  function rowLengths() {
    return state.homeRows.map(function (row) {
      return row.tiles.length;
    });
  }

  function focusedTile() {
    if (state.screen === 'all') {
      return state.allTiles[state.focus.all];
    }
    var row = state.homeRows[state.focus.home.row];
    return row ? row.tiles[state.focus.home.col] : undefined;
  }

  function applyFocus() {
    if (state.screen === 'all') {
      L.view.setFocus(allGrid(), state.focus.all);
      return;
    }
    L.view.setRowFocus(homeElement(), state.focus.home);
    L.view.updateHero(focusedTile());
  }

  function setFocus(screen, value) {
    var focus = { home: state.focus.home, all: state.focus.all };
    focus[screen] = value;
    update({ focus: focus });
    applyFocus();
  }

  function goTo(screen) {
    update({ screen: screen });
    L.view.showScreen(screen);
    applyFocus();
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
        L.view.toast('Could not open ' + tile.label + ' (' + describe(error) + ').', 15000);
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
        if (result.handledByTv) {
          // The TV switched input itself; nothing to show behind the page.
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
    if (action === 'select') {
      select(focusedTile());
    } else if (action === 'back') {
      if (screen === 'all') {
        goTo('home');
      }
    } else if (action === 'debug') {
      document.body.classList.toggle('show-ids');
    } else if (screen === 'home') {
      setFocus('home', L.nav.moveInRows(state.focus.home, action, rowLengths()));
    } else {
      setFocus('all', L.nav.move(state.focus.all, action, state.allTiles.length, L.config.gridColumns));
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
    if (source === 'tv' || source === 'remote') {
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
    var homeRows = [
      { title: 'Apps', tiles: L.apps.pickFavourites(allTiles, L.config.favourites).concat([ALL_APPS_TILE]) },
      { title: 'Inputs', tiles: L.apps.sourceTiles(L.config.sources) }
    ].filter(function (row) {
      return row.tiles.length > 0;
    });
    update({ allTiles: allTiles, homeRows: homeRows });
    L.view.renderRows(homeElement(), homeRows);
    L.view.renderGrid(allGrid(), allTiles);
    // Keep the focus valid when the list changes (the real list can arrive later).
    var home = L.nav.moveInRows(state.focus.home, 'stay', rowLengths());
    var all = Math.min(state.focus.all, Math.max(allTiles.length - 1, 0));
    update({ focus: { home: home, all: all } });
    goTo(state.screen);
  }

  // Inside TizenBrew: ask the TV's remote-control service for the real app list.
  // The first time, the TV asks whether to allow "My Home".
  function loadRealAppsOverRemote() {
    L.view.toast('If the TV asks to allow "My Home", choose Allow.', 12000);
    L.tv
      .installedOverRemote()
      .then(function (raw) {
        var count = L.apps.normalizeInstalled(raw).length;
        if (count > 0) {
          showTiles(raw, 'remote');
          L.view.toast('Loaded ' + count + ' apps from your TV.');
        }
      })
      .catch(function (error) {
        console.error('Real app list unavailable', error);
        setStatus('Built-in app list (real list unavailable: ' + describe(error) + ')');
      });
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
        if (!L.tv.onTv() && L.tv.looksLikeTv()) {
          loadRealAppsOverRemote();
        }
      })
      .catch(function (error) {
        console.error('Could not read the installed apps', error);
        showTiles([], 'builtin');
      });
  }

  start();
})(window);
