/*
 * YOUR SETTINGS. This is the only file you need to edit to change the home screen.
 */
(function (root) {
  'use strict';

  root.Launcher = root.Launcher || {};

  root.Launcher.config = {
    // Clock language and format.
    locale: 'en-CA',

    // Tiles per row.
    gridColumns: 6,

    // Home screen apps, in order. Use the `key` values from the catalog below.
    // Apps that are not installed on the TV are skipped automatically.
    favourites: ['netflix', 'youtube', 'disney', 'prime', 'crave', 'toutv', 'appletv', 'spotify'],

    // Input tiles. Rename the labels to what is plugged in ("PlayStation", "Cable box"...).
    sources: [
      { label: 'HDMI 1', type: 'HDMI', number: 1 },
      { label: 'HDMI 2', type: 'HDMI', number: 2 },
      { label: 'HDMI 3', type: 'HDMI', number: 3 }
    ],

    // Known apps. An installed app whose name contains `match` gets this label and colour.
    // More specific names must come before general ones (YouTube Kids before YouTube).
    // `fallbackId` is only used if the TV refuses to give its app list; these ids are
    // best guesses and have not been checked on your TV.
    catalog: [
      { key: 'netflix', label: 'Netflix', match: 'netflix', color: '#141414', text: '#e50914', fallbackId: 'org.tizen.netflix-app' },
      { key: 'youtubekids', label: 'YouTube Kids', match: 'youtube kids', color: '#ffffff', text: '#ff0000' },
      { key: 'youtubemusic', label: 'YouTube Music', match: 'youtube music', color: '#141414', text: '#ff0000' },
      { key: 'youtubetv', label: 'YouTube TV', match: 'youtube tv', color: '#ffffff', text: '#ff0000' },
      { key: 'youtube', label: 'YouTube', match: 'youtube', color: '#ffffff', text: '#ff0000', fallbackId: '9Ur5IzDKqV.TizenYouTube' },
      { key: 'disney', label: 'Disney+', match: 'disney', color: '#0b1a4a', text: '#ffffff', fallbackId: 'MCmYXNxgcu.DisneyPlus' },
      { key: 'prime', label: 'Prime Video', match: 'prime video', color: '#0f79af', text: '#ffffff', fallbackId: 'org.tizen.primevideo' },
      { key: 'crave', label: 'Crave', match: 'crave', color: '#0c1c2c', text: '#00c8ff' },
      { key: 'toutv', label: 'Tou.tv', match: 'tou.tv', color: '#101820', text: '#ffffff' },
      { key: 'applemusic', label: 'Apple Music', match: 'apple music', color: '#fa2d48', text: '#ffffff' },
      { key: 'appletv', label: 'Apple TV', match: 'apple tv', color: '#000000', text: '#ffffff' },
      { key: 'spotify', label: 'Spotify', match: 'spotify', color: '#121212', text: '#1ed760', fallbackId: 'rJeHak5zRg.Spotify' },
      { key: 'plex', label: 'Plex', match: 'plex', color: '#1f2326', text: '#e5a00d' },
      { key: 'twitch', label: 'Twitch', match: 'twitch', color: '#9146ff', text: '#ffffff' },
      { key: 'browser', label: 'Internet', match: 'internet', color: '#2c2c2e', text: '#ffffff', fallbackId: 'org.tizen.browser' }
    ]
  };
})(typeof window !== 'undefined' ? window : this);
