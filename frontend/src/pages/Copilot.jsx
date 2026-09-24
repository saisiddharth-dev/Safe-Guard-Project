import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, MessageCircle } from 'lucide-react';
import { api } from '../api';
import { Card, Icon } from '../components/UI';
import { useI18n } from '../i18n';

const SUGGESTIONS = [
  { q: 'Which site has the highest SIF precursor density?' },
  { q: 'Compare Assam and Rajasthan.' },
  { q: 'Show top SIF activities this quarter.' },
  { q: 'Which LSR has deteriorated most?' },
  { q: 'Show recurring barrier failures.' },
  { q: 'Which contractors have the highest precursor density?' },
  { q: 'What changed after the last intervention?' },
  { q: 'Why has Energy Isolation risk increased?' },
  { q: 'Whats the enterprise summary?' },
];

export default function Copilot() {
  const { t } = useI18n();
  const [messages, setMessages] = useState([
    { role: 'ai', text: t('Namaste. I am the **OIL Safety Copilot**. Ask me anything about your safety data — site risk, activities, contractors, patterns, CAPA or interventions.'), time: new Date() },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const ask = async (q) => {
    if (!q.trim() || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: q, time: new Date() }]);
    setBusy(true);
    try {
      const r = await api.post('/copilot', { query: q });
      setMessages((m) => [...m, { role: 'ai', text: r.answer, time: new Date() }]);
      if (r.buttons?.length) setMessages((m) => [...m, { role: 'ai-buttons', buttons: r.buttons, time: new Date() }]);
    } catch {
      setMessages((m) => [...m, { role: 'ai', text: 'I could not reach the AI Brain service. Ensure the Python service is running on port 8050.', time: new Date() }]);
    }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-extrabold text-white sm:text-2xl"><Icon name="bot" size={20} className="shrink-0" /> <span className="min-w-0 break-words">{t('Safety Copilot')}</span></h1>
        <p className="text-sm text-slate-500">{t('Ask-the-dashboard AI · natural-language analytics')}</p>
      </div>

      <Card className="mx-auto flex max-h-[72vh] w-full max-w-5xl flex-col xl:max-w-6xl">
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {messages.map((m, i) => <Message key={i} m={m} onAction={ask} />)}
          {busy && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="animate-spin text-brand" size={14} /> {t('AI Brain reasoning…')}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="mt-3 border-t border-ink-700 pt-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button key={s.q} onClick={() => ask(s.q)} className="tap rounded-full border border-ink-600 bg-ink-800 px-4 py-1 text-[11px] text-left text-slate-400 hover:border-brand hover:text-white sm:px-2.5 sm:text-center">
                {t(s.q)}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder={t('Ask the OIL Safety Intelligence…')}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && ask(input)}
            />
            <button className="btn-primary" onClick={() => ask(input)} disabled={busy || !input.trim()}><Send size={15} /></button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Format({ text }) {
  const out = [];
  const lines = String(text || '').split('\n');
  return (
    <span>
      {lines.map((ln, i) => (
        <span key={i}>{i > 0 && <br />}{formatInline(ln, out)}</span>
      ))}
    </span>
  );
}

function formatInline(line, keySeed) {
  const parts = String(line || '').split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <b key={`${keySeed.length}-${i}`} className="text-white">{p.slice(2, -2)}</b>;
    return <span key={`${keySeed.length}-${i}`}>{p}</span>;
  });
}

function Message({ m, onAction }) {
  const { t } = useI18n();
  if (m.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] min-w-0 break-words rounded-2xl rounded-br-sm bg-brand px-4 py-2.5 text-sm text-white">{m.text}</div>
      </div>
    );
  }
  if (m.role === 'ai-buttons') {
    return (
      <div className="flex flex-wrap gap-1.5">
        {m.buttons.map((b) => {
          const actions = { 'View reports': '/reports?view=all', 'View sites': '/sites', 'View contractors': '/contractors', 'Create intervention': '/capa', 'View CAPA': '/capa', 'View alerts': '/alerts', 'View precursors': '/precursors', 'View analytics': '/analytics', 'View activities ranking': '/precursors', 'View barrier intelligence': '/precursors', 'View geographic risk map': '/riskmap', 'Command Center': '/', 'View intervention effectiveness': '/precursors' };
          const to = actions[b];
          return to
            ? <a key={b} href={to} className="tap items-center gap-1 rounded-full border border-brand/40 bg-brand/10 px-4 py-1 text-[11px] font-semibold text-left text-brand hover:bg-brand/20 sm:px-3 sm:text-center">{t(b)}<Icon name="arrow" size={13} /></a>
            : <button key={b} onClick={() => onAction(b)} className="tap rounded-full border border-ink-600 bg-ink-800 px-4 py-1 text-[11px] font-semibold text-left text-slate-300 sm:px-3 sm:text-center">{t(b)}</button>;
        })}
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-cyan-500"><MessageCircle size={14} className="text-white" /></div>
      <div className="max-w-[85%] min-w-0 break-words rounded-2xl rounded-bl-sm border border-ink-700 bg-ink-800 px-4 py-2.5 text-sm text-slate-200"><Format text={m.text} /></div>
    </div>
  );
}