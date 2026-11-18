// One sign-in for the whole site. DEMO only: nothing is verified, so any name and email works.
export const SESSION_COOKIE = 'tl_session';

export function encodeSession(user) {
  return Buffer.from(JSON.stringify({ id: user.id, name: user.name })).toString('base64url');
}

// Returns { id, email, name } or null. The email is also the user id.
export function decodeSession(value) {
  if (!value) return null;
  try {
    const user = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (typeof user?.id === 'string' && user.id.length > 0 && user.id.length <= 255 && typeof user?.name === 'string') {
      return { id: user.id, email: user.id, name: user.name.slice(0, 60) };
    }
  } catch { /* invalid cookie */ }
  return null;
}

// Only allow redirects to pages on this site, and never back to the sign-in pages
export function safeNext(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
  if (/^\/(login|logout)(\/|\?|$)/.test(value)) return '/';
  return value;
}