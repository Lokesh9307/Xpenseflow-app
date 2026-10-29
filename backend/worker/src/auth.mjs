import { findByLookup, getDocument, insertDocument } from './db.mjs';
import { HttpError } from './errors.mjs';

const textEncoder = new TextEncoder();
const base64UrlEncode = (value) => btoa(String.fromCharCode(...new Uint8Array(value)))
  .replaceAll('+', '-')
  .replaceAll('/', '_')
  .replace(/=+$/, '');

function base64UrlDecode(value) {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

async function hmacKey(secret, usage) {
  return crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usage
  );
}

export async function createAppToken(user, secret) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(textEncoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payload = base64UrlEncode(textEncoder.encode(JSON.stringify({
    id: String(user._id),
    name: user.name,
    email: user.email,
    isOnboarded: Boolean(user.isOnboarded),
    isAdmin: Boolean(user.isAdmin),
    iat: nowSeconds,
    exp: nowSeconds + 30 * 24 * 60 * 60,
  })));
  const unsigned = `${header}.${payload}`;
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret, ['sign']), textEncoder.encode(unsigned));
  return `${unsigned}.${base64UrlEncode(signature)}`;
}

export async function authenticateRequest(request, env) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Authorization token is required');

  const parts = token.split('.');
  if (parts.length !== 3 || !env.JWT_SECRET) {
    throw new HttpError(401, 'Invalid or expired token');
  }

  const [headerPart, payloadPart, signaturePart] = parts;
  let header;
  let payload;
  try {
    header = JSON.parse(new TextDecoder().decode(base64UrlDecode(headerPart)));
    payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadPart)));
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }

  if (header.alg !== 'HS256' || !Number.isFinite(payload.exp) || payload.exp <= Date.now() / 1000) {
    throw new HttpError(401, 'Invalid or expired token');
  }

  const valid = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(env.JWT_SECRET, ['verify']),
    base64UrlDecode(signaturePart),
    textEncoder.encode(`${headerPart}.${payloadPart}`)
  );
  if (!valid || !payload.id) throw new HttpError(401, 'Invalid or expired token');

  return {
    id: String(payload.id),
    name: String(payload.name || ''),
    email: String(payload.email || ''),
    isOnboarded: Boolean(payload.isOnboarded),
    isAdmin: Boolean(payload.isAdmin),
  };
}

async function firebaseRequest(env, action, body) {
  if (!env.FIREBASE_API_KEY) {
    throw new HttpError(503, 'Firebase Authentication is not configured for this deployment');
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/${action}?key=${encodeURIComponent(env.FIREBASE_API_KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const code = result?.error?.message;
    const messages = {
      EMAIL_EXISTS: [409, 'An account with this email already exists'],
      EMAIL_NOT_FOUND: [404, 'No account found with this email'],
      INVALID_PASSWORD: [401, 'Incorrect password'],
      INVALID_LOGIN_CREDENTIALS: [401, 'Email or password is incorrect'],
      USER_DISABLED: [403, 'This account has been disabled'],
      WEAK_PASSWORD: [400, 'Password must be at least 6 characters'],
      INVALID_EMAIL: [400, 'Enter a valid email address'],
    };
    const [status, message] = messages[code] || [400, 'Authentication request was rejected'];
    throw new HttpError(status, message);
  }
  return result;
}

async function getFirebaseAccount(env, idToken) {
  const result = await firebaseRequest(env, 'accounts:lookup', { idToken });
  return result.users?.[0] || null;
}

export async function registerWithFirebase(env, body) {
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!name || !email || !password) {
    throw new HttpError(400, 'Name, email and password are required');
  }

  const result = await firebaseRequest(env, 'accounts:signUp', {
    email,
    password,
    returnSecureToken: true,
  });
  const user = await insertDocument(env, 'users', {
    _id: result.localId,
    name,
    email,
    avatar: '',
    isVerified: false,
    isOnboarded: false,
    isAdmin: false,
    currency: 'INR',
    autoSyncTiffin: false,
    autoSyncSplit: false,
  });

  try {
    await firebaseRequest(env, 'accounts:sendOobCode', {
      requestType: 'VERIFY_EMAIL',
      idToken: result.idToken,
    });
  } catch (error) {
    console.error('[auth] Verification email could not be sent');
    throw new HttpError(503, 'Account created, but the verification email could not be sent. Please try again later.');
  }

  return {
    success: true,
    authFlow: 'email-link',
    message: 'Account created. Open the verification link sent to your email, then sign in.',
    email: user.email,
  };
}

export async function loginWithFirebase(env, body) {
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!email || !password) throw new HttpError(400, 'Email and password are required');

  const result = await firebaseRequest(env, 'accounts:signInWithPassword', {
    email,
    password,
    returnSecureToken: true,
  });
  const firebaseUser = await getFirebaseAccount(env, result.idToken);
  if (!firebaseUser?.emailVerified) {
    throw new HttpError(403, 'Please verify your email using the link sent to your inbox before logging in');
  }
  if (!env.JWT_SECRET) {
    throw new HttpError(503, 'Application authentication is not configured for this deployment');
  }

  let user = await getDocument(env, 'users', result.localId);
  if (!user) {
    user = await insertDocument(env, 'users', {
      _id: result.localId,
      name: result.displayName || email.split('@')[0],
      email,
      avatar: result.photoUrl || '',
      isVerified: true,
      isOnboarded: false,
      isAdmin: false,
      currency: 'INR',
      autoSyncTiffin: false,
      autoSyncSplit: false,
    });
  } else if (!user.isVerified) {
    user.isVerified = true;
    const { saveDocument } = await import('./db.mjs');
    user = await saveDocument(env, 'users', user);
  }

  const token = await createAppToken(user, env.JWT_SECRET);
  return {
    success: true,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      isOnboarded: Boolean(user.isOnboarded),
      isAdmin: Boolean(user.isAdmin),
    },
    token,
  };
}

export async function sendPasswordReset(env, body) {
  const email = String(body.email || '').trim().toLowerCase();
  if (!email) throw new HttpError(400, 'Email is required');

  try {
    await firebaseRequest(env, 'accounts:sendOobCode', {
      requestType: 'PASSWORD_RESET',
      email,
    });
  } catch (error) {
    if (!(error instanceof HttpError) || error.status !== 404) throw error;
  }

  return {
    success: true,
    authFlow: 'email-link',
    message: 'If an account exists for this address, a password reset email has been sent.',
  };
}

export async function resendVerification(env, body) {
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!email || !password) throw new HttpError(400, 'Email and password are required to resend verification');

  const result = await firebaseRequest(env, 'accounts:signInWithPassword', {
    email,
    password,
    returnSecureToken: true,
  });
  const user = await getFirebaseAccount(env, result.idToken);
  if (!user?.emailVerified) {
    await firebaseRequest(env, 'accounts:sendOobCode', {
      requestType: 'VERIFY_EMAIL',
      idToken: result.idToken,
    });
  }
  return {
    success: true,
    authFlow: 'email-link',
    message: 'Verification email sent if your account still needs verification.',
  };
}
