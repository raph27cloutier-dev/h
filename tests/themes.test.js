'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const themes = require('../app/themes.js');

const HEX = /^#[0-9a-f]{6}$/i;
const COLOUR_FIELDS = ['bg', 'accent', 'accentInk', 'panel', 'glassSolid'];

test('there are several themes and the first one is the classic look', () => {
  assert.ok(themes.list.length >= 3);
  assert.equal(themes.list[0].key, 'classic');
});

test('every theme has a unique key, a name, valid colours and its glow image', () => {
  const keys = themes.list.map((theme) => theme.key);
  assert.equal(new Set(keys).size, keys.length);
  themes.list.forEach((theme) => {
    assert.match(theme.key, /^[a-z]+$/);
    assert.ok(theme.label.length > 0 && theme.label.length <= 10, theme.key + ' label fits its button');
    COLOUR_FIELDS.forEach((field) => assert.match(theme[field], HEX, theme.key + '.' + field));
    assert.ok(theme.heroColor === '' || HEX.test(theme.heroColor));
    assert.equal(typeof theme.radius, 'string');
    assert.equal(typeof theme.gridRadius, 'string');
    assert.equal(typeof theme.font, 'string');
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'app', theme.mask)), theme.mask + ' exists');
  });
});

test('find returns the named theme and falls back to the first for anything else', () => {
  assert.equal(themes.find('midnight').key, 'midnight');
  assert.equal(themes.find('nope').key, 'classic');
  assert.equal(themes.find(null).key, 'classic');
  assert.equal(themes.find(undefined).key, 'classic');
  assert.equal(themes.find({}).key, 'classic');
});

test('next goes through every theme and wraps around', () => {
  const seen = [];
  let key = themes.list[0].key;
  themes.list.forEach(() => {
    key = themes.next(key).key;
    seen.push(key);
  });
  assert.equal(new Set(seen).size, themes.list.length);
  assert.equal(seen[seen.length - 1], themes.list[0].key);
  assert.equal(themes.next('nope').key, themes.list[1].key);
});

test('cssVariables gives the page variables for a theme without changing it', () => {
  const theme = themes.find('arcade');
  const copy = JSON.parse(JSON.stringify(theme));
  const vars = themes.cssVariables(theme);
  assert.equal(vars['--bg'], theme.bg);
  assert.equal(vars['--accent'], theme.accent);
  assert.equal(vars['--accent-ink'], theme.accentInk);
  assert.equal(vars['--panel'], theme.panel);
  assert.equal(vars['--glass-solid'], theme.glassSolid);
  assert.equal(vars['--radius'], theme.radius);
  assert.equal(vars['--radius-grid'], theme.gridRadius);
  assert.equal(vars['--font'], theme.font);
  assert.deepEqual(theme, copy);
});
