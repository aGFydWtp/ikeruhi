# いけるひ

LINEグループに入れて、飲み会などの日程を「空いてない条件」から候補3日に絞るbot。

- 仕様書: https://claude.ai/artifact/E238jo2iZzDuZPjC4fp7nd
- 構成: [Void](https://void.cloud)（Cloudflare Workers + D1 + Cron Triggers）、LIFFはReact

## ローカル開発

Node.js 24.22 以上が必要（Void の要件）。

```sh
npm install
printf "LINE_CHANNEL_SECRET=\nLINE_CHANNEL_ACCESS_TOKEN=\n" > .env   # 値を入れる（env.ts 参照）
npm run dev            # http://localhost:5173
```

### Webhook 署名検証を手で試す

```sh
printf '{"destination":"U","events":[]}' > /tmp/body.json
SIG=$(openssl dgst -sha256 -hmac "$LINE_CHANNEL_SECRET" -binary /tmp/body.json | base64)
curl -X POST http://localhost:5173/api/line/webhook \
  -H "x-line-signature: $SIG" --data-binary @/tmp/body.json
```

## デプロイ

```sh
npx void deploy --platform cloudflare     # 初回はブラウザでCloudflareにログイン
npx void secret put LINE_CHANNEL_SECRET
npx void secret put LINE_CHANNEL_ACCESS_TOKEN
```

初回デプロイ後に `void.lock.json` をコミットする。
