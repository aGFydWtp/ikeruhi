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
    // ダッシュボード側の現状に合わせて明示する（Void が公開範囲を勝手に変えないように）
    workers_dev: true,
    preview_urls: true,
    routes: [],
  },
});
