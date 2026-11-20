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

  const id = String(body?.booking_id ?? '');
  const action = body?.action === 'check-in' ? 'check-in' : body?.action === 'no-show' ? 'no-show' : null;
  if (!UUID.test(id) || !action) return json({ message: 'That request was not valid.' }, 400);

  try {
    const res = await tarunam('POST', `/bookings/${id}/${action}`, { tenant: guard.tenant });
    if (res.status !== 200) {
      const e = staffError(res);
      return json({ message: e.message }, e.status);
    }
    audit(context, action, `booking ${id}`);
    return json({ status: res.data.status });
  } catch (err) {
    console.error('[staff/attendance] booking service unreachable:', err.message);
    return json({ message: 'The booking service is unavailable. Please try again.' }, 503);
  }
}