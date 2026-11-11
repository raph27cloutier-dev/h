/* Wires everything together: loads the apps, listens to the remote, opens things. */
(function (root) {
  'use strict';

  var L = root.Launcher;
  var CLOCK_REFRESH_MS = 30000;
  var ALL_APPS_TILE = { key: 'all-apps', label: 'All Apps', type: 'all', color: '#2c2c2e' };
  var RECENT_STORAGE_KEY = 'myhome.recent';
  var RECENT_MAX = 6;
  var THEME_STORAGE_KEY = 'myhome.theme';

  // The theme picked in Control Center, else the one in config.js.
  function loadThemeKey() {
    try {
      return root.localStorage.getItem(THEME_STORAGE_KEY) || L.config.theme;
    } catch (error) {
      console.error('Could not read the saved theme', error);
      return L.config.theme;
    }
  }

  function saveThemeKey(key) {
    try {
      root.localStorage.setItem(THEME_STORAGE_KEY, key);
    } catch (error) {
      console.error('Could not save the theme', error);
    }
  }

  function loadRecent() {
    try {
      return L.recent.parseRecent(root.localStorage.getItem(RECENT_STORAGE_KEY));
    } catch (error) {
      console.error('Could not read recent apps', error);
      return [];
    }
  }

  function saveRecent(keys) {
    try {
      root.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(keys));
    } catch (error) {
      console.error('Could not save recent apps', error);
    }
  }

  // Replaced, never modified in place.
  var state = {
    screen: 'home',
    homeRows: [],
    allTiles: [],
    focus: { home: { row: 0, col: 0 }, all: 0 },
    sourceShowing: false,
    switchingSource: false,
    pillFocused: false,
    leftSinceLaunch: false,
    exiting: false,
    appOpenedAt: 0,
    // Inputs with something plugged in (all of them until the TV has answered).
    sources: L.config.sources,
    recent: loadRecent(),
    themeKey: L.themes.find(loadThemeKey()).key,
    installed: [],
    homeFocusPlaced: false
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

  function applyFocus(direction) {
    if (state.screen === 'all') {
      L.view.setFocus(allGrid(), state.focus.all, direction);
      return;
    }
    L.view.setRowFocus(homeElement(), state.focus.home, direction);
    L.view.updateHero(focusedTile());
  }

  function samePosition(a, b) {
    return typeof a === 'object' ? a.row === b.row && a.col === b.col : a === b;
  }

  function setFocus(screen, value, direction) {
    if (samePosition(state.focus[screen], value)) {
      return false;
    }
    var focus = { home: state.focus.home, all: state.focus.all };
    focus[screen] = value;
    update({ focus: focus });
    applyFocus(direction);
    L.sound.move();
    return true;
  }

  function setPillFocused(focused) {
    update({ pillFocused: focused });
    L.view.setPillFocus(focused);
    L.view.setRowFocus(homeElement(), focused ? { row: -1, col: -1 } : state.focus.home, focused ? '' : 'down');
    L.sound.move();
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

  function rememberOpened(tile) {
    var recent = L.recent.addRecent(state.recent, tile.key, RECENT_MAX);
    update({ recent: recent });
    saveRecent(recent);
  }

  var STORE_NUMBER = /^[0-9]+$/;
  var WELCOME_MS = 2600;
  var STILL_HERE_CHECK_MS = 6000;
  var LONG_MESSAGE_MS = 30000;

  // The app did not come to the front: say so, with what the TV answered.
  function reportIfStillHere(tile, result) {
    setTimeout(function () {
      if (document.hidden || state.leftSinceLaunch) {
        return;
      }
      L.tv.appStatus(tile.appId).then(function (status) {
        if (document.hidden || state.leftSinceLaunch) {
          return;
        }
        var details = (result.trace || []).concat(['app is ' + status]).join(', ');
        L.view.toast(tile.label + ' did not open. The TV said: ' + details, LONG_MESSAGE_MS);
      });
    }, STILL_HERE_CHECK_MS);
  }

  // The background helper watches the opened app; the page itself is the fallback.
  // "Always home": the background helper brings My Home back whenever no known app is
  // on screen. Only apps with a store number can be seen by it.
  function alwaysHome() {
    return L.tv.onTv() && L.config.alwaysHome;
  }

  function tellHelper(message, id, appId) {
    if (!alwaysHome()) {
      return;
    }
    var known = state.allTiles
      .map(function (item) {
        return item.statusId;
      })
      .filter(function (statusId) {
        return STORE_NUMBER.test(statusId);
      });
    L.tv.tellHelper(message, { id: id, app: appId, known: known, statusPage: L.config.helperStatusPage }).catch(function (error) {
      console.error('Background helper did not answer', message, error);
    });
  }

  function tellHelperAppOpened(tile) {
    var id = tile.statusId || tile.appId;
    if (STORE_NUMBER.test(id)) {
      tellHelper('opened', id, tile.appId);
    } else {
      tellHelper('pause', '', tile.appId);
    }
  }

  function openApp(tile) {
    rememberOpened(tile);
    update({ leftSinceLaunch: false, appOpenedAt: Date.now() });
    L.view.toast('Opening ' + tile.label + '\u2026', LONG_MESSAGE_MS);
    tellHelperAppOpened(tile);
    L.tv
      .launchApp(tile.appId, function (text) {
        L.view.toast(text, LONG_MESSAGE_MS);
      })
      .then(function (result) {
        if (result.preview) {
          previewNotice('open ' + tile.label);
          return;
        }
        reportIfStillHere(tile, result);
      })
      .catch(function (error) {
        console.error('Launch failed', tile.appId, error);
        // The app did come to the front: a late "no answer" from the TV is not a failure.
        if (state.leftSinceLaunch) {
          return;
        }
        L.tv.appStatus(tile.appId).then(function (status) {
          L.view.toast('Could not open ' + tile.label + ' (' + describe(error) + '). App is ' + status + '.', LONG_MESSAGE_MS);
        });
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
    L.sound.select();
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
    if (action === 'control') {
      openControl();
      return;
    }
    if (screen === 'home' && state.pillFocused) {
      if (action === 'select') {
        openControl();
      } else if (action === 'down') {
        setPillFocused(false);
      }
      return;
    }
    if (action === 'select') {
      select(focusedTile());
    } else if (action === 'back') {
      if (screen === 'all') {
        L.sound.back();
        goTo('home');
      }
    } else if (action === 'debug') {
      document.body.classList.toggle('show-ids');
    } else if (screen === 'home') {
      var moved = setFocus('home', L.nav.moveInRows(state.focus.home, action, rowLengths()), action);
      if (!moved && action === 'up') {
        setPillFocused(true);
      }
    } else {
      setFocus('all', L.nav.move(state.focus.all, action, state.allTiles.length, L.config.gridColumns), action);
    }
  }

  function onKeyDown(event) {
    // Any button closes the screensaver, and does nothing else.
    if (L.screensaver.wake()) {
      event.preventDefault();
      return;
    }
    var action = L.nav.actionForKey(event.keyCode);
    if (!action) {
      return;
    }
    if (L.control.isOpen()) {
      event.preventDefault();
      var result = L.control.handle(action);
      if (result === 'moved') {
        L.sound.move();
      } else if (result === 'closed') {
        L.sound.back();
      }
      return;
    }
    if (action === 'back' && state.pillFocused) {
      event.preventDefault();
      setPillFocused(false);
      return;
    }
    // Back on the home screen leaves the launcher, except as the TV's hub ("always home"):
    // there, leaving is done with Exit to TV in Control Center.
    if (action === 'back' && state.screen === 'home' && !state.sourceShowing) {
      if (!alwaysHome()) {
        L.tv.leaveApp();
      }
      return;
    }
    event.preventDefault();
    handleAction(action);
  }

  function setStatus(text) {
    document.getElementById('status').textContent = text;
  }

  function showTiles(rawInstalled, source) {
    var installed = L.apps.normalizeInstalled(rawInstalled, L.config.ownPackage);
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
    update({ installed: installed });
    renderHome();
  }

  function buildHomeRows(allTiles) {
    var recentTiles = L.config.showRecent === false ? [] : L.recent.recentTiles(state.recent, allTiles);
    return [
      { title: 'Recent', size: 'small', tiles: recentTiles },
      { title: 'Apps', size: 'large', tiles: L.apps.pickFavourites(allTiles, L.config.favourites).concat([ALL_APPS_TILE]) },
      { title: 'Inputs', size: 'small', tiles: L.apps.sourceTiles(state.sources) }
    ].filter(function (row) {
      return row.tiles.length > 0;
    });
  }

  // An app can be in two rows (Recent and Apps): look in the row it was in first.
  function findTile(rows, key, rowTitle) {
    var ordered = rows
      .map(function (row, index) {
        return index;
      })
      .sort(function (a, b) {
        return (rows[a].title === rowTitle ? 0 : 1) - (rows[b].title === rowTitle ? 0 : 1) || a - b;
      });
    for (var i = 0; i < ordered.length; i += 1) {
      var tiles = rows[ordered[i]].tiles;
      for (var c = 0; c < tiles.length; c += 1) {
        if (tiles[c].key === key) {
          return { row: ordered[i], col: c };
        }
      }
    }
    return null;
  }

  function appsRowIndex(rows) {
    for (var r = 0; r < rows.length; r += 1) {
      if (rows[r].title === 'Apps') {
        return r;
      }
    }
    return 0;
  }

  /** Rebuilds the rows; the same tile stays focused even when a row is added above it. */
  function renderHome() {
    var previous = focusedTile();
    var previousRow = state.homeRows[state.focus.home.row];
    var allTiles = L.apps.buildTiles(state.installed, L.config.catalog);
    var homeRows = buildHomeRows(allTiles);
    var kept = previous && state.screen === 'home' ? findTile(homeRows, previous.key, previousRow && previousRow.title) : null;
    var start = state.homeFocusPlaced ? state.focus.home : { row: appsRowIndex(homeRows), col: 0 };
    update({ allTiles: allTiles, homeRows: homeRows, homeFocusPlaced: true });
    L.view.renderRows(homeElement(), homeRows);
    L.view.renderGrid(allGrid(), allTiles);
    // Keep the focus valid when the list changes (the real list can arrive later).
    var home = L.nav.moveInRows(kept || start, 'stay', rowLengths());
    var all = Math.min(state.focus.all, Math.max(allTiles.length - 1, 0));
    update({ focus: { home: home, all: all } });
    goTo(state.screen);
  }

  function runTvKey(key, wording) {
    L.tv
      .pressTvKey(key)
      .then(function (result) {
        if (result.preview) {
          previewNotice(wording);
        }
      })
      .catch(function (error) {
        console.error('TV key failed', key, error);
        L.view.toast('Could not ' + wording + ' (' + describe(error) + ').', 15000);
      });
  }

  function controlItems() {
    var inputs = L.apps.sourceTiles(state.sources).map(function (tile, index) {
      return {
        heading: index === 0 ? 'Inputs' : '',
        label: tile.label,
        icon: 'input',
        run: function () {
          openSource(tile);
        }
      };
    });
    // As a TV app there is no way to turn the TV off (use the remote), but sound works.
    var power = L.tv.onTv()
      ? []
      : [{ label: 'Turn Off TV', icon: 'power', run: function () { runTvKey('KEY_POWER', 'turn off the TV'); } }];
    var tvItems = power.concat([
      { label: L.tv.isMuted() ? 'Unmute' : 'Mute', icon: 'mute', run: function () { runTvKey('KEY_MUTE', 'mute the TV'); } }
    ]);
    return [Object.assign({ heading: 'TV' }, tvItems[0])]
      .concat(tvItems.slice(1))
      .concat(inputs)
      .concat([
        { heading: 'My Home', label: 'Screen Saver', icon: 'saver', run: function () { L.screensaver.start(); } },
        { label: 'Reload', icon: 'reload', run: function () { root.location.reload(); } }
      ])
      .concat(!alwaysHome() ? [] : [
        { label: 'Exit to TV', icon: 'exit', run: exitToTv }
      ])
      .concat([
        { heading: 'Theme', label: L.themes.find(state.themeKey).label, icon: 'theme', keepOpen: true, run: nextTheme }
      ]);
  }

  // Theme button: each press shows the next look straight away; the panel stays open.
  function nextTheme() {
    var theme = L.themes.next(state.themeKey);
    update({ themeKey: theme.key });
    saveThemeKey(theme.key);
    L.view.applyTheme(theme);
    L.view.updateHero(focusedTile());
    L.sound.select();
    L.control.refresh(controlItems());
  }

  // Leaves My Home for the TV's own screen; the helper stays quiet until My Home is opened again.
  function exitToTv() {
    update({ exiting: true });
    tellHelper('stop');
    setTimeout(L.tv.leaveApp, 400);
  }

  function openControl() {
    if (state.pillFocused) {
      setPillFocused(false);
    }
    L.sound.select();
    L.control.show(controlItems());
  }

  // Back from an app: the Recent row now includes it.
  function onVisibilityChange() {
    tellHelper(document.hidden ? 'back' : 'front');
    if (!document.hidden) {
      update({ exiting: false, appOpenedAt: 0 });
    }
    if (document.hidden) {
      update({ leftSinceLaunch: true });
    } else {
      // Coming back from an app: no leftover "Opening..." message.
      L.view.hideToast();
    }
    if (!document.hidden && state.homeRows.length > 0) {
      renderHome();
      refreshSources();
      keepBlankFallback();
    }
  }

  var HOME_BAR_CHECK_MS = 120;
  var APP_OPENING_MS = 20000;

  // While an app My Home just opened is loading, My Home has lost the remote but is still
  // on screen: that is not Samsung's bar.
  function openingApp() {
    return Date.now() - state.appOpenedAt < APP_OPENING_MS;
  }

  // Samsung's Home bar opened over My Home (the page stays on screen but loses the
  // remote): as the TV's hub, come straight back in front. Apps cannot receive the Home
  // button itself.
  function onLostRemote() {
    if (!alwaysHome() || !L.config.homeButtonStaysHome || state.exiting || openingApp()) {
      return;
    }
    setTimeout(function () {
      if (document.hidden || document.hasFocus() || state.exiting || openingApp()) {
        return;
      }
      // Through the helper: asked from the page itself, the TV reloads My Home.
      tellHelper('bar');
    }, HOME_BAR_CHECK_MS);
  }

  // Keeps the TV from falling back to its live channel when an app closes (see tv.js).
  function keepBlankFallback() {
    if (!alwaysHome() || !L.config.blankFallback || state.sourceShowing) {
      return;
    }
    L.tv.useBlankFallback().catch(function (error) {
      console.error('Could not set the empty input as fallback', error);
    });
  }

  // Only inputs with something plugged in get a tile.
  function refreshSources() {
    L.tv
      .connectedSources(L.config.sources)
      .then(function (sources) {
        if (sources.length === state.sources.length) {
          return;
        }
        update({ sources: sources });
        if (state.homeRows.length > 0) {
          renderHome();
        }
      })
      .catch(function (error) {
        console.error('Could not read the connected inputs', error);
      });
  }

  // Inside TizenBrew: ask the TV's remote-control service for the real app list.
  // The first time, the TV asks whether to allow "My Home".
  function loadRealAppsOverRemote() {
    L.view.toast('If the TV asks to allow "My Home", choose Allow.', 12000);
    L.tv
      .installedOverRemote()
      .then(function (raw) {
        var count = L.apps.normalizeInstalled(raw, L.config.ownPackage).length;
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
    L.view.applyTheme(L.themes.find(state.themeKey));
    L.view.updateClock(L.config.locale);
    setInterval(function () {
      L.view.updateClock(L.config.locale);
    }, CLOCK_REFRESH_MS);
    if (L.config.welcomeMessage) {
      L.view.showWelcome(L.config.welcomeMessage, WELCOME_MS);
    }
    L.tv.registerKeys(L.config.remoteKeys);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('visibilitychange', onVisibilityChange);
    root.addEventListener('blur', onLostRemote);
    L.screensaver.init(function () {
      return !state.sourceShowing && !L.control.isOpen();
    });
    if (L.config.showDebug) {
      document.body.classList.add('show-ids');
    }

    L.tv
      .listInstalled(L.config.catalog)
      .then(function (raw) {
        showTiles(raw, L.tv.onTv() ? 'tv' : 'builtin');
        tellHelper('front');
        refreshSources();
        keepBlankFallback();
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
