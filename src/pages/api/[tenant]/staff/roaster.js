import { tarunam } from '../../../../lib/tarunam.js';
import { json, requireStaff, staffError } from '../../../../lib/staff.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(context) {
  const guard = requireStaff(context);
  if (guard.error) return guard.error;

  const id = new URL(context.request.url).searchParams.get('schedule') ?? '';
  if (!UUID.test(id)) return json({ message: 'Session not found.' }, 404);

  try {
    const res = await tarunam('GET', `/schedules/${id}/bookings`, { tenant: guard.tenant });
    if (res.status !== 200) {
      const e = staffError(res);
      return json({ message: e.message }, e.status);
    }
    // Only what the roster needs
    return json({
      bookings: res.data.map((b) => ({ id: b.id, user_id: b.user_id, guests: b.guests, status: b.status })),
    });
  } catch (err) {
    console.error('[staff/roster] booking service unreachable:', err.message);
    return json({ message: 'The booking service is unavailable. Please try again.' }, 503);
  }
}