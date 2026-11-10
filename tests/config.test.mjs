import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateConfig } from '../scripts/lib/config.mjs';

const real = () => JSON.parse(readFileSync(new URL('../src/site.json', import.meta.url), 'utf8'));

test('the real src/site.json is valid', () => {
  assert.doesNotThrow(() => validateConfig(real()));
});

test('a missing email is reported', () => {
  const c = real(); delete c.email;
  assert.throws(() => validateConfig(c), /src\/site\.json: "email"/);
});

test('a weekly schedule needs weekday 0-6 and HH:MM', () => {
  const c = real(); c.shows[0].schedule.weekday = 7;
  assert.throws(() => validateConfig(c), /weekday/);
  const d = real(); d.shows[0].schedule.time = '6:30pm';
  assert.throws(() => validateConfig(d), /time/);
});

test('schedule type must be weekly or latest', () => {
  const c = real(); c.shows[1].schedule = { type: 'biweekly' };
  assert.throws(() => validateConfig(c), /"weekly" or "latest"/);
});

test('show keys must be unique and not clash with fixed page anchors', () => {
  const c = real(); c.shows[1].key = c.shows[0].key;
  assert.throws(() => validateConfig(c), /used twice/);
  const d = real(); d.shows[0].key = 'about';
  assert.throws(() => validateConfig(d), /reserved/);
});
