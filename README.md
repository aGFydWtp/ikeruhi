# アケナ（調整の神）

LINEグループに入れて、飲み会などの日程を「空いてない条件」から候補3日に絞るbot。

- 仕様書: https://claude.ai/artifact/E238jo2iZzDuZPjC4fp7nd
- 構成: [Void](https://void.cloud)（Cloudflare Workers + D1 + Cron Triggers）、LIFFはReact

## ローカル開発

Node.js 24.22 以上が必要（Void の要件）。

```sh
npm install
cat > .env <<'ENV'
LINE_CHANNEL_SECRET=test-secret-local
LINE_CHANNEL_ACCESS_TOKEN=dummy   # dummy なら LINE に送らずログに出す
LIFF_ID=dev-liff
LINE_LOGIN_CHANNEL_ID=dev
ENV
npx void db migrate    # ローカルの D1 にマイグレーション
npm run dev            # http://localhost:5173
npm test               # 集計ロジックのテスト
```

- LIFF 画面はローカルでは `http://localhost:5173/liff?dev=Ua&e=<イベントID>` のように `dev=` を付けると LINE なしで開ける（開発サーバーのときだけ）。
- Cron はローカルでは自動で動かない。起動時に表示される `/__void/scheduled` の curl で1回ずつ動かす。

## 構成

| 場所 | 中身 |
| --- | --- |
| `routes/api/line/webhook.ts` | LINE Webhook。署名検証、招待→自己紹介カード、メンション→作成カード、［もう一度調整する］ |
| `routes/api/events/` | LIFF から呼ぶ API（作成、回答、期間と締切の変更） |
| `pages/liff.tsx`, `src/ui/` | LIFF の画面（②作成、③ざっくり回答、④候補に答える、期間を延ばす） |
| `crons/tick.ts` | 毎分。締切・候補の締切・仮決定の期限を見て状態を進め、予約された告知を出す |
| `src/core/` | 日付と集計の純粋な関数（テストあり） |
| `src/server/engine.ts` | 状態の進め方と告知 |
| `src/line/` | LINE API と Flex カード |

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
npx void secret put LINE_CHANNEL_SECRET        # Messaging API チャネル
npx void secret put LINE_CHANNEL_ACCESS_TOKEN  # Messaging API チャネル（長期）
```

LIFF ID と LINE ログインのチャネルID は秘密ではないので `env.ts` の既定値に入れている。

告知のルール（5分まとめ、夜22時〜朝8時は8時まで待つ）や状態の流れは仕様書を参照。

初回デプロイ後に `void.lock.json` をコミットする。
