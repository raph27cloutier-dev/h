/*
 * Control Center: a panel on the right, like Apple TV, with quick actions.
 * The items and what they do come from main.js; this file draws and navigates.
 */
(function (root) {
  'use strict';

  var L = root.Launcher;
  var open = false;
  var items = [];
  var index = 0;

  function panel() {
    return document.getElementById('control');
  }

  function list() {
    return document.getElementById('control-items');
  }

  var SVG_NS = 'http://www.w3.org/2000/svg';
  // Simple line icons (24 x 24), drawn with SVG so the TV needs no icon font.
  var ICONS = {
    power: ['M12 3v9', 'M6.3 6.3a8 8 0 1 0 11.4 0'],
    mute: ['M4 9h4l5-4v14l-5-4H4z', 'M16 9l5 6', 'M21 9l-5 6'],
    input: ['M3 5h18v12H3z', 'M8 21h8', 'M12 17v4'],
    saver: ['M2 19l7-9 5 6 3-4 5 7z', 'M17 5a2 2 0 1 0 0.01 0'],
    reload: ['M20 12a8 8 0 1 1-2.3-5.7', 'M20 4v5h-5']
  };

  function icon(name) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'control-icon');
    (ICONS[name] || []).forEach(function (d) {
      var path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', d);
      svg.appendChild(path);
    });
    return svg;
  }

  function render() {
    var container = list();
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    items.forEach(function (item, i) {
      if (item.heading) {
        var heading = document.createElement('div');
        heading.className = 'control-heading';
        heading.textContent = item.heading;
        container.appendChild(heading);
      }
      var node = document.createElement('div');
      node.className = 'control-item' + (i === index ? ' is-focused' : '');
      node.appendChild(icon(item.icon));
      var label = document.createElement('span');
      label.className = 'control-label';
      label.textContent = item.label;
      node.appendChild(label);
      container.appendChild(node);
    });
  }

  function updateClock() {
    var now = new Date();
    document.getElementById('control-time').textContent = now.toLocaleTimeString(L.config.locale, {
      hour: 'numeric',
      minute: '2-digit'
    });
    document.getElementById('control-date').textContent = now.toLocaleDateString(L.config.locale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  }

  /** `entries`: [{label, icon, heading?, run()}]. */
  function show(entries) {
    items = entries.slice();
    index = 0;
    open = true;
    updateClock();
    render();
    panel().classList.add('is-visible');
    document.body.classList.add('control-open');
  }

  function hide() {
    open = false;
    panel().classList.remove('is-visible');
    document.body.classList.remove('control-open');
  }

  /** Handles a remote action while the panel is open. Returns 'moved', 'ran', 'closed' or ''. */
  function handle(action) {
    if (action === 'back' || action === 'control' || action === 'left') {
      hide();
      return 'closed';
    }
    if (action === 'up' || action === 'down') {
      var next = L.nav.move(index, action, items.length, 1);
      if (next === index) {
        return '';
      }
      index = next;
      render();
      return 'moved';
    }
    if (action === 'select' && items[index]) {
      var item = items[index];
      hide();
      item.run();
      return 'ran';
    }
    return '';
  }

  L.control = {
    show: show,
    hide: hide,
    handle: handle,
    isOpen: function () {
      return open;
    }
  };
})(window);
