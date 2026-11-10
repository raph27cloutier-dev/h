'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const apps = require('../app/apps.js');

const CATALOG = [
  { key: 'netflix', label: 'Netflix', match: 'netflix', color: '#e50914', fallbackId: 'org.tizen.netflix-app' },
  { key: 'youtube', label: 'YouTube', match: 'youtube', color: '#ff0000', fallbackId: 'yt.id' },
  { key: 'crave', label: 'Crave', match: 'crave', color: '#00a3e0' }
];

test('normalizeInstalled keeps valid visible apps only', () => {
  const raw = [
    { id: 'AbCdEf1234.Netflix', name: 'Netflix', iconPath: '/x/icon.png', show: true },
    { id: 'svc.hidden', name: 'Some Service', show: false },
    { id: '', name: 'No id' },
    { id: 'no.name' },
    null,
    'garbage'
  ];
  assert.deepEqual(apps.normalizeInstalled(raw), [
    { id: 'AbCdEf1234.Netflix', name: 'Netflix', iconPath: '/x/icon.png' }
  ]);
});

test('normalizeInstalled returns an empty list for non-arrays', () => {
  assert.deepEqual(apps.normalizeInstalled(undefined), []);
  assert.deepEqual(apps.normalizeInstalled({}), []);
});

test('normalizeInstalled does not modify its input', () => {
  const raw = [{ id: 'a', name: 'A', show: true }];
  const copy = JSON.parse(JSON.stringify(raw));
  apps.normalizeInstalled(raw);
  assert.deepEqual(raw, copy);
});

test('buildTiles decorates installed apps from the catalog and sorts by name', () => {
  const installed = [
    { id: 'z.app', name: 'Zed Player', iconPath: '' },
    { id: 'a.netflix', name: 'Netflix', iconPath: '/n.png' }
  ];
  const tiles = apps.buildTiles(installed, CATALOG);
  assert.deepEqual(tiles.map((t) => t.label), ['Netflix', 'Zed Player']);
  assert.equal(tiles[0].key, 'netflix');
  assert.equal(tiles[0].color, '#e50914');
  assert.equal(tiles[0].appId, 'a.netflix');
  assert.equal(tiles[0].type, 'app');
  assert.equal(tiles[1].key, 'z.app');
  assert.equal(typeof tiles[1].color, 'string');
});

test('buildTiles carries the catalog text colour, defaulting to white', () => {
  const catalog = [{ key: 'netflix', label: 'Netflix', match: 'netflix', color: '#141414', text: '#e50914', fallbackId: 'n' }];
  const installed = [
    { id: 'a.netflix', name: 'Netflix', iconPath: '' },
    { id: 'other', name: 'Other', iconPath: '' }
  ];
  const tiles = apps.buildTiles(installed, catalog);
  assert.equal(tiles[0].text, '#e50914');
  assert.equal(tiles[1].text, '#ffffff');
  assert.equal(apps.buildTiles([], catalog)[0].text, '#e50914');
});

test('buildTiles carries the catalog logo; other apps have none', () => {
  const catalog = [{ key: 'netflix', label: 'Netflix', match: 'netflix', color: '#141414', logo: 'logos/netflix.svg', fallbackId: 'n' }];
  const installed = [
    { id: 'a.netflix', name: 'Netflix', iconPath: '' },
    { id: 'other', name: 'Other', iconPath: '' }
  ];
  const tiles = apps.buildTiles(installed, catalog);
  assert.equal(tiles[0].logo, 'logos/netflix.svg');
  assert.equal(tiles[1].logo, '');
  assert.equal(apps.buildTiles([], catalog)[0].logo, 'logos/netflix.svg');
});

