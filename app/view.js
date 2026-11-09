/* Builds and updates the page. All text goes in through textContent, never innerHTML. */
(function (root) {
  'use strict';

  var apps = root.Launcher.apps;

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
    if (tile.type === 'app' && tile.iconPath) {
      addIcon(art, tile);
    }
    node.appendChild(art);
    node.appendChild(element('div', 'tile-label', tile.label));
    if (tile.appId) {
      node.appendChild(element('div', 'tile-id', tile.appId));
    }
    return node;
  }

  /** Replaces the contents of `container` with one node per tile. */
  function renderGrid(container, tiles) {
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    tiles.forEach(function (tile) {
      container.appendChild(createTile(tile));
    });
  }

  function setFocus(container, index) {
    var nodes = container.children;
    for (var i = 0; i < nodes.length; i += 1) {
      nodes[i].classList.toggle('is-focused', i === index);
    }
    if (nodes[index] && nodes[index].scrollIntoView) {
      nodes[index].scrollIntoView({ block: 'nearest' });
    }
  }

  function showScreen(name) {
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i += 1) {
      screens[i].classList.toggle('is-active', screens[i].getAttribute('data-screen') === name);
    }
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

  root.Launcher.view = {
    renderGrid: renderGrid,
    setFocus: setFocus,
    showScreen: showScreen,
    updateClock: updateClock,
    toast: toast
  };
})(window);
