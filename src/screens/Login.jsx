import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, Heart, KeyRound, Lock, Mail, ShieldCheck, BadgeCheck, Info } from 'lucide-react'
import { Button, Card, ErrorBox, Logo } from '../components/ui'
import { api, isDemo } from '../lib/api'
import { friendlyError } from '../lib/constants'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="w-6 h-6" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
  )
}

export default function Login() {
  const [tab, setTab] = useState('entrar')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [resetArmed, setResetArmed] = useState(false)

  async function submit(e) {
    e.preventDefault(); setError(''); setInfo(''); setLoading(true)
    try {
      if (tab === 'entrar') await api.signInEmail(email, password)
      else await api.signUpEmail(email, password)
    } catch (err) {
      const m = friendlyError(err)
      if (m.startsWith('Enviamos')) setInfo(m); else setError(m)
    } finally { setLoading(false) }
  }
  async function google() {
    setError(''); setLoading(true)
    try { await api.signInGoogle() } catch (err) { setError(friendlyError(err)) } finally { setLoading(false) }
  }
  async function forgot() {
    if (!email) return setError('Digite seu e-mail acima para receber o link de redefinição.')
    try { await api.resetPassword(email); setInfo('Se o e-mail estiver cadastrado, você receberá um link para criar nova senha.') } catch (err) { setError(friendlyError(err)) }
  }

  return (
    <div className="min-h-screen px-4 pb-10">
      <div className="max-w-md mx-auto">
        <div className="flex flex-col items-center pt-8">
          <Logo className="w-64 sm:w-72" />
          <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-secondary-fixed/70 px-4 py-1.5 text-[14px] font-semibold text-ink"><Heart className="w-4 h-4 text-secondary" />O amor às margens do Velho Chico</span>
          <p className="mt-3 text-center text-ink-soft text-[17px] leading-relaxed">Conexões reais, seguras e com a sua energia em Itacarambi e região.</p>
        </div>

        <Card className="mt-7 p-5 sm:p-6">
          <div className="grid grid-cols-2 bg-surface-mid rounded-xl p-1 mb-5" role="tablist">
            {[['entrar', 'Entrar'], ['criar', 'Criar Conta']].map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setError(''); setInfo('') }}
                className={`py-2.5 rounded-lg font-display font-semibold text-[16px] transition ${tab === id ? 'bg-white text-primary shadow' : 'text-ink-soft'}`}>{label}</button>
            ))}
          </div>

          <button onClick={google} disabled={loading} className="w-full flex items-center justify-center gap-3 rounded-full bg-surface-low hover:bg-surface-mid py-3.5 font-display font-semibold text-[17px] transition disabled:opacity-60">
            <GoogleIcon />Continuar com Google
          </button>

          <div className="flex items-center gap-3 my-5 text-ink-mute text-[14px]"><span className="h-px flex-1 bg-surface-highest" />ou com seu e-mail<span className="h-px flex-1 bg-surface-highest" /></div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2"><label htmlFor="email" className="font-semibold text-[15px]">E-mail</label><span className="inline-flex items-center gap-1 text-tertiary text-[13px] font-semibold"><Lock className="w-3.5 h-3.5" />Protegido</span></div>
              <div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-mute" />
                <input id="email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seuemail@exemplo.com" className="field pl-12" /></div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2"><label htmlFor="pw" className="font-semibold text-[15px]">Senha</label>
                {tab === 'entrar' && <button type="button" onClick={forgot} className="text-primary text-[13px] font-semibold">Esqueceu a senha?</button>}</div>
              <div className="relative"><KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-mute" />
                <input id="pw" type={show ? 'text' : 'password'} required minLength={6} autoComplete={tab === 'entrar' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder={tab === 'entrar' ? 'Sua senha secreta' : 'Crie uma senha (mín. 6 caracteres)'} className="field pl-12 pr-12" />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-mute" aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}>{show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button></div>
            </div>
            <ErrorBox>{error}</ErrorBox>
            {info && <div className="rounded-xl bg-tertiary-fixed/40 text-tertiary px-4 py-3 text-[14px] font-semibold">{info}</div>}
            <Button type="submit" loading={loading} className="w-full">{tab === 'entrar' ? 'Entrar na Minha Conta' : 'Criar Minha Conta'}<ArrowRight className="w-5 h-5" /></Button>
          </form>
        </Card>

        <div className="mt-5 rounded-2xl bg-surface-low p-5 flex gap-4">
          <div className="w-11 h-11 shrink-0 rounded-full bg-secondary-fixed/70 flex items-center justify-center"><ShieldCheck className="w-5 h-5 text-secondary" /></div>
          <div>
            <div className="flex flex-wrap items-center gap-2"><span className="bg-secondary text-white text-[12px] font-bold rounded-full px-2.5 py-0.5">18+ OBRIGATÓRIO</span><span className="font-display font-semibold">Comunidade Segura</span></div>
            <p className="mt-1.5 text-[14px] text-ink-soft leading-relaxed">Ambiente restrito a maiores de idade. Perfis falsos, assédio e golpes são banidos de forma permanente. Seus dados são protegidos conforme a LGPD.</p>
          </div>
        </div>
        <div className="mt-4 flex justify-center gap-6 text-[13px] font-semibold text-ink-soft">
          <span className="inline-flex items-center gap-1.5"><BadgeCheck className="w-4 h-4 text-tertiary" />Perfis Verificados</span>
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-primary" />Moderação Humana</span>
        </div>
        <p className="mt-6 text-center text-[13px] text-ink-soft">Ao continuar, você concorda com os <Link to="/termos" className="text-primary underline">Termos de Uso</Link> e a <Link to="/privacidade" className="text-primary underline">Política de Privacidade</Link> do ITAC LOVE.</p>

        {isDemo && (
          <div className="mt-6 rounded-2xl border-2 border-dashed border-violet/40 bg-violet/5 p-4 text-[13px] text-ink-soft">
            <div className="flex items-center gap-2 font-bold text-violet mb-1"><Info className="w-4 h-4" />Como testar (modo demonstração)</div>
            1. Clique em <b>Criar Conta</b> e faça o cadastro completo.<br />
            2. Abra o <Link to="/admin" className="text-primary underline font-semibold">Painel do Administrador</Link> (e-mail <b>admin@itaclove.com</b>, senha <b>admin123</b>) e aprove seu cadastro.<br />
            3. Volte ao app: a tela de aguardo libera o acesso na hora.
            <button onClick={() => { if (resetArmed) { api.reset(); setResetArmed(false) } else setResetArmed(true) }} className="block mt-2 text-secondary font-semibold underline">{resetArmed ? 'Toque de novo para apagar tudo' : 'Zerar demonstração'}</button>
          </div>
        )}
      </div>
    </div>
  )
}
