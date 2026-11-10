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

const rules = require('../app/helper-rules.js');

const HOME = { homeFront: true, paused: false, stopped: false, graceUntil: 0 };

test('helper stays quiet while My Home is on screen', () => {
  assert.equal(rules.shouldScan(HOME, 1000), false);
});

test('helper waits for an opened app to appear, then watches the screen', () => {
  const opened = rules.applyMessage(HOME, 'opened', 1000, 12000);
  assert.equal(rules.shouldScan(opened, 5000), false);
  assert.equal(rules.shouldScan(opened, 13000), true);
});

test('helper does not interrupt an app the TV cannot report on', () => {
  const paused = rules.applyMessage(HOME, 'pause', 1000, 12000);
  assert.equal(rules.shouldScan(paused, 99999), false);
  assert.equal(rules.shouldScan(rules.applyMessage(rules.applyMessage(paused, 'front', 2000, 12000), 'back', 3000, 12000), 4000), true);
});

test('Exit to TV keeps the helper quiet until My Home is opened again', () => {
  const stopped = rules.applyMessage(rules.applyMessage(HOME, 'stop', 1000, 12000), 'back', 1500, 12000);
  assert.equal(rules.shouldScan(stopped, 99999), false);
  assert.equal(rules.applyMessage(stopped, 'front', 2000, 12000).stopped, false);
});

test('applyMessage does not change the state it is given', () => {
  rules.applyMessage(HOME, 'opened', 1000, 12000);
  assert.deepEqual(HOME, { homeFront: true, paused: false, stopped: false, graceUntil: 0 });
});
