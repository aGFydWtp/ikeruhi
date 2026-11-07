import { defineEnv, string } from 'void/env';

// LINE チャネルができるまでデプロイを止めないよう optional にしている。
// 未設定のあいだ Webhook は 503 を返す。
export default defineEnv({
  LINE_CHANNEL_SECRET: string().optional(),
  LINE_CHANNEL_ACCESS_TOKEN: string().optional(),
});
