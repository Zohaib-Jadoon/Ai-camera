import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Run the actual dependency-free coordinator with Node's test runner on Node 20+.
const source = readFileSync(new URL('../src/lib/session-refresh.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const { createSessionRefresher, SessionChangedError } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

const initial = () => ({ user: { id: 'operator' }, accessToken: 'old-access', refreshToken: 'old-refresh' });
const replacement = () => ({ user: { id: 'operator' }, accessToken: 'new-access', refreshToken: 'new-refresh' });
function setup(renew) {
  let state = initial();
  let calls = 0;
  const refresh = createSessionRefresher({
    read: () => state,
    save: (next) => { state = next; },
    renew: async (token) => { calls++; return renew ? renew(token) : replacement(); },
    withLock: (work) => Promise.resolve().then(work),
  });
  return { refresh, set: (next) => { state = next; }, get: () => state, calls: () => calls };
}

test('simultaneous HTTP/socket failures rotate once and share the new session', async () => {
  const fixture = setup();
  const results = await Promise.all(Array.from({ length: 20 }, () => fixture.refresh('old-access', 'operator')));
  assert.equal(fixture.calls(), 1);
  assert.ok(results.every((value) => value.accessToken === 'new-access'));
  assert.equal(fixture.get().refreshToken, 'new-refresh');
});

test('late failures reuse the session already renewed by another request', async () => {
  const fixture = setup();
  fixture.set(replacement());
  assert.equal((await fixture.refresh('old-access', 'operator')).accessToken, 'new-access');
  assert.equal(fixture.calls(), 0);
});

test('two tabs sharing a lock consume a refresh token only once', async () => {
  let state = initial();
  let calls = 0;
  let tail = Promise.resolve();
  const options = {
    read: () => state,
    save: (next) => { state = next; },
    renew: async () => { calls++; return replacement(); },
    withLock: (work) => { const next = tail.then(work); tail = next.catch(() => {}); return next; },
  };
  const tabA = createSessionRefresher(options);
  const tabB = createSessionRefresher(options);
  await Promise.all([tabA('old-access', 'operator'), tabB('old-access', 'operator')]);
  assert.equal(calls, 1);
});

test('logging out during refresh cannot resurrect the session', async () => {
  let resolve;
  const fixture = setup(() => new Promise((done) => { resolve = done; }));
  const work = fixture.refresh('old-access', 'operator');
  await Promise.resolve();
  fixture.set(null);
  resolve(replacement());
  await assert.rejects(work, SessionChangedError);
  assert.equal(fixture.get(), null);
});

test('switching users prevents an old request from renewing as the new user', async () => {
  const fixture = setup();
  fixture.set({ ...replacement(), user: { id: 'different-user' } });
  await assert.rejects(fixture.refresh('old-access', 'operator'), SessionChangedError);
  assert.equal(fixture.calls(), 0);
});

test('new login during renewal cannot be overwritten by the old response', async () => {
  let resolve;
  const fixture = setup(() => new Promise((done) => { resolve = done; }));
  const work = fixture.refresh('old-access', 'operator');
  await Promise.resolve();
  fixture.set({ ...replacement(), accessToken: 'new-login' });
  resolve(replacement());
  await assert.rejects(work, SessionChangedError);
  assert.equal(fixture.get().accessToken, 'new-login');
});

test('network failure preserves credentials and clears the pending request for retry', async () => {
  let failed = true;
  const fixture = setup(async () => { if (failed) throw new Error('Network unavailable'); return replacement(); });
  await assert.rejects(fixture.refresh('old-access', 'operator'), /Network unavailable/);
  assert.equal(fixture.get().accessToken, 'old-access');
  failed = false;
  await fixture.refresh('old-access', 'operator');
  assert.equal(fixture.calls(), 2);
});

test('a refresh response cannot change the account identity', async () => {
  const fixture = setup(async () => ({ ...replacement(), user: { id: 'other' } }));
  await assert.rejects(fixture.refresh('old-access', 'operator'), SessionChangedError);
  assert.equal(fixture.get().user.id, 'operator');
});