test('buildTiles gives a catalog entry to one app only; look-alikes keep their own name', () => {
  const installed = [
    { id: 'kids.netflix', name: 'Netflix Kids', iconPath: '' },
    { id: 'a.netflix', name: 'Netflix', iconPath: '' }
  ];
  const tiles = apps.buildTiles(installed, CATALOG);
  assert.deepEqual(tiles.map((t) => [t.key, t.label, t.appId]), [
    ['netflix', 'Netflix', 'a.netflix'],
    ['kids.netflix', 'Netflix Kids', 'kids.netflix']
  ]);
});

test('buildTiles matches catalog names case-insensitively', () => {
  const tiles = apps.buildTiles([{ id: 'yt', name: 'YOUTUBE TV', iconPath: '' }], CATALOG);
  assert.equal(tiles[0].key, 'youtube');
});

test('buildTiles falls back to catalog entries that have an id when nothing is installed', () => {
  const tiles = apps.buildTiles([], CATALOG);
  assert.deepEqual(tiles.map((t) => t.key), ['netflix', 'youtube']);
  assert.equal(tiles[0].appId, 'org.tizen.netflix-app');
});

test('pickFavourites follows the configured order and skips missing apps', () => {
  const tiles = apps.buildTiles([], CATALOG);
  const favourites = apps.pickFavourites(tiles, ['youtube', 'crave', 'netflix']);
  assert.deepEqual(favourites.map((t) => t.key), ['youtube', 'netflix']);
});

test('sourceTiles turns configured inputs into tiles', () => {
  const tiles = apps.sourceTiles([{ label: 'PlayStation', type: 'HDMI', number: 2 }]);
  assert.deepEqual(tiles, [
    { key: 'source-HDMI-2', label: 'PlayStation', type: 'source', color: '#3a3a3c',
      source: { type: 'HDMI', number: 2 } }
  ]);
});

test('initials gives a short wordmark fallback', () => {
  assert.equal(apps.initials('Zed Player'), 'ZP');
  assert.equal(apps.initials('netflix'), 'N');
  assert.equal(apps.initials(''), '?');
});

test('accentFor uses the tile colour, or its text colour when the tile is very light', () => {
  assert.equal(apps.accentFor({ color: '#e50914', text: '#ffffff' }), '#e50914');
  assert.equal(apps.accentFor({ color: '#ffffff', text: '#ff0000' }), '#ff0000');
  assert.equal(apps.accentFor({ color: '#f5f5f5' }), '#8e8e93');
  assert.equal(apps.accentFor({}), '#8e8e93');
  assert.equal(apps.accentFor({ color: 'red' }), '#8e8e93');
});

test('accentFor uses the text colour when the tile is almost black (Netflix, Spotify)', () => {
  assert.equal(apps.accentFor({ color: '#141414', text: '#e50914' }), '#e50914');
  assert.equal(apps.accentFor({ color: '#000000', text: '#ffffff' }), '#8e8e93');
  assert.equal(apps.accentFor({ color: '#121212' }), '#8e8e93');
});

test('isUserApp keeps store apps and built-in apps, drops the TV\'s internal parts', () => {
  const keep = (id, name) => apps.isUserApp({ id, name }, 'MyHomeTv01');
  assert.equal(keep('9Ur5IzDKqV.TizenYouTube', 'YouTube'), true);
  assert.equal(keep('org.tizen.netflix-app', 'Netflix'), true);
  assert.equal(keep('com.samsung.tv.aria-video', 'Apple TV'), true);
  assert.equal(keep('com.samsung.tv.aria-dummy', 'Apple TV'), false);
  assert.equal(keep('org.tizen.ep-hotel-alarm', 'EP Hotel Alarm'), false);
  assert.equal(keep('rJeHak5zRg.SpotifyService', 'SpotifyRecomendationsService'), false);
  assert.equal(keep('IohB833qj0.service', 'service'), false);
  assert.equal(keep('MyHomeTv01.MyHome', 'My Home'), false);
  assert.equal(keep('3201907018807', 'Netflix'), true);
  assert.equal(keep('preview.netflix', 'Netflix'), true);
});
