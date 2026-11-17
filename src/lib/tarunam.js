import { createHmac } from 'node:crypto';

// Works inside Astro (import.meta.env) and in plain Node scripts (process.env)
const env = (key) => import.meta.env?.[key] ?? process.env[key];
const apiBase = () => (env('TARUNAM_API_URL') || 'http://localhost:3000/api/v1').replace(/\/$/, '');
const b64url = (input) => Buffer.from(input).toString('base64url');

// Signs a short-lived HS256 token with the active tenant's secret.
export function mintToken(tenant, userId) {
  if (!tenant?.slug || !tenant?.secret) {
    throw new Error('Missing tenant slug or signing secret');
  }
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    tenant_id: tenant.slug,
    aud: 'tarunam',
    iat: now,
    exp: now + 300, // valid for 5 minutes, far below the 60 minute limit
    ...(userId ? { on_behalf_of: userId } : {}),
  };
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const data = `${head}.${b64url(JSON.stringify(payload))}`;
  const signature = createHmac('sha256', tenant.secret).update(data).digest('base64url');
  return `${data}.${signature}`;
}

// Calls the Tarunam API as the given tenant. Returns { status, data }. Throws if unreachable.
export async function tarunam(method, path, { tenant, userId, body, query } = {}) {
  const url = new URL(`${apiBase()}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value != null) url.searchParams.set(key, String(value));
  }
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${mintToken(tenant, userId)}`,
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { status: res.status, data };
}

/* ---------- friendly error messages ---------- */

const MESSAGES = {
  schedule_full: 'There are not enough seats left for that many guests.',
  schedule_not_open: 'This session was cancelled.',
  schedule_started: 'This session has already started.',
  schedule_not_found: 'This session no longer exists.',
  booking_closed: 'Booking for this session has closed.',
  booking_not_open_yet: 'Booking for this session is not open yet.',
  booking_not_found: 'Booking not found.',
  booking_cancelled: 'This booking was already cancelled.',
  booking_not_cancellable: 'This booking can no longer be cancelled.',
  cancellation_closed: 'It is too late to cancel this booking.',
  idempotency_key_reused: 'Something went wrong with that request. Please try again.',
};

// Turns an API response into { status, message } that is safe to show to a visitor.
export function friendlyError(res) {
  if (res.status === 401 || res.status === 403) {
    // A configuration problem: log the detail on the server, tell the visitor nothing sensitive
    console.error('[tarunam] credentials rejected:', JSON.stringify(res.data));
    return { status: 502, message: 'The booking service is not set up correctly. Please try again later.' };
  }
  const known = MESSAGES[res.data?.code];
  if (known) return { status: res.status === 404 ? 404 : 409, message: known };
  if (res.status === 422 || res.status === 400) {
    return { status: 400, message: 'That request was not valid.' };
  }
  console.error('[tarunam] unexpected response:', res.status, JSON.stringify(res.data));
  return { status: 502, message: 'Something went wrong. Please try again.' };
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/* ---------- time formatting in the studio's time zone ---------- */

export const STUDIO_TZ = 'Asia/Kolkata';
const timeFmt = new Intl.DateTimeFormat('en-IN', {
  timeZone: STUDIO_TZ,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});
const dayFmt = new Intl.DateTimeFormat('en-IN', {
  timeZone: STUDIO_TZ,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const keyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: STUDIO_TZ }); // YYYY-MM-DD

export const formatTime = (iso) => timeFmt.format(new Date(iso));
export const formatDay = (iso) => dayFmt.format(new Date(iso));
export const dayKey = (iso) => keyFmt.format(new Date(iso));