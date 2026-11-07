import { defineConfig } from 'void/config';

export default defineConfig({
  routing: {
    typedRoutes: true,
  },
  worker: {
    compatibility_date: '2026-02-24',
  },
  cloudflare: {
    name: 'ikeruhi',
    observability: { enabled: true },
  },
});
