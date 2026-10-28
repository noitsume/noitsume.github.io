/* eslint-disable @typescript-eslint/no-require-imports */
require('./register.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest } = require('next/server');
const { assertSameOrigin, assertCsrf } = require('../lib/auth/csrf.ts');

function configure(t, url) {
  const previous = process.env.NEXT_PUBLIC_APP_URL;
  if (url === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = url;
  t.after(() => {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previous;
  });
}

function request(origin, headers = {}, url = 'http://0.0.0.0:3000/api/auth/session') {
  return new NextRequest(url, {
    method: 'POST',
    headers: { ...(origin === undefined ? {} : { origin }), ...headers },
  });
}

const csrfHeaders = { cookie: 'kenangin_csrf=test-token', 'x-csrf-token': 'test-token' };
const denied = (code) => (error) => error.code === code && error.status === 403;

test('Docker accepts the configured browser origin and matching CSRF token', (t) => {
  configure(t, 'http://localhost:3000');
  assert.doesNotThrow(() => assertCsrf(request('http://localhost:3000', csrfHeaders)));
});

test('an HTTPS public origin works behind an HTTP container', (t) => {
  configure(t, 'https://kenangin.example/');
  assert.doesNotThrow(() => assertCsrf(request('https://kenangin.example', csrfHeaders)));
});

test('configured origin rejects other hosts, ports, protocols, and the bind address', (t) => {
  configure(t, 'http://localhost:3000');
  for (const origin of ['http://evil.example', 'http://localhost:3001', 'https://localhost:3000',
    'http://0.0.0.0:3000', 'http://localhost:3000.evil.example', 'http://localhost:3000/', 'null', undefined]) {
    assert.throws(() => assertCsrf(request(origin, csrfHeaders)), denied('INVALID_ORIGIN'), String(origin));
  }
});

test('Host and Forwarded headers cannot expand the configured trusted origin', (t) => {
  configure(t, 'http://localhost:3000');
  assert.throws(() => assertCsrf(request('https://evil.example', {
    ...csrfHeaders,
    host: 'evil.example',
    'x-forwarded-host': 'evil.example',
    'x-forwarded-proto': 'https',
    forwarded: 'host=evil.example;proto=https',
  })), denied('INVALID_ORIGIN'));
});

test('a valid Docker origin still requires matching CSRF cookie and header', (t) => {
  configure(t, 'http://localhost:3000');
  for (const headers of [{}, { cookie: csrfHeaders.cookie }, { 'x-csrf-token': 'test-token' },
    { ...csrfHeaders, 'x-csrf-token': 'wrong' }, { ...csrfHeaders, 'x-csrf-token': 'bad-token!' }]) {
    assert.throws(() => assertCsrf(request('http://localhost:3000', headers)), denied('INVALID_CSRF'));
  }
});

test('without a configured app URL, direct requests retain same-origin checking', (t) => {
  configure(t, undefined);
  const url = 'http://localhost:3000/api/auth/session';
  assert.doesNotThrow(() => assertSameOrigin(request('http://localhost:3000', {}, url)));
  assert.throws(() => assertSameOrigin(request('https://evil.example', {}, url)), denied('INVALID_ORIGIN'));
});

test('malformed app configuration fails closed', (t) => {
  configure(t, 'not-a-url');
  assert.throws(() => assertSameOrigin(request('http://localhost:3000')));
});
