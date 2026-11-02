import { useState } from 'react'
import { MessageSquareQuote, Plus, Trash2, Check } from 'lucide-react'
import { Button, Card, ErrorBox } from '../components/ui'
import { api } from '../lib/api'
import { PROMPT_QUESTIONS, friendlyError } from '../lib/constants'

// Até 3 perguntas com resposta, que aparecem no perfil e ajudam a puxar assunto
export default function PromptsEditor({ initial = [], onSaved }) {
  const [items, setItems] = useState(initial.length ? initial : [{ q: PROMPT_QUESTIONS[0], a: '' }])
  const [saving, setSaving] = useState(false)
  const [ok, setOk] = useState(false)
  const [error, setError] = useState('')
  const set = (i, k, v) => { setOk(false); setItems(list => list.map((it, j) => (j === i ? { ...it, [k]: v } : it))) }
  const used = items.map(i => i.q)

  async function save() {
    setSaving(true); setError('')
    try {
      const prompts = items.filter(i => i.a.trim()).map(i => ({ q: i.q, a: i.a.trim().slice(0, 150) }))
      await api.updateProfile({ prompts }); setOk(true); onSaved?.()
    } catch (e) { setError(friendlyError(e)) } finally { setSaving(false) }
  }

  return (
    <Card className="p-5">
      <div className="font-display font-semibold text-[18px] flex items-center gap-2"><MessageSquareQuote className="w-5 h-5 text-violet" />Perguntas do perfil</div>
      <p className="text-[13px] text-ink-soft mt-1">Responda até 3. Elas aparecem no seu perfil e facilitam puxar assunto.</p>
      <div className="mt-4 space-y-4">
        {items.map((it, i) => (
          <div key={i} className="rounded-2xl bg-surface-low p-3 space-y-2">
            <div className="flex gap-2">
              <select id={`prompt-q-${i}`} aria-label="Pergunta" value={it.q} onChange={e => set(i, 'q', e.target.value)} className="field !py-2.5 !bg-card flex-1 min-w-0">
                {PROMPT_QUESTIONS.filter(q => q === it.q || !used.includes(q)).map(q => <option key={q}>{q}</option>)}
              </select>
              <button onClick={() => { setOk(false); setItems(l => l.filter((_, j) => j !== i)) }} aria-label="Remover pergunta" className="p-2 text-secondary"><Trash2 className="w-5 h-5" /></button>
            </div>
            <textarea id={`prompt-a-${i}`} aria-label="Sua resposta" rows={2} maxLength={150} value={it.a} onChange={e => set(i, 'a', e.target.value)} placeholder="Sua resposta…" className="field !bg-card resize-none" />
            <div className="text-right text-[11px] text-ink-mute">{it.a.length}/150</div>
          </div>
        ))}
      </div>
      {items.length < 3 && <button onClick={() => setItems(l => [...l, { q: PROMPT_QUESTIONS.find(q => !used.includes(q)), a: '' }])} className="mt-3 inline-flex items-center gap-1.5 text-primary font-semibold text-[14px]"><Plus className="w-4 h-4" />Adicionar pergunta</button>}
      <div className="mt-3"><ErrorBox>{error}</ErrorBox></div>
      <Button variant="ocean" className="w-full mt-3" onClick={save} loading={saving}>{ok ? <><Check className="w-5 h-5" />Salvo</> : 'Salvar respostas'}</Button>
    </Card>
  )
}
