import { useEffect, useState } from 'react'
import { Save, CheckCircle2 } from 'lucide-react'
import { Button, Card, ErrorBox, Spinner } from '../components/ui'
import { api } from '../lib/api'
import { friendlyError } from '../lib/constants'

function Num({ label, k, s, set, suffix, cents }) {
  const v = s[k]
  return (
    <label className="block">
      <span className="text-[13px] font-semibold text-ink-soft">{label}</span>
      <div className="relative mt-1">
        <input type="number" min={0} step={cents ? '0.01' : '1'} className="field bg-surface-low pr-16" value={cents ? (v / 100).toFixed(2) : v}
          onChange={e => set(k, cents ? Math.round(parseFloat(e.target.value || 0) * 100) : parseInt(e.target.value || 0, 10))} />
        {suffix && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[13px] text-ink-mute">{suffix}</span>}
      </div>
    </label>
  )
}

export default function SettingsPage() {
  const [s, setS] = useState(null)
  const [words, setWords] = useState('')
  const [saving, setSaving] = useState(false)
  const [ok, setOk] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { api.getSettings().then(x => { setS(x); setWords((x.scam_words || []).join(', ')) }) }, [])
  const set = (k, v) => { setS(o => ({ ...o, [k]: v })); setOk(false) }

  async function save() {
    setSaving(true); setError('')
    try {
      const { id: _id, updated_at: _u, ...rest } = s
      await api.updateSettings({ ...rest, scam_words: words.split(',').map(w => w.trim().toLowerCase()).filter(Boolean) })
      setOk(true)
    } catch (e) { setError(friendlyError(e)) } finally { setSaving(false) }
  }
  if (!s) return <Spinner />
  const p = { s, set }
  return (
    <div className="max-w-4xl pb-10">
      <h1 className="text-[28px] font-bold">Configurações</h1>
      <p className="text-ink-soft text-[14px]">As mudanças valem na hora para web e APK, sem atualizar o aplicativo.</p>

      <Card className="p-5 mt-5">
        <h2 className="font-display font-semibold text-[18px]">Cotas diárias <span className="text-[13px] font-sans font-normal text-ink-soft">· renovam à meia-noite (Brasília)</span></h2>
        <p className="text-[13px] text-ink-soft mt-1">Mulheres (cis e trans) e travestis: curtidas e convites ilimitados.</p>
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <Num label="Homens — curtidas por dia" k="quota_male_likes" {...p} />
          <Num label="Homens — convites por dia" k="quota_male_invites" {...p} />
        </div>
        <div className="mt-5 rounded-xl bg-surface-low p-4">
          <div className="font-semibold text-[14px]">Não binários e demais identidades</div>
          <div className="flex gap-2 mt-2">
            {[[true, 'Ilimitado'], [false, 'Com limite']].map(([v, l]) => <button key={l} onClick={() => set('quota_other_unlimited', v)} className={`rounded-full px-4 py-2 text-[14px] font-semibold border ${s.quota_other_unlimited === v ? 'bg-primary text-white border-primary' : 'bg-white border-ink-line'}`}>{l}</button>)}
          </div>
          {!s.quota_other_unlimited && <div className="grid sm:grid-cols-2 gap-4 mt-3"><Num label="Curtidas por dia" k="quota_other_likes" {...p} /><Num label="Convites por dia" k="quota_other_invites" {...p} /></div>}
        </div>
      </Card>

      <Card className="p-5 mt-4">
        <h2 className="font-display font-semibold text-[18px]">Alerta de golpe no chat</h2>
        <p className="text-[13px] text-ink-soft mt-1">Palavras separadas por vírgula. Links externos sempre disparam o alerta.</p>
        <textarea className="field bg-surface-low mt-3" rows={3} value={words} onChange={e => { setWords(e.target.value); setOk(false) }} />
      </Card>

      <Card className="p-5 mt-4">
        <h2 className="font-display font-semibold text-[18px]">Nota de confiança</h2>
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <Num label="Nota inicial após aprovação" k="trust_initial" suffix="pts" {...p} />
          <Num label="Ganho por semana sem denúncias" k="trust_weekly_gain" suffix="pts" {...p} />
          <Num label="Perda por denúncia confirmada" k="trust_report_penalty" suffix="pts" {...p} />
          <Num label="Abaixo disso vai para revisão" k="trust_review_threshold" suffix="pts" {...p} />
        </div>
      </Card>

      <Card className="p-5 mt-4">
        <h2 className="font-display font-semibold text-[18px]">Preços (Pix)</h2>
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <Num label="Pacote de curtidas — preço" k="price_likes_pack_cents" cents suffix="R$" {...p} />
          <Num label="Pacote de curtidas — quantidade" k="likes_pack_size" {...p} />
          <Num label="Pacote de convites — preço" k="price_invites_pack_cents" cents suffix="R$" {...p} />
          <Num label="Pacote de convites — quantidade" k="invites_pack_size" {...p} />
          <Num label="Plano VIP mensal — preço" k="price_vip_month_cents" cents suffix="R$" {...p} />
        </div>
      </Card>

      <Card className="p-5 mt-4">
        <h2 className="font-display font-semibold text-[18px]">Match e encontro seguro</h2>
        <div className="grid sm:grid-cols-3 gap-4 mt-4">
          <Num label="Prazo do match" k="match_ttl_hours" suffix="horas" {...p} />
          <Num label="Lembrete antes de expirar" k="match_reminder_hours" suffix="horas" {...p} />
          <Num label="Espera do check-in" k="safe_date_grace_minutes" suffix="min" {...p} />
        </div>
      </Card>

      <Card className="p-5 mt-4">
        <h2 className="font-display font-semibold text-[18px]">Atualização do APK</h2>
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <label className="block"><span className="text-[13px] font-semibold text-ink-soft">Versão mais recente</span><input className="field bg-surface-low mt-1" value={s.latest_app_version} onChange={e => set('latest_app_version', e.target.value)} /></label>
          <label className="block"><span className="text-[13px] font-semibold text-ink-soft">Link para baixar o APK</span><input className="field bg-surface-low mt-1" value={s.apk_download_url || ''} onChange={e => set('apk_download_url', e.target.value)} placeholder="https://…/itac-love.apk" /></label>
        </div>
        <p className="text-[12px] text-ink-soft mt-2">Quem abrir um APK com versão menor verá o aviso para baixar a nova.</p>
      </Card>

      <div className="sticky bottom-4 mt-6 flex items-center gap-3">
        <Button variant="ocean" onClick={save} loading={saving}><Save className="w-5 h-5" />Salvar configurações</Button>
        {ok && <span className="inline-flex items-center gap-1 text-tertiary font-semibold"><CheckCircle2 className="w-5 h-5" />Salvo</span>}
        <ErrorBox>{error}</ErrorBox>
      </div>
    </div>
  )
}
