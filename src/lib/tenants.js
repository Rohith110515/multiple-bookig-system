const env = (key) => import.meta.env?.[key] ?? process.env[key];

export const TENANTS = {
  'glow-studio': {
    slug: 'glow-studio',
    name: 'Glow Studio',
    secret: env('SECRET_GLOW_STUDIO'),
  },
  'iron-gym': {
    slug: 'iron-gym',
    name: 'Iron Gym',
    secret: env('SECRET_IRON_GYM'),
  },
};

export function getTenant(slug) {
  return slug && Object.hasOwn(TENANTS, slug) ? TENANTS[slug] : null;
}