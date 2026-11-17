import { cookieName } from '../../lib/user.js';

export function POST({ cookies, locals, redirect }) {
  const tenant = locals.tenant;
  cookies.delete(cookieName(tenant.slug), { path: '/' });
  return redirect(`/${tenant.slug}`);
}