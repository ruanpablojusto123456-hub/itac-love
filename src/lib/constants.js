export const GENDERS = [
  { id: 'mulher_cis', label: 'Mulher cis' },
  { id: 'mulher_trans', label: 'Mulher trans' },
  { id: 'homem_cis', label: 'Homem cis' },
  { id: 'homem_trans', label: 'Homem trans' },
  { id: 'nao_binario', label: 'Não binário' },
  { id: 'genero_fluido', label: 'Gênero fluido' },
  { id: 'agenero', label: 'Agênero' },
  { id: 'travesti', label: 'Travesti' },
  { id: 'outro', label: 'Outro' },
  { id: 'prefiro_nao_informar', label: 'Prefiro não informar' },
]
export const genderLabel = (id, other) => (id === 'outro' && other) ? other : (GENDERS.find(g => g.id === id)?.label || '')

export const ORIENTATIONS = ['Heterossexual', 'Gay', 'Lésbica', 'Bissexual', 'Pansexual', 'Assexual', 'Queer', 'Outra', 'Prefiro não informar']

export const SHOW_GENDERS = [
  { id: 'mulheres', label: 'Mulheres' },
  { id: 'homens', label: 'Homens' },
  { id: 'nao_binarios', label: 'Pessoas não binárias e outras identidades' },
]

export const LOOKING_FOR = [
  { id: 'serio', label: 'Relacionamento sério', desc: 'Conexão séria e duradoura', icon: 'Heart' },
  { id: 'casual', label: 'Algo casual', desc: 'Sem pressa, viver o momento', icon: 'Flame' },
  { id: 'amizade', label: 'Amizade', desc: 'Companhia para rolês e conversas', icon: 'Users' },
  { id: 'nao_sei', label: 'Ainda não sei', desc: 'Aberto(a) a possibilidades', icon: 'Compass' },
]

export const TAG_CATEGORIES = [
  { id: 'musica', label: 'Música', emoji: '🎵' },
  { id: 'esportes', label: 'Esportes', emoji: '⚽' },
  { id: 'religiao', label: 'Religião', emoji: '🙏' },
  { id: 'pets', label: 'Pets', emoji: '🐾' },
  { id: 'filhos', label: 'Filhos', emoji: '👶' },
  { id: 'hobbies', label: 'Hobbies', emoji: '🎨' },
  { id: 'comida', label: 'Comida', emoji: '🍕' },
  { id: 'viagens', label: 'Viagens', emoji: '✈️' },
]

// Mesmas tags do banco (0001_schema.sql) — usadas no modo demonstração
export const DEFAULT_TAGS = [
  ['musica', ['Sertanejo', 'Forró', 'Pagode', 'Funk', 'MPB', 'Rock', 'Gospel', 'Pop', 'Eletrônica', 'Rap']],
  ['esportes', ['Futebol', 'Academia', 'Corrida', 'Vôlei', 'Ciclismo', 'Natação', 'Pesca']],
  ['religiao', ['Católico(a)', 'Evangélico(a)', 'Espírita', 'Religiões de matriz africana', 'Sem religião', 'Espiritualizado(a)']],
  ['pets', ['Amo cachorros', 'Amo gatos', 'Tenho pet', 'Não curto pets']],
  ['filhos', ['Tenho filhos', 'Quero ter filhos', 'Não quero filhos', 'Ainda não sei']],
  ['hobbies', ['Cinema e séries', 'Leitura', 'Games', 'Dança', 'Fotografia', 'Cozinhar', 'Rio e cachoeira', 'Festas', 'Violão']],
  ['comida', ['Churrasco', 'Pizza', 'Comida mineira', 'Japonesa', 'Vegetariano(a)', 'Doces', 'Açaí']],
  ['viagens', ['Praia', 'Montanha', 'Mochilão', 'Roça e interior', 'Viagem internacional', 'Road trip']],
].flatMap(([category, labels]) => labels.map(label => ({ category, label })))
  .map((t, i) => ({ id: i + 1, ...t }))

export const REJECT_PRESETS = [
  'Documento ilegível ou cortado',
  'Rosto não corresponde às fotos do perfil',
  'Documento não aparece ao lado do rosto',
  'Fotos de perfil de outra pessoa',
  'Documento aparenta ser de outra pessoa',
  'Menor de 18 anos',
]

