import { SESSION_COOKIE } from '../lib/session.js';

function signOut({ cookies, redirect }) {
  cookies.delete(SESSION_COOKIE, { path: '/' });
  return redirect('/login');
}

// Works for a sign-out form (POST) and a plain sign-out link (GET)
export const GET = signOut;
export const POST = signOut;