/* Builds and updates the page. All text goes in through textContent, never innerHTML. */
(function (root) {
  'use strict';

  var apps = root.Launcher.apps;
  var ROW_EDGE_PADDING_VW = 5.5;
  // The TV caches files for a week; bump with each release that changes a logo.
  var LOGO_VERSION = '?v=21';

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text !== undefined) {
      node.textContent = text;
    }
    return node;
  }

  function clear(node) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function iconUrl(iconPath) {
    return iconPath.charAt(0) === '/' ? 'file://' + iconPath : iconPath;
  }

  function addIcon(art, tile) {
    var image = element('img', 'tile-icon');
    image.alt = '';
    image.onload = function () {
      art.classList.add('has-icon');
    };
    image.onerror = function () {
      // The TV would not serve the icon: keep the coloured wordmark instead.
      if (image.parentNode) {
        image.parentNode.removeChild(image);
      }
    };
    image.src = iconUrl(tile.iconPath);
    art.appendChild(image);
  }

  /** Real brand logo from app/logos; if it fails to load, the name stays visible. */
  function addLogo(art, tile) {
    var image = element('img', 'tile-logo');
    image.alt = '';
    image.onload = function () {
      art.classList.add('has-logo');
    };
    image.onerror = function () {
      if (image.parentNode) {
        image.parentNode.removeChild(image);
      }
    };
    image.src = tile.logo + LOGO_VERSION;
    art.appendChild(image);
  }

  function wordmarkFor(tile) {
    if (tile.type === 'all') {
      return '';
    }
    return tile.label.length > 14 ? apps.initials(tile.label) : tile.label;
  }

  function createTile(tile) {
    var node = element('div', 'tile tile-' + tile.type);
    var art = element('div', 'tile-art');
    art.style.backgroundColor = tile.color;
    if (tile.text) {
      art.style.color = tile.text;
    }
    art.appendChild(element('span', 'tile-wordmark', wordmarkFor(tile)));
    if (tile.type === 'app' && tile.logo) {
      addLogo(art, tile);
    } else if (tile.type === 'app' && tile.iconPath) {
      addIcon(art, tile);
    }
    art.appendChild(element('span', 'tile-shine'));
    node.appendChild(art);
    node.appendChild(element('div', 'tile-label', tile.label));
    if (tile.appId) {
      node.appendChild(element('div', 'tile-id', tile.appId));
    }
    return node;
  }

  /** Grid screen (All Apps): one node per tile. */
  function renderGrid(container, tiles) {
    clear(container);
    tiles.forEach(function (tile) {
      container.appendChild(createTile(tile));
    });
  }

  /** Home screen: one titled, horizontally scrolling row per entry of `rows`. */
  function renderRows(container, rows) {
    clear(container);
    rows.forEach(function (row) {
      var section = element('section', 'row row-' + (row.size || 'large'));
      section.appendChild(element('h2', 'row-title', row.title));
      var viewport = element('div', 'row-viewport');
      var track = element('div', 'row-track');
      row.tiles.forEach(function (tile) {
        track.appendChild(createTile(tile));
      });
      viewport.appendChild(track);
      section.appendChild(viewport);
      container.appendChild(section);
    });
  }

  var NUDGES = ['nudge-left', 'nudge-right', 'nudge-up', 'nudge-down'];

  /** Focus ring on one tile; the newly focused tile tilts towards the move, like tvOS. */
  function markFocus(node, focused, direction) {
    var wasFocused = node.classList.contains('is-focused');
    node.classList.toggle('is-focused', focused);
    if (!focused || wasFocused) {
      if (!focused) {
        NUDGES.forEach(function (name) {
          node.classList.remove(name);
        });
      }
      return;
    }
    if (direction && NUDGES.indexOf('nudge-' + direction) !== -1) {
      node.classList.add('nudge-' + direction);
    }
  }

  function setFocus(container, index, direction) {
    var nodes = container.children;
    for (var i = 0; i < nodes.length; i += 1) {
      markFocus(nodes[i], i === index, direction);
    }
    if (nodes[index] && nodes[index].scrollIntoView) {
      nodes[index].scrollIntoView(false);
    }
  }

  /** Slides a row so its focused tile stays on screen, like the tvOS dock. */
  function scrollRowTo(viewport, track, tileNode) {
    var padding = (root.innerWidth * ROW_EDGE_PADDING_VW) / 100;
    var shift = Number(track.getAttribute('data-shift')) || 0;
    var left = tileNode.offsetLeft;
    var right = left + tileNode.offsetWidth;
    var visibleWidth = viewport.clientWidth;
    if (right - shift > visibleWidth - padding) {
      shift = right - (visibleWidth - padding);
    }
    if (left - shift < padding) {
      shift = left - padding;
    }
    shift = Math.max(0, shift);
    track.setAttribute('data-shift', String(shift));
    track.style.transform = 'translateX(' + -shift + 'px)';
  }

  function setRowFocus(container, position, direction) {
    var rows = container.children;
    for (var r = 0; r < rows.length; r += 1) {
      var viewport = rows[r].querySelector('.row-viewport');
      var track = rows[r].querySelector('.row-track');
      rows[r].classList.toggle('is-active', r === position.row);
      for (var c = 0; c < track.children.length; c += 1) {
        var focused = r === position.row && c === position.col;
        markFocus(track.children[c], focused, direction);
        if (focused) {
          scrollRowTo(viewport, track, track.children[c]);
        }
      }
    }
  }

  function heroSubtitle(tile) {
    if (tile.type === 'source') {
      return 'Switch to ' + tile.label;
    }
    if (tile.type === 'all') {
      return 'Every app on your TV';
    }
    return 'Press OK to open';
  }

  /** Big logo in the banner, or the app name when there is no logo (or it fails). */
  function showHeroLogo(layer, logo) {
    var text = layer.querySelector('.hero-text');
    var old = layer.querySelector('.hero-logo');
    if (old) {
      old.parentNode.removeChild(old);
    }
    text.classList.remove('has-logo');
    if (!logo) {
      return;
    }
    var image = element('img', 'hero-logo');
    image.alt = '';
    image.onload = function () {
      text.classList.add('has-logo');
    };
    image.onerror = function () {
      if (image.parentNode) {
        image.parentNode.removeChild(image);
      }
      text.classList.remove('has-logo');
    };
    image.src = logo + LOGO_VERSION;
    text.insertBefore(image, text.firstChild);
  }

  var heroFront = 0;
  var heroKey = null;

  /** Crossfades the big banner at the top to the focused tile. */
  function updateHero(tile) {
    if (!tile || tile.key === heroKey) {
      return;
    }
    heroKey = tile.key;
    var layers = document.querySelectorAll('.hero-layer');
    if (layers.length < 2) {
      return;
    }
    heroFront = 1 - heroFront;
    var next = layers[heroFront];
    var accent = apps.accentFor(tile);
    // A plain colour; the glow shape comes from the pre-drawn image above it (see styles.css).
    next.style.backgroundColor = accent;
    var title = next.querySelector('.hero-title');
    title.textContent = tile.type === 'all' ? 'All Apps' : tile.label;
    title.style.color = tile.type === 'app' && tile.text ? tile.text : '#ffffff';
    showHeroLogo(next, tile.type === 'app' ? tile.logo : '');
    next.querySelector('.hero-subtitle').textContent = heroSubtitle(tile);
    layers[heroFront].classList.add('is-visible');
    layers[1 - heroFront].classList.remove('is-visible');
  }

  function showScreen(name) {
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i += 1) {
      screens[i].classList.toggle('is-active', screens[i].getAttribute('data-screen') === name);
    }
    document.body.setAttribute('data-screen', name);
  }

  function greeting(hour) {
    if (hour < 5) {
      return 'Good night';
    }
    if (hour < 12) {
      return 'Good morning';
    }
    if (hour < 18) {
      return 'Good afternoon';
    }
    return 'Good evening';
  }

  function updateClock(locale) {
    var now = new Date();
    document.getElementById('clock-time').textContent = now.toLocaleTimeString(locale, {
      hour: 'numeric',
      minute: '2-digit'
    });
    document.getElementById('clock-date').textContent = now.toLocaleDateString(locale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
    document.getElementById('greeting').textContent = greeting(now.getHours());
  }

  var toastTimer = null;

  function toast(message, durationMs) {
    var node = document.getElementById('toast');
    node.textContent = message;
    node.classList.add('is-visible');
    if (toastTimer) {
      clearTimeout(toastTimer);
    }
    toastTimer = setTimeout(function () {
      node.classList.remove('is-visible');
    }, durationMs || 3500);
  }

  function hideToast() {
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    document.getElementById('toast').classList.remove('is-visible');
  }

  var WELCOME_FADE_MS = 500;

  /** Full-screen message when My Home opens; goes away by itself after `durationMs`. */
  function showWelcome(message, durationMs) {
    var node = document.getElementById('welcome');
    document.getElementById('welcome-text').textContent = message;
    node.classList.add('is-visible');
    setTimeout(function () {
      node.classList.add('is-leaving');
      // Removed afterwards so it costs the TV nothing while browsing.
      setTimeout(function () {
        node.classList.remove('is-visible', 'is-leaving');
      }, WELCOME_FADE_MS);
    }, durationMs);
  }

  /** The Control Center button next to the clock. */
  function setPillFocus(focused) {
    document.getElementById('control-pill').classList.toggle('is-focused', focused);
    document.body.classList.toggle('pill-focused', focused);
  }

  root.Launcher.view = {
    setPillFocus: setPillFocus,
    renderGrid: renderGrid,
    renderRows: renderRows,
    setFocus: setFocus,
    setRowFocus: setRowFocus,
    updateHero: updateHero,
    showScreen: showScreen,
    updateClock: updateClock,
    toast: toast,
    hideToast: hideToast,
    showWelcome: showWelcome
  };
})(window);
