'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const recent = require('../app/recent.js');
const aerials = require('../app/aerials.js');

test('parseRecent keeps unique non-empty strings and survives bad data', () => {
  assert.deepEqual(recent.parseRecent('["netflix","youtube","netflix","",3]'), ['netflix', 'youtube']);
  assert.deepEqual(recent.parseRecent('not json'), []);
  assert.deepEqual(recent.parseRecent(null), []);
  assert.deepEqual(recent.parseRecent('{"a":1}'), []);
});

test('addRecent puts the app first, removes the old copy and caps the length', () => {
  const list = ['a', 'b', 'c'];
  assert.deepEqual(recent.addRecent(list, 'c', 5), ['c', 'a', 'b']);
  assert.deepEqual(recent.addRecent(list, 'd', 3), ['d', 'a', 'b']);
  assert.deepEqual(list, ['a', 'b', 'c']);
});

test('recentTiles maps keys to tiles in order and skips unknown apps', () => {
  const tiles = [{ key: 'netflix' }, { key: 'youtube' }];
  assert.deepEqual(recent.recentTiles(['youtube', 'gone', 'netflix'], tiles), [{ key: 'youtube' }, { key: 'netflix' }]);
});

test('aerial list is not empty and every entry has a place, a time and an http url', () => {
  assert.ok(aerials.list.length > 10);
  aerials.list.forEach((item) => {
    assert.equal(typeof item.place, 'string');
    assert.ok(item.time === 'day' || item.time === 'night');
    assert.match(item.url, /^http:\/\/a1\.phobos\.apple\.com\/.+\.mov$/);
  });
});

test('pickAerial prefers night videos at night and day videos by day', () => {
  const list = [
    { place: 'A', time: 'day', url: 'a' },
    { place: 'B', time: 'night', url: 'b' },
    { place: 'C', time: 'night', url: 'c' }
  ];
  assert.equal(aerials.pickAerial(list, 23, '', () => 0).time, 'night');
  assert.equal(aerials.pickAerial(list, 2, '', () => 0.99).time, 'night');
  assert.equal(aerials.pickAerial(list, 12, '', () => 0.5).url, 'a');
});

test('pickAerial avoids repeating the previous video when it can', () => {
  const list = [
    { place: 'B', time: 'night', url: 'b' },
    { place: 'C', time: 'night', url: 'c' }
  ];
  assert.equal(aerials.pickAerial(list, 23, 'b', () => 0).url, 'c');
  assert.equal(aerials.pickAerial([list[0]], 23, 'b', () => 0).url, 'b');
  assert.equal(aerials.pickAerial([], 23, '', () => 0), null);
});

test('isNight covers the evening and early morning', () => {
  assert.equal(aerials.isNight(20), true);
  assert.equal(aerials.isNight(5), true);
  assert.equal(aerials.isNight(12), false);
  assert.equal(aerials.isNight(7), false);
});

const watcher = require('../app/watcher.js');

test('watcher waits while the opened app is on screen', () => {
  assert.equal(watcher.decide(true, true, 3), 'wait');
});

test('watcher looks around once the opened app has left the screen', () => {
  assert.equal(watcher.decide(true, false, 3), 'look-around');
});

test('watcher gives the app time to appear, then gives up', () => {
  assert.equal(watcher.decide(false, false, 3), 'wait');
  assert.equal(watcher.decide(false, false, 12), 'give-up');
});
