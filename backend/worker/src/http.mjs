import { authenticateRequest } from './auth.mjs';
import { HttpError } from './errors.mjs';

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON');
  }
}

export function json(data, status = 200) {
  return Response.json(data, { status });
}

export async function protectedUser(request, env) {
  return authenticateRequest(request, env);
}

export function routeMatch(path, pattern) {
  const match = pattern.exec(path);
  return match ? match.slice(1).map((part) => decodeURIComponent(part)) : null;
}

export function errorResponse(error) {
  if (error instanceof HttpError) {
    return json({ message: error.message }, error.status);
  }
  console.error('[worker] Unhandled API error:', error instanceof Error ? error.message : 'Unknown error');
  return json({ message: 'Internal server error' }, 500);
}

export function corsResponse(response, request) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', request.headers.get('Origin') || '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  headers.set('Vary', 'Origin');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
