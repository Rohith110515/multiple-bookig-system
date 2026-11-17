import { tarunam, friendlyError, json } from '../../../../../lib/tarunam.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST({ params, locals }) {
  const user = locals.user;
  const tenant = locals.tenant;
  if (!user) return json({ message: 'Please sign in.' }, 401);

  const id = String(params.id ?? '');
  if (!UUID.test(id)) return json({ message: 'Booking not found.' }, 404);

  try {
    const found = await tarunam('GET', `/bookings/${id}`, { tenant, userId: user.id });
    if (found.status !== 200 || found.data?.user_id !== user.id) {
      return json({ message: 'Booking not found.' }, 404);
    }

    const res = await tarunam('POST', `/bookings/${id}/cancel`, { tenant, userId: user.id });
    if (res.status !== 200) {
      const { status, message } = friendlyError(res);
      return json({ message }, status);
    }
    return json({ booking: res.data });
  } catch (err) {
    console.error('[api/cancel] booking service unreachable:', err.message);
    return json({ message: 'The booking service is unavailable. Please try again.' }, 503);
  }
}