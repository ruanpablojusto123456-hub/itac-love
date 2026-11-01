import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api } from './api'
import { showNotification } from './notify'

const Ctx = createContext(null)

export function SessionProvider({ children }) {
  const [state, setState] = useState({ loading: true, user: null, profile: null, isAdmin: false })

  const refresh = useCallback(async () => {
    try {
      const user = await api.getSessionUser()
      if (!user) return setState({ loading: false, user: null, profile: null, isAdmin: false })
      const isAdmin = await api.isAdmin()
      const profile = isAdmin ? null : await api.getMyProfile()
      setState({ loading: false, user, profile, isAdmin })
    } catch (e) {
      console.error(e)
      setState(s => ({ ...s, loading: false }))
    }
  }, [])

  useEffect(() => { refresh(); return api.onChange(refresh) }, [refresh])

  // Notifica o resultado da verificação quando o status muda
  const prev = useRef(null)
  useEffect(() => {
    const st = state.profile?.status
    if (prev.current === 'pending_review' && st && st !== 'pending_review') {
      const msg = { approved: ['Perfil aprovado! 💙', 'Seu perfil foi verificado. O ITAC LOVE está liberado!'],
        rejected: ['Verificação reprovada', state.profile.rejection_reason || ''],
        needs_new_photo: ['Precisamos de uma nova foto', state.profile.rejection_reason || ''] }[st]
      if (msg) showNotification(...msg)
    }
    prev.current = st || null
  }, [state.profile?.status, state.profile?.rejection_reason])
  return <Ctx.Provider value={{ ...state, refresh }}>{children}</Ctx.Provider>
}

export const useSession = () => useContext(Ctx)

// Para onde o usuário deve ir de acordo com o status da conta
export function homeFor({ user, profile, isAdmin }) {
  if (!user) return '/entrar'
  if (isAdmin) return '/admin'
  if (!profile) return '/entrar'
  switch (profile.status) {
    case 'approved': return '/app/descobrir'
    case 'onboarding': return '/cadastro/perfil'
    default: return '/aguardando' // pending_review, needs_new_photo, rejected, under_review, suspended, banned
  }
}
