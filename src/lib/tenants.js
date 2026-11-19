const env = (key) => import.meta.env?.[key] ?? process.env[key];

// Each studio: slug (URL segment and Tarunam tenant id), display name,
// signing secret (from .env, server-side only), time zone, and accent colour.
export const TENANTS = {
  'glow-studio': {
    slug: 'glow-studio',
    name: 'Glow Studio',
    secret: env('SECRET_GLOW_STUDIO'),
    timeZone: 'Asia/Kolkata',
    color: '#4f46e5',
  },
  'iron-gym': {
    slug: 'iron-gym',
    name: 'Iron Gym',
    secret: env('SECRET_IRON_GYM'),
    timeZone: 'Asia/Kolkata',
    color: '#ea580c',
  },
};

export function getTenant(slug) {
  return slug && Object.hasOwn(TENANTS, slug) ? TENANTS[slug] : null;
}