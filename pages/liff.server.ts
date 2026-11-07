import { defineHandler, defineHead, type InferProps } from 'void';
import { env } from 'void/env';

// LIFF は LINE の中で SDK を初期化してから動くので、クライアントだけで描く
export const ssr = false;

export const loader = defineHandler(() => {
  return { liffId: env.LIFF_ID ?? '' };
});

export type Props = InferProps<typeof loader>;

export const head = defineHead(() => ({
  title: 'いけるひ',
  htmlAttrs: { lang: 'ja' },
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' }],
  link: [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700&display=swap' },
  ],
  script: [{ src: 'https://static.line-scdn.net/liff/edge/2/sdk.js', charset: 'utf-8' }],
}));
