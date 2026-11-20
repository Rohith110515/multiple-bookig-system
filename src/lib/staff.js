import { createHmac, timingSafeEqual } from 'node:crypto';

const env = (key) => import.meta.env?.[key] ?? process.env[key];

/* ---------- Passcode and signed staff cookie ---------- */

// glow-studio -> STAFF_PASSCODE_GLOW_STUDIO
export const passcodeVarName = (slug) => `STAFF_PASSCODE_${String(slug).toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
export const getPasscode = (slug) => String(env(passcodeVarName(slug)) ?? '');
// Staff access stays off unless a passcode of at least 8 characters is set
export const staffConfigured = (slug) => getPasscode(slug).length >= 8;
export const staffCookieName = (slug) => `tl_staff_${slug}`;

const sign = (slug, payload) =>
  createHmac('sha256', `staff-cookie|${getPasscode(slug)}`).update(payload).digest('base64url');

function sameText(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

// Compares hashes, so the length of the real passcode is not revealed either
export function passcodeMatches(slug, given) {
  if (!staffConfigured(slug)) return false;
  const digest = (value) => createHmac('sha256', 'passcode-compare').update(String(value)).digest();
  return timingSafeEqual(digest(getPasscode(slug)), digest(given));
}

export function makeStaffToken(slug, hours = 8) {
  const payload = Buffer.from(JSON.stringify({ s: slug, e: Date.now() + hours * 3600000 })).toString('base64url');
  return `${payload}.${sign(slug, payload)}`;
}

// True only for a valid, unexpired cookie that was signed for THIS studio.
// Changing the passcode invalidates every existing staff cookie.
export function isStaff(cookies, slug) {
  if (!staffConfigured(slug)) return false;
  const value = cookies.get(staffCookieName(slug))?.value;
  if (!value) return false;
  const [payload, mac] = value.split('.');
  if (!payload || !mac || !sameText(mac, sign(slug, payload))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.s === slug && typeof data.e === 'number' && data.e > Date.now();
  } catch {
    return false;
  }
}

/* ---------- Throttle for wrong passcodes (in memory, resets when the server restarts) ---------- */

const attempts = new Map();
export function throttled(key) {
  const entry = attempts.get(key);
  return !!entry && entry.count >= 5 && entry.until > Date.now();
}
export function recordFailure(key) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.until <= now) attempts.set(key, { count: 1, until: now + 10 * 60000 });
  else entry.count += 1;
}
export function clearFailures(key) {
  attempts.delete(key);
}

/* ---------- Helpers for the staff API routes ---------- */

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// Every staff route starts with this. Returns { tenant } or { error: Response }.
export function requireStaff(context) {
  const tenant = context.locals.tenant;
  if (!tenant) return { error: json({ message: 'Studio not found.' }, 404) };
  if (!isStaff(context.cookies, tenant.slug)) return { error: json({ message: 'Staff access required.' }, 403) };
  return { tenant };
}

// A line in the server log for every staff action
export function audit(context, action, detail) {
  console.info(`[staff:${context.locals.tenant?.slug}] ${context.locals.user?.id ?? 'unknown'} ${action} ${detail}`);
}

const MESSAGES = {
  attendance_not_open: 'Attendance can only be recorded from 60 minutes before the session starts.',
  booking_cancelled: 'That booking was cancelled.',
  booking_not_found: 'Booking not found.',
  schedule_not_found: 'Session not found.',
  schedule_ended: 'This session has already ended, so it cannot be called off.',
};

export function staffError(res) {
  const known = MESSAGES[res.data?.code];
  if (known) return { status: res.status === 404 ? 404 : 409, message: known };
  if (res.status === 401 || res.status === 403) {
    console.error('[staff] credentials rejected:', JSON.stringify(res.data));
    return { status: 502, message: 'The booking service is not set up correctly.' };
  }
  if (res.status === 400 || res.status === 422) return { status: 400, message: 'That request was not valid.' };
  console.error('[staff] unexpected response:', res.status, JSON.stringify(res.data));
  return { status: 502, message: 'Something went wrong. Please try again.' };
}

/* ---------- Studio-local time to UTC ---------- */

// Offset (ms) of a time zone from UTC at a given instant
function zoneOffsetMs(utcMs, tz) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

// "2026-11-21" + "07:30" in the studio's time zone -> a UTC ISO string
export function zonedToUtcIso(dateKey, time, tz) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let utc = guess - zoneOffsetMs(guess, tz);
  utc = guess - zoneOffsetMs(utc, tz); // second pass handles daylight-saving changes
  return new Date(utc).toISOString();
}