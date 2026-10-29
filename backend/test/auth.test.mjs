import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import worker from '../worker/src/index.mjs';
import {
  authenticateRequest,
  createAppToken,
  loginWithFirebase,
  registerWithFirebase,
  sendPasswordReset,
} from '../worker/src/auth.mjs';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeDatabase() {
  const documents = new Map();
  return {
    prepare(sql) {
      return {
        async first() {
          if (sql.includes('SELECT 1')) return { ok: 1 };
          return null;
        },
        bind(...params) {
          return {
            async first() {
              if (sql.includes('SELECT 1')) return { ok: 1 };
              if (!sql.includes('SELECT data FROM documents')) return null;
              const document = documents.get(`${params[0]}:${params[1]}`);
              return document ? { data: JSON.stringify(document) } : null;
            },
            async run() {
              const [kind, id] = params;
              const document = JSON.parse(params[7]);
              documents.set(`${kind}:${id}`, document);
              return { meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };
}

function mockFirebaseFetch(handler) {
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const action = url.pathname.split('/').pop();
    return handler(action, JSON.parse(init.body));
  };
}

test('registration creates the D1 user and requests email verification', async () => {
  const calls = [];
  mockFirebaseFetch((action, body) => {
    calls.push({ action, body });
    if (action === 'accounts:signUp') {
      return jsonResponse({ localId: 'mongo-user-id', idToken: 'firebase-id-token' });
    }
    return jsonResponse({ email: 'person@example.com' });
  });

  const result = await registerWithFirebase(
    { DB: makeDatabase(), FIREBASE_API_KEY: 'test-key' },
    { name: 'Person', email: 'person@example.com', password: 'a-secure-password' }
  );

  assert.equal(result.success, true);
  assert.equal(result.authFlow, 'email-link');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].action, 'accounts:signUp');
  assert.equal(calls[1].action, 'accounts:sendOobCode');
  assert.equal(calls[1].body.requestType, 'VERIFY_EMAIL');
});

test('login signs an application token only for a verified Firebase account', async () => {
  const database = makeDatabase();
  mockFirebaseFetch((action) => {
    if (action === 'accounts:signUp') {
      return jsonResponse({ localId: 'mongo-user-id', idToken: 'firebase-id-token' });
    }
    return jsonResponse({ email: 'person@example.com' });
  });
  await registerWithFirebase(
    { DB: database, FIREBASE_API_KEY: 'test-key' },
    { name: 'Person', email: 'person@example.com', password: 'a-secure-password' }
  );

  mockFirebaseFetch((action) => {
    if (action === 'accounts:signInWithPassword') {
      return jsonResponse({
        localId: 'mongo-user-id',
        idToken: 'firebase-id-token',
        displayName: 'Person',
      });
    }
    if (action === 'accounts:lookup') {
      return jsonResponse({ users: [{ emailVerified: true }] });
    }
    throw new Error(`Unexpected Firebase action: ${action}`);
  });

  const env = {
    DB: database,
    FIREBASE_API_KEY: 'test-key',
    JWT_SECRET: 'test-jwt-secret-for-unit-test',
  };
  const result = await loginWithFirebase(env, {
    email: 'person@example.com',
    password: 'a-secure-password',
  });
  const authenticated = await authenticateRequest(
    new Request('https://unit.test/api/profile', {
      headers: { Authorization: `Bearer ${result.token}` },
    }),
    env
  );

  assert.equal(result.success, true);
  assert.equal(authenticated.id, 'mongo-user-id');
  assert.equal(authenticated.email, 'person@example.com');
});

test('unverified Firebase accounts cannot receive an app session', async () => {
  mockFirebaseFetch((action) => {
    if (action === 'accounts:signInWithPassword') {
      return jsonResponse({ localId: 'unverified-id', idToken: 'firebase-id-token' });
    }
    return jsonResponse({ users: [{ emailVerified: false }] });
  });

  await assert.rejects(
    loginWithFirebase(
      { DB: makeDatabase(), FIREBASE_API_KEY: 'test-key', JWT_SECRET: 'test-secret' },
      { email: 'person@example.com', password: 'a-secure-password' }
    ),
    (error) => error.status === 403
  );
});

test('password reset responds generically when Firebase has no matching account', async () => {
  mockFirebaseFetch(() => jsonResponse({ error: { message: 'EMAIL_NOT_FOUND' } }, 400));

  const env = { FIREBASE_API_KEY: 'test-key' };
  const response = await worker.fetch(
    new Request('https://unit.test/api/auth/password-reset-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'unknown@example.com' }),
    }),
    env
  );
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.match(result.message, /If an account exists/);
  assert.equal(result.authFlow, 'email-link');
});

test('health endpoint identifies the Worker email-link auth mode', async () => {
  const response = await worker.fetch(new Request('https://unit.test/api/health'), {
    DB: makeDatabase(),
    FIREBASE_API_KEY: 'test-key',
    JWT_SECRET: 'test-secret',
  });
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.authMode, 'email-link');
});

test('application token validation rejects a modified signature', async () => {
  const token = await createAppToken(
    { _id: 'user-id', name: 'Person', email: 'person@example.com' },
    'test-secret'
  );
  const modifiedToken = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;

  await assert.rejects(
    authenticateRequest(
      new Request('https://unit.test/api/profile', {
        headers: { Authorization: `Bearer ${modifiedToken}` },
      }),
      { JWT_SECRET: 'test-secret' }
    ),
    (error) => error.status === 401
  );
});
