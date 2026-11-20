import { tarunam } from '../../../../lib/tarunam.js';
import { audit, json, requireStaff, staffError } from '../../../../lib/staff.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(context) {
  const guard = requireStaff(context);
  if (guard.error) return guard.error;

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ message: 'That request was not valid.' }, 400);
  }

  const id = String(body?.schedule_id ?? '');
  if (!UUID.test(id)) return json({ message: 'Session not found.' }, 404);

  try {
    const res = await tarunam('POST', `/schedules/${id}/cancel`, { tenant: guard.tenant });
    if (res.status !== 200) {
      const e = staffError(res);
      return json({ message: e.message }, e.status);
    }
    audit(context, 'call-off', `session ${id} (${res.data.bookings_cancelled} bookings cancelled)`);
    return json({ bookings_cancelled: res.data.bookings_cancelled });
  } catch (err) {
    console.error('[staff/session-cancel] booking service unreachable:', err.message);
    return json({ message: 'The booking service is unavailable. Please try again.' }, 503);
  }
}