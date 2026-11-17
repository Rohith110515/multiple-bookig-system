// Who is signed in. Scoped per tenant so signing into one studio doesn't sign into another.
export const cookieName = (tenantSlug) => `tl_user_${tenantSlug}`;

export function encodeUser(user) {
  return Buffer.from(JSON.stringify(user)).toString('base64url');
}

export function decodeUser(value) {
  if (!value) return null;
  try {
    const user = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (
      typeof user?.id === 'string' &&
      user.id.length > 0 &&
      user.id.length <= 255 &&
      typeof user?.name === 'string'
    ) {
      return { id: user.id, name: user.name.slice(0, 60) };
    }
  } catch {
    /* invalid cookie */
  }
  return null;
}

// Only allow redirects to paths inside the active tenant (blocks open-redirect tricks)
export function safeNext(value, tenantSlug) {
  const fallback = `/${tenantSlug}`;
  return typeof value === 'string' &&
    value.startsWith(`/${tenantSlug}`) &&
    !value.startsWith('//') &&
    !value.includes('\\')
    ? value
    : fallback;
}