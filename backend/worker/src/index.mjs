import { loginWithFirebase, registerWithFirebase, resendVerification, sendPasswordReset } from './auth.mjs';
import { errorResponse, json, readJson, corsResponse } from './http.mjs';
import { handleFinanceRequest } from './finance.mjs';
import { handleSplitRequest } from './split.mjs';
import { handleTiffinRequest } from './tiffin.mjs';
import { handleChatRequest } from './chat.mjs';

async function handleAuth(request, env, pathname) {
  const method = request.method.toUpperCase();
  if (method === 'POST' && pathname === '/api/auth/register') {
    const data = await registerWithFirebase(env, await readJson(request));
    return json(data, 201);
  }
  if (method === 'POST' && ['/api/auth/login', '/api/auth/mobile-login'].includes(pathname)) {
    return json(await loginWithFirebase(env, await readJson(request)));
  }
  if (method === 'POST' && pathname === '/api/auth/password-reset-email') {
    return json(await sendPasswordReset(env, await readJson(request)));
  }
  if (method === 'POST' && pathname === '/api/auth/resend-verification') {
    return json(await resendVerification(env, await readJson(request)));
  }
  if (method === 'POST' && pathname === '/api/auth/send-otp') {
    const body = await readJson(request);
    if (body.type === 'signup') {
      return json(await resendVerification(env, body));
    }
    return json(await sendPasswordReset(env, body));
  }
  if (method === 'POST' && pathname === '/api/auth/verify-otp') {
    return json({ message: 'Email verification now uses the secure link sent to your inbox.' }, 410);
  }
  if (method === 'POST' && pathname === '/api/auth/reset-password') {
    return json({ message: 'Use the password reset link sent to your email to set a new password.' }, 410);
  }
  return null;
}

async function fetchHandler(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });

  const url = new URL(request.url);
  if (request.method === 'GET' && ['/','/api/health'].includes(url.pathname)) {
    try {
      await env.DB.prepare('SELECT 1').first();
      const configured = Boolean(env.JWT_SECRET && env.FIREBASE_API_KEY);
      return json({
        status: configured ? 'ok' : 'degraded',
        app: 'XpenseFlow API',
        database: 'connected',
        authentication: configured ? 'configured' : 'configuration required',
        authMode: 'email-link',
      }, configured ? 200 : 503);
    } catch (error) {
      console.error('[health] D1 check failed:', error instanceof Error ? error.message : 'Unknown error');
      return json({
        status: 'degraded',
        app: 'XpenseFlow API',
        database: 'disconnected',
        authMode: 'email-link',
      }, 503);
    }
  }

  const authResponse = await handleAuth(request, env, url.pathname);
  if (authResponse) return authResponse;

  for (const handle of [handleFinanceRequest, handleSplitRequest, handleTiffinRequest, handleChatRequest]) {
    const response = await handle(request, env, url);
    if (response) return response;
  }
  return json({ message: `Route not found: ${request.method} ${url.pathname}` }, 404);
}

export default {
  async fetch(request, env) {
    try {
      return corsResponse(await fetchHandler(request, env), request);
    } catch (error) {
      return corsResponse(errorResponse(error), request);
    }
  },
};
