import { useEffect, useState } from 'react';
import { api, setDevUser, setIdToken } from '../src/ui/api.ts';
import { CreateView, Done, type EventView, PeriodView, RecheckView, RoughView } from '../src/ui/views.tsx';
import type { Props } from './liff.server';
import '../src/ui/liff.css';

type Screen =
  | { kind: 'loading' }
  | { kind: 'error'; text: string }
  | { kind: 'create'; token: string; name: string }
  | { kind: 'event'; view: 'rough' | 'recheck' | 'period'; data: EventView };

export default function LiffPage({ liffId }: Props) {
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });

  useEffect(() => {
    (async () => {
      try {
        await signIn(liffId);
        const q = new URLSearchParams(location.search);
        const token = q.get('c');
        const eventId = q.get('e');
        if (token) {
          const t = await api<{ name: string }>(`/api/tokens/${encodeURIComponent(token)}`);
          setScreen({ kind: 'create', token, name: t.name });
          return;
        }
        if (eventId) {
          const data = await api<EventView>(`/api/events/${encodeURIComponent(eventId)}`);
          const view = q.get('v') === 'period' ? 'period' : data.event.status === 'collecting' ? 'rough' : 'recheck';
          setScreen({ kind: 'event', view, data });
          return;
        }
        setScreen({ kind: 'error', text: 'グループのカードから開いてください' });
      } catch (e) {
        const status = (e as { status?: number }).status;
        setScreen({
          kind: 'error',
          text: status === 404 ? 'このカードは期限切れか、見つかりません' : '開けませんでした',
        });
      }
    })();
  }, [liffId]);

  switch (screen.kind) {
    case 'loading':
      return <Done text="…" />;
    case 'error':
      return <Done text={screen.text} />;
    case 'create':
      return <CreateView token={screen.token} initialName={screen.name} />;
    case 'event':
      if (screen.view === 'period') return <PeriodView data={screen.data} />;
      if (screen.view === 'rough') return <RoughView data={screen.data} />;
      return <RecheckView data={screen.data} />;
  }
}

async function signIn(liffId: string) {
  const q = new URLSearchParams(location.search);
  // ローカル開発：?dev=ユーザー名 で LIFF なしに開ける（サーバー側も dev のときだけ受け付ける）
  const dev = q.get('dev');
  if (import.meta.env.DEV && dev) {
    setDevUser(dev, dev);
    return;
  }
  const liff = window.liff;
  if (!liff || !liffId) throw new Error('LIFF is not available');
  await liff.init({ liffId });
  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri: location.href });
    await new Promise(() => {}); // リダイレクトを待つ
  }
  const token = liff.getIDToken();
  if (!token) throw new Error('no id token');
  setIdToken(token);
}
