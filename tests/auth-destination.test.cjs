/* eslint-disable @typescript-eslint/no-require-imports */
require('./register.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const { ownerDestination } = require('../lib/auth/destination.ts');

test('session hand-off cannot redirect to an external origin or back into onboarding', () => {
  for (const value of [undefined, '//other.example', '/\\other.example', 'https://other.example', 'javascript:alert(1)', '/onboarding?next=/onboarding', '/login', '/register/', '/%6cogin', '/rooms/../onboarding', '/%5cother.example', '/\n/other.example']) {
    assert.equal(ownerDestination(value), '/dashboard', String(value));
  }
  assert.equal(ownerDestination('/rooms/room_abc/studio?step=music#volume'), '/rooms/room_abc/studio?step=music#volume');
});
