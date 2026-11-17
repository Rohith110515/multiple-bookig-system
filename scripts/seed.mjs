import { tarunam } from '../src/lib/tarunam.js';
import { TENANTS } from '../src/lib/tenants.js';

function fail(label, res) {
  console.error(`${label} failed: ${res.status} ${JSON.stringify(res.data)}`);
  process.exit(1);
}

const CLASSES = [
  { name: 'Morning Yoga', weekdays: [1, 2, 3, 4, 5, 6], start_times: ['06:30'], duration_minutes: 60, capacity: 10 },
  { name: 'Evening HIIT', weekdays: [1, 3, 5], start_times: ['18:00', '19:15'], duration_minutes: 45, capacity: 8 },
  { name: 'Weekend Pilates', weekdays: [6, 7], start_times: ['09:00', '10:15'], duration_minutes: 60, capacity: 6 },
];

for (const tenant of Object.values(TENANTS)) {
  console.log(`\n--- Seeding ${tenant.name} (${tenant.slug}) ---`);

  const settings = await tarunam('PUT', '/settings', {
    tenant,
    body: { min_lead_minutes: 30, max_horizon_minutes: 20160, min_cancel_notice_minutes: 120 },
  });
  if (settings.status !== 200) fail('settings', settings);
  console.log('Booking rules saved.');

  let type = await tarunam('POST', '/resource-types', {
    tenant,
    body: { name: 'Classes', description: 'Group classes' },
  });
  if (type.status === 409) {
    const list = await tarunam('GET', '/resource-types', { tenant });
    type = { status: 201, data: list.data.find((t) => t.name === 'Classes') };
  }
  if (type.status !== 201) fail('resource type', type);

  for (const c of CLASSES) {
    let resource = await tarunam('POST', '/resources', {
      tenant,
      body: { resource_type_id: type.data.id, name: c.name },
    });
    if (resource.status === 409) {
      const list = await tarunam('GET', '/resources', { tenant });
      resource = { status: 201, data: list.data.find((r) => r.name === c.name) };
    }
    if (resource.status !== 201) fail(`resource ${c.name}`, resource);

    const existing = await tarunam('GET', '/series', { tenant, query: { resource_id: resource.data.id } });
    if (existing.status === 200 && existing.data.some((s) => s.status === 'active')) {
      console.log(`${c.name}: timetable already exists`);
      continue;
    }

    const series = await tarunam('POST', '/series', {
      tenant,
      body: {
        resource_id: resource.data.id,
        weekdays: c.weekdays,
        start_times: c.start_times,
        duration_minutes: c.duration_minutes,
        time_zone: 'Asia/Kolkata',
        capacity: c.capacity,
      },
    });
    if (series.status !== 201) fail(`series ${c.name}`, series);
    console.log(`${c.name}: created ${series.data.sessions_created} sessions`);
  }
}

console.log('\nDone.');