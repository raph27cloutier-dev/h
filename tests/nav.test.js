'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const nav = require('../app/nav.js');

test('moves right and left inside a row', () => {
  assert.equal(nav.move(0, 'right', 5, 5), 1);
  assert.equal(nav.move(3, 'left', 5, 5), 2);
});

test('stays put at the edges of a row', () => {
  assert.equal(nav.move(0, 'left', 5, 5), 0);
  assert.equal(nav.move(4, 'right', 5, 5), 4);
});

test('does not wrap from the end of one grid row to the next', () => {
  assert.equal(nav.move(5, 'right', 14, 6), 5);
  assert.equal(nav.move(6, 'left', 14, 6), 6);
});

test('moves up and down by one grid row', () => {
  assert.equal(nav.move(1, 'down', 14, 6), 7);
  assert.equal(nav.move(7, 'up', 14, 6), 1);
});

test('stays put on the first and last rows', () => {
  assert.equal(nav.move(2, 'up', 14, 6), 2);
  assert.equal(nav.move(13, 'down', 14, 6), 13);
});

test('moving down onto a short last row lands on its last tile', () => {
  // 14 tiles in 6 columns: last row holds tiles 12 and 13.
  assert.equal(nav.move(10, 'down', 14, 6), 13);
});

test('does not move right past the last tile of a short row', () => {
  assert.equal(nav.move(13, 'right', 14, 6), 13);
});

test('returns a safe index for bad input', () => {
  assert.equal(nav.move(0, 'right', 0, 6), 0);
  assert.equal(nav.move(99, 'left', 5, 5), 3);
  assert.equal(nav.move(-4, 'right', 5, 5), 1);
  assert.equal(nav.move(2, 'sideways', 5, 5), 2);
  assert.equal(nav.move(2, 'right', 5, 0), 3);
});

test('maps remote and keyboard key codes to actions', () => {
  assert.equal(nav.actionForKey(37), 'left');
  assert.equal(nav.actionForKey(38), 'up');
  assert.equal(nav.actionForKey(39), 'right');
  assert.equal(nav.actionForKey(40), 'down');
  assert.equal(nav.actionForKey(13), 'select');
  assert.equal(nav.actionForKey(10009), 'back');
  assert.equal(nav.actionForKey(27), 'back');
  assert.equal(nav.actionForKey(68), 'debug');
  assert.equal(nav.actionForKey(10252), 'control');
  assert.equal(nav.actionForKey(403), 'control');
  assert.equal(nav.actionForKey(67), 'control');
  assert.equal(nav.actionForKey(999), null);
});

test('moveInRows moves left and right inside a row and stops at its ends', () => {
  const rows = [5, 3];
  assert.deepEqual(nav.moveInRows({ row: 0, col: 1 }, 'right', rows), { row: 0, col: 2 });
  assert.deepEqual(nav.moveInRows({ row: 0, col: 4 }, 'right', rows), { row: 0, col: 4 });
  assert.deepEqual(nav.moveInRows({ row: 1, col: 0 }, 'left', rows), { row: 1, col: 0 });
});

test('moveInRows moves between rows and clamps to a shorter row', () => {
  const rows = [5, 3];
  assert.deepEqual(nav.moveInRows({ row: 0, col: 4 }, 'down', rows), { row: 1, col: 2 });
  assert.deepEqual(nav.moveInRows({ row: 1, col: 1 }, 'up', rows), { row: 0, col: 1 });
  assert.deepEqual(nav.moveInRows({ row: 0, col: 1 }, 'up', rows), { row: 0, col: 1 });
  assert.deepEqual(nav.moveInRows({ row: 1, col: 1 }, 'down', rows), { row: 1, col: 1 });
});

test('moveInRows skips empty rows', () => {
  assert.deepEqual(nav.moveInRows({ row: 0, col: 0 }, 'down', [2, 0, 3]), { row: 2, col: 0 });
  assert.deepEqual(nav.moveInRows({ row: 2, col: 2 }, 'up', [2, 0, 3]), { row: 0, col: 1 });
});

test('moveInRows returns a safe position for bad input', () => {
  assert.deepEqual(nav.moveInRows({ row: 9, col: 9 }, 'left', [4, 2]), { row: 1, col: 0 });
  assert.deepEqual(nav.moveInRows(null, 'right', [3]), { row: 0, col: 1 });
  assert.deepEqual(nav.moveInRows({ row: 0, col: 0 }, 'right', []), { row: 0, col: 0 });
  assert.deepEqual(nav.moveInRows({ row: 0, col: 0 }, 'sideways', [3]), { row: 0, col: 0 });
});
