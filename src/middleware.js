import { defineMiddleware } from 'astro:middleware';
import { getTenant } from './lib/tenants.js';
import { SESSION_COOKIE, decodeSession } from './lib/session.js';

const AUTH_PAGES = new Set(['login', 'logout']);

export const onRequest = defineMiddleware((context, next) => {
  const parts = context.url.pathname.split('/').filter(Boolean);
  const first = parts[0] ?? '';

  // Who is signed in (one sign-in covers every studio)
  context.locals.user = decodeSession(context.cookies.get(SESSION_COOKIE)?.value);

  // Sign-in and sign-out pages are open to everyone
  if (AUTH_PAGES.has(first) || AUTH_PAGES.has(parts[1])) return next();

  // Everything else needs a signed-in user
  if (!context.locals.user) {
    const isApi = first === 'api' || parts[1] === 'api';
    if (isApi) {
      return new Response(JSON.stringify({ message: 'Please sign in.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const target = encodeURIComponent(context.url.pathname + context.url.search);
    return context.redirect(`/login?next=${target}`);
  }

  if (parts.length === 0) return next(); // studio directory

  const slug = first === 'api' ? parts[1] : first;
  const tenant = getTenant(slug);
  if (!tenant) return new Response('Studio not found', { status: 404 });

  context.locals.tenant = tenant;
  return next();
});