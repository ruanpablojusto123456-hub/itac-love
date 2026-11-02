import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { BottomBar, Button, Chip, ErrorBox, Spinner, StepHeader } from '../components/ui'
import { api } from '../lib/api'
import { TAG_CATEGORIES, friendlyError } from '../lib/constants'

export default function InterestsStep() {
  const nav = useNavigate()
  const [tags, setTags] = useState(null)
  const [sel, setSel] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { Promise.all([api.listTags(), api.getMyInterests()]).then(([t, s]) => { setTags(t); setSel(s) }) }, [])
  const toggle = (id) => setSel(s => s.includes(id) ? s.filter(x => x !== id) : s.length >= 15 ? s : [...s, id])

  async function next() {
    if (sel.length < 3) return setError('Escolha pelo menos 3 interesses.')
    setSaving(true); setError('')
    try { await api.setInterests(sel); nav('/cadastro/verificacao') } catch (e) { setError(friendlyError(e)) } finally { setSaving(false) }
  }

  return (
    <div className="pb-32">
      <StepHeader step={3} title="Seus interesses" subtitle="Interesses · 75%" back="/cadastro/fotos" />
      <main className="max-w-xl mx-auto px-4 pt-5 space-y-6">
        <div>
          <h1 className="text-[26px] font-bold leading-tight">Do que você curte?</h1>
          <p className="text-ink-soft mt-1">Escolha no mínimo <b>3 tags</b>. Elas calculam a <span className="text-violet font-semibold">afinidade</span> com outras pessoas e aparecem em destaque quando vocês têm algo em comum.</p>
        </div>
        <div className="sticky top-[124px] z-10 flex items-center gap-2 rounded-full bg-card shadow-sm px-4 py-2 w-fit text-[14px] font-semibold">
          <Sparkles className="w-4 h-4 text-violet" /><span className={sel.length >= 3 ? 'text-tertiary' : 'text-ink-soft'}>{sel.length} selecionada{sel.length !== 1 ? 's' : ''}</span><span className="text-ink-mute">· mín. 3</span>
        </div>
        {!tags ? <Spinner /> : TAG_CATEGORIES.map(c => (
          <section key={c.id}>
            <h2 className="font-display font-semibold text-[18px] mb-2.5">{c.emoji} {c.label}{c.id === 'filhos' && <span className="text-[13px] text-ink-soft font-sans font-normal"> · tem / quer ter</span>}</h2>
            <div className="flex flex-wrap gap-2">
              {tags.filter(t => t.category === c.id).map(t => <Chip key={t.id} active={sel.includes(t.id)} onClick={() => toggle(t.id)}>{t.label}</Chip>)}
            </div>
          </section>
        ))}
        <ErrorBox>{error}</ErrorBox>
      </main>
      <BottomBar>
        <Button onClick={next} loading={saving} disabled={sel.length < 3} className="w-full">
          {sel.length >= 3 ? <>Continuar para Verificação<ArrowRight className="w-5 h-5" /></> : `Escolha mais ${3 - sel.length}`}
        </Button>
      </BottomBar>
    </div>
  )
}
