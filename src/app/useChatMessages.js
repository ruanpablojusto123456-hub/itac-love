import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'

// Mensagens de uma conversa com envio otimista (aparece na hora) e tempo real
// por conversa (só a mensagem nova/alterada chega, sem recarregar a lista toda).
export function useChatMessages(convId, myId) {
  const [msgs, setMsgs] = useState(null)
  const [error, setError] = useState(null)
  const tmp = useRef(0)

  const reload = useCallback(() => api.listMessages(convId).then(list => {
    setMsgs(prev => {
      const pending = (prev || []).filter(m => m._pending)
      return [...list, ...pending]
    }); setError(null)
  }).catch(setError), [convId])

  useEffect(() => {
    setMsgs(null); reload()
    if (api.subscribeConversation) {
      return api.subscribeConversation(convId, (type, row, old) => {
        setMsgs(prev => {
          if (!prev) return prev
          if (type === 'DELETE') return prev.filter(m => m.id !== old?.id)
          if (!row) return prev
          if ((row.hidden_for || []).includes(myId)) return prev.filter(m => m.id !== row.id)
          const i = prev.findIndex(m => m.id === row.id)
          if (i >= 0) { const next = prev.slice(); next[i] = { ...prev[i], ...row }; return next }
          if (type !== 'INSERT') return prev
          // chegou pelo tempo real antes da resposta do envio: tira a versão provisória
          const withoutTemp = row.sender_id === myId ? dropOneTemp(prev, row) : prev
          return [...withoutTemp, row]
        })
      })
    }
    return api.onChange(reload)
  }, [convId, myId, reload])

  const send = useCallback(async (body, replyTo) => {
    const id = `tmp-${++tmp.current}`
    const temp = { id, _pending: true, conversation_id: convId, sender_id: myId, kind: 'text', body, reply_to: replyTo || null, created_at: new Date().toISOString() }
    setMsgs(prev => [...(prev || []), temp])
    try {
      const row = await api.sendMessage(convId, body, { replyTo })
      setMsgs(prev => {
        const list = prev || []
        if (!row) return list.filter(m => m.id !== id)
        if (list.some(m => m.id === row.id)) return list.filter(m => m.id !== id)
        return list.map(m => (m.id === id ? row : m))
      })
    } catch (e) {
      setMsgs(prev => (prev || []).filter(m => m.id !== id))
      throw e
    }
  }, [convId, myId])

  const remove = useCallback(async (m, forAll) => {
    setMsgs(prev => (prev || []).flatMap(x => x.id !== m.id ? [x] : forAll ? [{ ...x, deleted_for_all: true, body: '', media_type: null, media_path: null }] : []))
    try { await api.deleteMessage(m.id, forAll) } catch (e) { reload(); throw e }
  }, [reload])

  return { msgs, error, reload, send, remove }
}

function dropOneTemp(list, row) {
  const i = list.findIndex(m => m._pending && m.body === row.body)
  return i < 0 ? list : [...list.slice(0, i), ...list.slice(i + 1)]
}
