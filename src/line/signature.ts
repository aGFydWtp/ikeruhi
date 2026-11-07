// LINE Messaging API の Webhook 署名検証。
// x-line-signature = base64(HMAC-SHA256(channelSecret, 受け取ったままの本文))
const encoder = new TextEncoder();

export async function verifyLineSignature(
  channelSecret: string,
  rawBody: ArrayBuffer,
  signature: string | null | undefined,
): Promise<boolean> {
  if (!signature) return false;
  let expected: Uint8Array<ArrayBuffer>;
  try {
    expected = Uint8Array.from(atob(signature), (ch) => ch.charCodeAt(0));
  } catch {
    return false;
  }
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(channelSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  // subtle.verify は定数時間で比較する
  return crypto.subtle.verify('HMAC', key, expected, rawBody);
}
