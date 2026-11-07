import { defineEnv, string } from 'void/env';

// LINE の準備ができるまでデプロイを止めないよう optional にしている。
// 未設定のあいだ Webhook は 503、LIFF の API は 503 を返す。
export default defineEnv({
  /** Messaging API チャネルのチャネルシークレット */
  LINE_CHANNEL_SECRET: string().optional(),
  /** Messaging API チャネルの長期アクセストークン */
  LINE_CHANNEL_ACCESS_TOKEN: string().optional(),
  // 下の2つは秘密ではないので既定値をコードに置く（.env で上書きできる）
  /** LINE ログインチャネルのチャネルID（LIFF の ID トークン検証用） */
  LINE_LOGIN_CHANNEL_ID: string().default('2012443575'),
  /** LIFF アプリの ID */
  LIFF_ID: string().default('2012443575-8xiOJ7hT'),
});
