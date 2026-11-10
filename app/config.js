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
    gridColumns: 8,

    // Come back to My Home when the app it opened is closed (TV app only).
    returnHome: true,

    // TESTING ONLY: lets a computer on the home network read the helper's log on port 8765.
    // Set to false once coming back to My Home works.
    helperStatusPage: true,

    // Extra remote buttons My Home listens to when installed as a TV app.
    remoteKeys: ['MediaPlayPause', 'ColorF0Red'],

    // Where the TV's own control service is reached from the launcher, tried in order.
    // 127.0.0.1 is the TV itself; the second is this TV's address on your home network
    // (change it if your router gives the TV a different one).
    controlHosts: ['127.0.0.1', '192.168.2.16'],

    // Shows which app list is used and each app's id under its tile. Set to false when everything works.
    showDebug: false,

    // Minutes without a button press before the aerial screensaver starts (0 turns it off).
    screensaverMinutes: 5,

    // Soft click sounds when moving between tiles, like Apple TV.
    sounds: true,

    // Row of the apps you opened last, above your favourites.
    showRecent: true,

    // Home screen apps, in order. Use the `key` values from the catalog below.
    // Apps that are not installed on the TV are skipped automatically.
    favourites: ['netflix', 'youtube', 'disney', 'prime', 'crave', 'toutv', 'appletv', 'spotify'],

    // Input tiles. Rename the labels to what is plugged in ("PlayStation", "Cable box"...).
    sources: [
      { label: 'HDMI 1', type: 'HDMI', number: 1 },
      { label: 'HDMI 2', type: 'HDMI', number: 2 },
      { label: 'HDMI 3', type: 'HDMI', number: 3 }
    ],

    // Known apps. An installed app whose name contains `match` gets this label, colour and logo
    // (`logo` is a file in app/logos; apps without one show their name instead).
    // More specific names must come before general ones (YouTube Kids before YouTube).
    // `fallbackId` is the id the TV opens. Verified on your Q80T: Netflix, YouTube, Disney+,
    // Prime Video, Spotify, Apple TV. Crave and Tou.tv have no id yet, so they are hidden.
    catalog: [
      { key: 'netflix', label: 'Netflix', match: 'netflix', color: '#141414', text: '#e50914', fallbackId: '3201907018807', logo: 'logos/netflix.svg' },
      { key: 'youtubekids', label: 'YouTube Kids', match: 'youtube kids', color: '#ffffff', text: '#ff0000' },
      { key: 'youtubemusic', label: 'YouTube Music', match: 'youtube music', color: '#141414', text: '#ff0000' },
      { key: 'youtubetv', label: 'YouTube TV', match: 'youtube tv', color: '#ffffff', text: '#ff0000' },
      { key: 'youtube', label: 'YouTube', match: 'youtube', color: '#ffffff', text: '#ff0000', fallbackId: '111299001912', logo: 'logos/youtube.svg' },
      { key: 'disney', label: 'Disney+', match: 'disney', color: '#0e2a6e', text: '#ffffff', fallbackId: '3201901017640', logo: 'logos/disney.svg' },
      { key: 'prime', label: 'Prime Video', match: 'prime video', color: '#0f79af', text: '#ffffff', fallbackId: '3201910019365', logo: 'logos/prime.svg' },
      { key: 'crave', label: 'Crave', match: 'crave', color: '#0c1c2c', text: '#00c8ff', fallbackId: '3201506003488' },
      { key: 'toutv', label: 'Tou.tv', match: 'tou.tv', color: '#101820', text: '#ffffff' },
      { key: 'applemusic', label: 'Apple Music', match: 'apple music', color: '#fa2d48', text: '#ffffff', fallbackId: '3201908019041', logo: 'logos/applemusic.svg' },
      { key: 'appletv', label: 'Apple TV', match: 'apple tv', color: '#000000', text: '#ffffff', fallbackId: '3201807016597', logo: 'logos/appletv.svg' },
      { key: 'spotify', label: 'Spotify', match: 'spotify', color: '#121212', text: '#1ed760', fallbackId: '3201606009684', logo: 'logos/spotify.svg' },
      { key: 'plex', label: 'Plex', match: 'plex', color: '#1f2326', text: '#e5a00d', logo: 'logos/plex.svg' },
      { key: 'twitch', label: 'Twitch', match: 'twitch', color: '#9146ff', text: '#ffffff', logo: 'logos/twitch.svg' },
      { key: 'browser', label: 'Internet', match: 'internet', color: '#2c2c2e', text: '#ffffff' }
    ]
  };
})(typeof window !== 'undefined' ? window : this);
