import { defineMiddleware } from 'astro:middleware';
import { getTenant } from './lib/tenants.js';
import { cookieName, decodeUser } from './lib/user.js';

export const onRequest = defineMiddleware((context, next) => {
  const parts = context.url.pathname.split('/').filter(Boolean);
  if (parts.length === 0) return next(); // Home directory page

  const slug = parts[0] === 'api' ? parts[1] : parts[0];
  const tenant = getTenant(slug);
  if (!tenant) return new Response('Studio not found', { status: 404 });

  context.locals.tenant = tenant;
  context.locals.user = decodeUser(context.cookies.get(cookieName(tenant.slug))?.value);
  return next();
});