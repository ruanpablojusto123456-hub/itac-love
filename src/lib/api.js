// Escolhe automaticamente o backend:
//  - com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env → Supabase (produção)
//  - sem eles → MODO DEMONSTRAÇÃO (tudo no navegador, para testar)
import { demoBackend, _internals } from './demoBackend'
import { createDemoSocial } from './demoSocial'
import { createSupabaseBackend } from './supabaseBackend'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
const useSupabase = !!(url && key && !url.includes('SEU-PROJETO'))

function buildDemo() {
  const social = createDemoSocial(_internals)
  const baseDash = demoBackend.adminDashboard.bind(demoBackend)
  Object.assign(demoBackend, social, {
    async adminDashboard() { return { ...(await baseDash()), ...(await social.adminDashboardExtra()) } },
  })
  return demoBackend
}

export const api = useSupabase ? createSupabaseBackend(url, key) : buildDemo()
export const isDemo = api.mode === 'demo'
