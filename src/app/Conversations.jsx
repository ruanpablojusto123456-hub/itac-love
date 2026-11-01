import { Link, useParams } from 'react-router-dom'
import { BadgeCheck, Clock, MessageCircle, Timer } from 'lucide-react'
import { Spinner } from '../components/ui'
import PhotoImg from '../components/PhotoImg'
import Chat from './Chat'
import { api } from '../lib/api'
import { formatLeft, useLive, useNow } from '../lib/hooks'

function ConversationList({ activeId }) {
  const { data } = useLive(() => api.listConversations())
  const now = useNow(30000)
  if (!data) return <Spinner />
  const matches = data.filter(c => c.match_id && !c.first_message_at)
  const chats = data.filter(c => !(c.match_id && !c.first_message_at))
  return (
    <div>
      {matches.length > 0 && (
        <section className="mb-5">
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-ink-soft mb-2">Novos matches · mandem um oi antes que expire</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {matches.map(c => {
              const left = new Date(c.expires_at) - now
              return (
                <Link key={c.conversation_id} to={`/app/conversas/${c.conversation_id}`} className="shrink-0 w-24 text-center">
                  <div className={`relative w-24 h-28 rounded-2xl overflow-hidden ring-4 ${left < 6 * 3600e3 ? 'ring-secondary' : 'ring-tertiary-green/60'}`}>
                    <PhotoImg path={c.other_photo} className="w-full h-full object-cover no-select" alt="" />
                    <span className="absolute bottom-1 inset-x-1 rounded-full bg-black/60 text-white text-[10px] font-bold py-0.5 flex items-center justify-center gap-0.5"><Clock className="w-3 h-3" />{formatLeft(left)}</span>
                  </div>
                  <div className="text-[13px] font-semibold mt-1 truncate">{c.other_name}</div>
                </Link>)
            })}
          </div>
        </section>
      )}
      <h2 className="text-[13px] font-bold uppercase tracking-wide text-ink-soft mb-2">Conversas</h2>
      {!chats.length ? <p className="text-ink-soft text-[14px] py-6 text-center">{matches.length ? 'Abra um match acima e mande a primeira mensagem.' : 'Nenhuma conversa ainda. Curta perfis no Descobrir ou aceite convites.'}</p> : (
        <ul className="space-y-1">{chats.map(c => (
          <li key={c.conversation_id}>
            <Link to={`/app/conversas/${c.conversation_id}`} className={`flex items-center gap-3 rounded-2xl p-2.5 transition ${activeId === c.conversation_id ? 'bg-secondary-fixed/50' : 'hover:bg-white'}`}>
              <PhotoImg path={c.other_photo} className="w-14 h-14 rounded-full object-cover shrink-0 no-select" alt="" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1"><b className="truncate">{c.other_name}</b>{c.other_verified && <BadgeCheck className="w-4 h-4 text-tertiary shrink-0" />}{c.self_destruct_seconds && <Timer className="w-4 h-4 text-violet shrink-0" aria-label="Autodestruição ativa" />}</div>
                <p className={`text-[14px] truncate ${c.unread ? 'text-ink font-semibold' : 'text-ink-soft'}`}>{c.last_body || 'Diga oi! 👋'}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {c.last_at && <span className="text-[11px] text-ink-mute">{new Date(c.last_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
                {c.unread > 0 && <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-secondary text-white text-[11px] font-bold flex items-center justify-center">{c.unread}</span>}
              </div>
            </Link>
          </li>))}</ul>
      )}
    </div>
  )
}

export default function Conversations() {
  const { id } = useParams()
  return (
    <div className="lg:flex lg:h-screen">
      <div className={`${id ? 'hidden lg:block' : ''} lg:w-96 lg:border-r lg:border-surface-highest lg:overflow-y-auto px-4 pt-5 lg:pt-8 max-w-xl mx-auto lg:mx-0 w-full`}>
        <h1 className="text-[28px] font-bold mb-4">Conversas</h1>
        <ConversationList activeId={id} />
      </div>
      <div className={`${id ? '' : 'hidden lg:flex'} flex-1 min-w-0 lg:h-screen`}>
        {id ? <Chat key={id} id={id} /> : (
          <div className="flex-1 flex flex-col items-center justify-center text-ink-soft"><MessageCircle className="w-12 h-12 mb-2 text-primary" />Escolha uma conversa</div>
        )}
      </div>
    </div>
  )
}
