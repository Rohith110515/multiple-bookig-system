import { createHash } from 'node:crypto';
import { tarunam, friendlyError, json } from '../../../lib/tarunam.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST({ request, locals }) {
  const user = locals.user;
  const tenant = locals.tenant;
  if (!user) return json({ message: 'Please sign in to book.' }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ message: 'That request was not valid.' }, 400);
  }

  const scheduleId = String(body?.schedule_id ?? '');
  const guests = Number(body?.guests);
  const nonce = String(body?.nonce ?? '');
  if (!UUID.test(scheduleId) || !Number.isInteger(guests) || guests < 1 || guests > 6 || nonce.length < 8 || nonce.length > 100) {
    return json({ message: 'That request was not valid.' }, 400);
  }

  const key = createHash('sha256').update(`${tenant.slug}|${user.id}|${scheduleId}|${nonce}`).digest('hex');

  let res;
  try {
    res = await tarunam('POST', `/schedules/${scheduleId}/book`, {
      tenant,
      userId: user.id,
      body: { user_id: user.id, guests, idempotency_key: key },
    });
  } catch (err) {
    console.error('[api/book] booking service unreachable:', err.message);
    return json({ message: 'The booking service is unavailable. Please try again.' }, 503);
  }

  if (res.status !== 201) {
    const { status, message } = friendlyError(res);
    return json({ message, code: res.data?.code ?? null }, status);
  }

  let seatsLeft = null;
  try {
    const schedule = await tarunam('GET', `/schedules/${scheduleId}`, { tenant });
    if (schedule.status === 200) seatsLeft = schedule.data.seats_left;
  } catch {
    /* booking already succeeded */
  }

  return json({ booking: res.data, seats_left: seatsLeft }, 201);
}