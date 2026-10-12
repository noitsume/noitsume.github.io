/* eslint-disable @typescript-eslint/no-require-imports */
require('./register.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { deskArrivalBootstrap, DESK_ARRIVAL_KEY, DESK_ARRIVAL_TTL_MS, AUTH_EXIT_MS } = require('../lib/dashboard/arrival.ts');

function boot({ raw, path = '/dashboard', reduced = false, hidden = false, blocked = false } = {}) {
  const root = { dataset: {} };
  const document = new EventTarget();
  document.documentElement = root;
  document.visibilityState = hidden ? 'hidden' : 'visible';
  const window = new EventTarget();
  const timers = new Map();
  let stored = raw;
  const context = {
    document, Event, location: { pathname: path }, Date, JSON, Number,
    matchMedia: () => ({ matches: reduced }),
    sessionStorage: {
      getItem: key => { assert.equal(key, DESK_ARRIVAL_KEY); if (blocked) throw Error('blocked'); return stored; },
      removeItem: () => { stored = null; },
    },
    setTimeout: (fn, delay) => { timers.set(delay, fn); return delay; },
    clearTimeout: id => timers.delete(id),
    addEventListener: window.addEventListener.bind(window),
    removeEventListener: window.removeEventListener.bind(window),
  };
  vm.runInNewContext(deskArrivalBootstrap, context);
  return { root, document, window, timers, stored: () => stored };
}
const hint = (patch = {}) => JSON.stringify({ version: 2, at: Date.now(), destination: '/dashboard', ...patch });

test('arrival consumes a fresh hint exactly once before paint', () => {
  const state = boot({ raw: hint() });
  assert.equal(state.root.dataset.deskEntry, 'pending');
  assert.equal(state.stored(), null);
  assert.equal(boot({ raw: state.stored() }).root.dataset.deskEntry, undefined);
  assert.ok(AUTH_EXIT_MS <= 200, 'the visual handoff must not reintroduce the long auth delay');
});

test('stale, future, malformed, legacy and wrong destination hints cannot hide content', () => {
  for (const raw of ['1', '{broken', 'null', hint({ version: 1 }), hint({ at: Date.now() - DESK_ARRIVAL_TTL_MS - 100 }), hint({ at: Date.now() + 10000 }), hint({ at: 'now' }), hint({ destination: '/rooms/private' })]) {
    const state = boot({ raw });
    assert.equal(state.root.dataset.deskEntry, undefined, raw);
    assert.equal(state.stored(), null);
  }
});

test('deep links, reduced motion, hidden tabs and unavailable storage remain immediately usable', () => {
  for (const options of [{ path: '/rooms/room_a/studio' }, { path: '/login' }, { reduced: true }, { hidden: true }, { blocked: true }]) {
    assert.equal(boot({ raw: hint(), ...options }).root.dataset.deskEntry, undefined);
  }
});

test('a missing renderer releases the gate; a ready renderer retains only the bounded failsafe', () => {
  const pending = boot({ raw: hint() });
  pending.timers.get(1400)();
  assert.equal(pending.root.dataset.deskEntry, undefined);
  assert.equal(pending.timers.size, 0);
  const running = boot({ raw: hint() });
  running.root.dataset.deskEntry = 'running';
  running.timers.get(1400)();
  assert.equal(running.root.dataset.deskEntry, 'running');
  running.timers.get(4000)();
  assert.equal(running.root.dataset.deskEntry, undefined);
});

test('first interaction or backgrounding cancels arrival and clears deadlines', () => {
  for (const action of ['pointerdown', 'keydown', 'wheel', 'hidden']) {
    const state = boot({ raw: hint() });
    if (action === 'hidden') {
      state.document.visibilityState = 'hidden'; state.document.dispatchEvent(new Event('visibilitychange'));
    } else state.window.dispatchEvent(new Event(action));
    assert.equal(state.root.dataset.deskEntry, undefined, action);
    assert.equal(state.timers.size, 0);
  }
});
