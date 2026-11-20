import { SESSION_COOKIE } from '../lib/session.js';
import { TENANTS } from '../lib/tenants.js';
import { staffCookieName } from '../lib/staff.js';

function signOut({ cookies, redirect }) {
  cookies.delete(SESSION_COOKIE, { path: '/' });
  // Signing out also ends any staff session
  for (const slug of Object.keys(TENANTS)) cookies.delete(staffCookieName(slug), { path: '/' });
  return redirect('/login');
}

// Works for a sign-out form (POST) and a plain sign-out link (GET)
export const GET = signOut;
export const POST = signOut;