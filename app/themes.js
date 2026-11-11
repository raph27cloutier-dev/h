/*
 * THEMES: the looks My Home can wear. Pick one in Control Center (Theme button).
 * To add one: copy a block, change the key, name and colours, then run
 * `python3 scripts/make-hero-masks.py` to draw its banner glow image.
 *
 * Only colours, corner roundness and font change: the TV is too slow for blur,
 * shadows or gradients (see styles.css).
 */
(function (root) {
  'use strict';

  var SYSTEM_FONT = "-apple-system, 'SF Pro Display', 'Helvetica Neue', 'Samsung One', Arial, sans-serif";
  var MONO_FONT = "'Courier New', Courier, monospace";

  // bg: page background. accent: ring around the selected tile and selected buttons.
  // accentInk: icon colour on a selected button. panel / glassSolid: Control Center.
  // heroColor: banner glow colour ('' uses the selected app's own colour).
  var list = [
    {
      key: 'classic',
      label: 'Classic',
      bg: '#05060a',
      accent: '#ffffff',
      accentInk: '#000000',
      panel: '#101116',
      glassSolid: '#28282f',
      heroColor: '',
      radius: '1.5vw',
      gridRadius: '22.5%',
      font: SYSTEM_FONT,
      mask: 'hero-mask.png'
    },
    {
      key: 'midnight',
      label: 'Midnight',
      bg: '#000000',
      accent: '#00e5ff',
      accentInk: '#000000',
      panel: '#08090c',
      glassSolid: '#15171c',
      heroColor: '',
      radius: '1.5vw',
      gridRadius: '22.5%',
      font: SYSTEM_FONT,
      mask: 'hero-mask-midnight.png'
    },
    {
      key: 'habs',
      label: 'Habs',
      bg: '#0a1033',
      accent: '#ff2d43',
      accentInk: '#ffffff',
      panel: '#0e1642',
      glassSolid: '#1b2566',
      heroColor: '#af1e2d',
      radius: '1.5vw',
      gridRadius: '22.5%',
      font: SYSTEM_FONT,
      mask: 'hero-mask-habs.png'
    },
    {
      key: 'arcade',
      label: 'Arcade',
      bg: '#140028',
      accent: '#ffe600',
      accentInk: '#000000',
      panel: '#1c0038',
      glassSolid: '#2e0a55',
      heroColor: '',
      radius: '0.3vw',
      gridRadius: '8%',
      font: MONO_FONT,
      mask: 'hero-mask-arcade.png'
    }
  ];

  function indexOfKey(key) {
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].key === key) {
        return i;
      }
    }
    return -1;
  }

  /** The theme with this key; anything unknown gives the first (classic) theme. */
  function find(key) {
    var index = indexOfKey(key);
    return list[index === -1 ? 0 : index];
  }

  /** The theme after this one, going round to the first after the last. */
  function next(key) {
    var index = Math.max(0, indexOfKey(key));
    return list[(index + 1) % list.length];
  }

  /** The page's CSS variables for a theme, as a new object. */
  function cssVariables(theme) {
    return {
      '--bg': theme.bg,
      '--accent': theme.accent,
      '--accent-ink': theme.accentInk,
      '--panel': theme.panel,
      '--glass-solid': theme.glassSolid,
      '--radius': theme.radius,
      '--radius-grid': theme.gridRadius,
      '--font': theme.font
    };
  }

  var api = { list: list, find: find, next: next, cssVariables: cssVariables };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.Launcher = root.Launcher || {};
    root.Launcher.themes = api;
  }
})(typeof window !== 'undefined' ? window : this);