export const ERRORS = {
  MENOR_DE_IDADE: 'O ITAC LOVE é exclusivo para maiores de 18 anos.',
  CADASTRO_INCOMPLETO: 'Complete todos os campos obrigatórios do cadastro.',
  PRECISA_3_FOTOS: 'Envie exatamente 3 fotos de perfil.',
  PRECISA_3_INTERESSES: 'Escolha pelo menos 3 interesses.',
  TERMOS_NAO_ACEITOS: 'Aceite os Termos de Uso e a Política de Privacidade.',
  EMAIL_BANIDO: 'Este e-mail não pode ser usado no ITAC LOVE.',
  SOMENTE_ADMIN: 'Acesso restrito a administradores.',
  COTA_CURTIDAS_ESGOTADA: 'Suas curtidas de hoje acabaram. Elas renovam à meia-noite, ou compre mais na Loja.',
  COTA_CONVITES_ESGOTADA: 'Seus convites de hoje acabaram. Eles renovam à meia-noite, ou compre mais na Loja.',
  PERFIL_INDISPONIVEL: 'Este perfil não está mais disponível.',
  CONVITE_JA_ENVIADO: 'Você já enviou um convite para esta pessoa.',
  CONTA_PAUSADA: 'Sua conta está pausada. Reative em Perfil para curtir.',
  CONVERSA_ENCERRADA: 'Esta conversa foi encerrada.',
  CONTA_NAO_LIBERADA: 'Sua conta ainda não foi liberada.',
  SO_DESTINATARIO: 'Só quem recebeu pode abrir esta foto.',
  JA_VISUALIZADA: 'Esta foto já foi vista e não pode ser aberta de novo.',
  CAMINHO_INVALIDO: 'Não foi possível enviar o arquivo.',
  SO_QUEM_ENVIOU: 'Só quem enviou pode apagar para todos.',
  NAO_PERMITIDO: 'Esta mensagem não pode ser apagada.',
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'User already registered': 'Este e-mail já tem cadastro. Use "Entrar".',
}
export const friendlyError = (e) => {
  const msg = String(e?.message || e || '')
  const key = Object.keys(ERRORS).find(k => msg.includes(k))
  return key ? ERRORS[key] : (msg || 'Algo deu errado. Tente de novo.')
}

export const ageFrom = (iso) => {
  if (!iso) return null
  const d = new Date(iso + 'T12:00:00'), n = new Date()
  let a = n.getFullYear() - d.getFullYear()
  if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) a--
  return a
}

export const REPORT_REASONS = [
  { id: 'perfil_falso', label: 'Perfil falso' },
  { id: 'fotos_de_outra_pessoa', label: 'Fotos de outra pessoa' },
  { id: 'golpe', label: 'Golpe / pedido de dinheiro' },
  { id: 'assedio', label: 'Assédio' },
  { id: 'conteudo_improprio', label: 'Conteúdo impróprio' },
  { id: 'menor_de_idade', label: 'Menor de idade' },
  { id: 'outro', label: 'Outro' },
]
export const reportLabel = (id) => REPORT_REASONS.find(r => r.id === id)?.label || id

export const SELF_DESTRUCT = [
  { secs: null, label: 'Desativado' },
  { secs: 3600, label: '1 hora' },
  { secs: 86400, label: '24 horas' },
  { secs: 604800, label: '7 dias' },
]

// Alerta de golpe: palavras da lista do admin ou links externos
export function isScam(text, words = []) {
  const t = String(text || '').toLowerCase()
  if (/(https?:\/\/|www\.|bit\.ly|wa\.me)/i.test(t)) return true
  const norm = (x) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const nt = norm(t)
  return words.some(w => w && new RegExp(`(^|[^a-z0-9])${norm(w.toLowerCase()).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(nt))
}

// Perguntas do perfil (até 3 respostas) — ajudam a puxar assunto
export const PROMPT_QUESTIONS = [
  'Meu rolê ideal em Itacarambi é…',
  'Um domingo perfeito pra mim é…',
  'A música que não sai da minha playlist é…',
  'Vamos nos dar bem se você…',
  'Meu lugar preferido na beira do Velho Chico é…',
  'Uma coisa que pouca gente sabe sobre mim…',
  'Meu prato preferido é…',
  'O que me faz rir na hora é…',
  'No primeiro encontro eu gostaria de…',
  'Eu não abro mão de…',
]
