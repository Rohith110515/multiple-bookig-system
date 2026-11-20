import { tarunam } from '../../../../lib/tarunam.js';
import { audit, json, requireStaff, staffError, zonedToUtcIso } from '../../../../lib/staff.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function POST(context) {
  const guard = requireStaff(context);
  if (guard.error) return guard.error;
  const { tenant } = guard;

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ message: 'That request was not valid.' }, 400);
  }

  const resourceId = String(body?.resource_id ?? '');
  const date = String(body?.date ?? '');
  const time = String(body?.time ?? '');
  const minutes = Number(body?.minutes);
  const capacity = Number(body?.capacity);

  const valid =
    UUID.test(resourceId) &&
    DATE.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) &&
    TIME.test(time) &&
    Number.isInteger(minutes) && minutes >= 5 && minutes <= 480 &&
    Number.isInteger(capacity) && capacity >= 1 && capacity <= 200;
  if (!valid) return json({ message: 'Please check the class, date, time, length and capacity.' }, 400);

  // The form is in the studio's local time. The API needs UTC.
  let start;
  let end;
  try {
    start = zonedToUtcIso(date, time, tenant.timeZone || 'Asia/Kolkata');
    end = new Date(Date.parse(start) + minutes * 60000).toISOString();
  } catch {
    return json({ message: 'Please check the date and time.' }, 400);
  }
  if (Date.parse(start) <= Date.now()) return json({ message: 'Choose a start time in the future.' }, 400);

  try {
    const res = await tarunam('POST', '/schedules', {
      tenant,
      body: { resource_id: resourceId, start_time: start, end_time: end, capacity },
    });
    if (res.status === 201) {
      audit(context, 'add-session', `${res.data.id} ${start}`);
      return json({ id: res.data.id }, 201);
    }
    if (res.status === 409) return json({ message: 'That time overlaps another session for this class.' }, 409);
    if (res.status === 404) return json({ message: 'That class does not exist.' }, 404);
    const e = staffError(res);
    return json({ message: e.message }, e.status);
  } catch (err) {
    console.error('[staff/session-create] booking service unreachable:', err.message);
    return json({ message: 'The booking service is unavailable. Please try again.' }, 503);
  }
}