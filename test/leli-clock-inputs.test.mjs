import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ window: {}, document: { querySelectorAll: () => [], addEventListener() {}, body: {} }, MutationObserver: class { observe() {} } });
vm.runInContext(readFileSync(new URL('../pao-da-leli-ponto/clock-inputs.js', import.meta.url), 'utf8'), context);
context.leliClock = context.window.leliClock;
const source = readFileSync(new URL('../pao-da-leli-ponto/admin-real.js', import.meta.url), 'utf8');
vm.runInContext(source.slice(source.indexOf('const REVIEW_TIME_LABELS='), source.indexOf('function updateMonthlyReviewEdits(')), context);

test('aceita digitação numérica e rejeita horários impossíveis', () => {
  for (const [input, expected] of [['0830', '08:30'], ['830', '08:30'], ['8', '08:00'], ['8:05', '08:05'], ['2359', '23:59'], ['', '']]) assert.equal(context.leliClock.normalize(input), expected);
  for (const value of ['24:00', '25:30', '08:60', 'abc']) assert.equal(context.leliClock.valid(context.leliClock.normalize(value)), false);
});

test('jornadas incompletas e pedidos pendentes não geram débito na prévia', () => {
  const times = { in: '08:00', breakOut: '12:00', breakIn: '13:00', out: '' };
  const day = { times, expectedMinutes: 480, pendingCorrections: 0 };
  assert.equal(context.monthlyReviewDayState(times, day).balance, null);
  const complete = { ...times, out: '17:00' };
  assert.equal(context.monthlyReviewDayState(complete, day).balance, 0);
  assert.equal(context.monthlyReviewDayState(complete, { ...day, times: complete, pendingCorrections: 1 }).balance, null);
  assert.equal(context.monthlyReviewDayState({ ...complete, out: '17:30' }, { ...day, times: complete, pendingCorrections: 1 }).balance, 30);
  assert.equal(context.monthlyReviewDayState(complete, { ...day, expectedMinutes: 0 }).balance, null);
});

test('a prévia identifica horários invertidos, duplicados e remoção de batidas', () => {
  const times = { in: '08:00', breakOut: '12:00', breakIn: '13:00', out: '17:00' };
  const day = { times, expectedMinutes: 480, pendingCorrections: 0 };
  for (const edits of [{ out: '11:00' }, { breakIn: '12:00' }, { in: '' }]) {
    const state = context.monthlyReviewDayState({ ...times, ...edits }, day);
    assert(state.error); assert.equal(state.balance, null);
  }
});
