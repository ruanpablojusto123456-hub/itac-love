// Perfis de exemplo do modo demonstração (fictícios).
// fan: já curtiu você (curtir = match na hora). replies: respostas automáticas no chat.
const NICE = (a, b, c) => [a, b, c]
export const SEED_PROFILES = [
  { id: 'p_camila', prompts: [{"q": "Meu rolê ideal em Itacarambi é…", "a": "Forró na praça e açaí depois"}, {"q": "Vamos nos dar bem se você…", "a": "souber dançar (ou topar aprender!)"}], name: 'Camila', age: 26, g: 'mulher_cis', show: ['homens'], look: 'serio', hue: 345, km: 2, fan: true,
    bio: 'Enfermeira, apaixonada por forró e pôr do sol no Velho Chico.', tags: [2, 24, 38, 47, 35],
    replies: NICE('Oii! Que bom que deu match 😊', 'Adoro forró também! Você dança?', 'Bora marcar um açaí na praça qualquer dia?') },
  { id: 'p_bianca', prompts: [{"q": "Meu prato preferido é…", "a": "Churrasco com farofa da minha vó"}, {"q": "Uma coisa que pouca gente sabe sobre mim…", "a": "Já fotografei casamento no barco"}], name: 'Bianca', age: 31, g: 'mulher_trans', show: ['homens', 'mulheres'], look: 'casual', hue: 290, km: 5, fan: true, o: 'Bissexual',
    bio: 'Fotógrafa e cozinheira de fim de semana. Me chama pra um churrasco!', tags: [36, 37, 41, 8, 48],
    replies: NICE('Oi, tudo bem? 📸', 'Que legal! Qual seu prato preferido?', 'Sábado tem feirinha no centro, bora?') },
  { id: 'p_larissa', prompts: [{"q": "A música que não sai da minha playlist é…", "a": "Qualquer uma da Marília Mendonça"}, {"q": "Um domingo perfeito pra mim é…", "a": "Série, pizza e coberta"}], name: 'Larissa', age: 24, g: 'mulher_cis', show: ['homens', 'mulheres', 'nao_binarios'], look: 'amizade', hue: 20, km: 1, o: 'Pansexual',
    bio: 'Estudante, gamer e viciada em séries. Procuro gente boa pra trocar ideia.', tags: [34, 32, 42, 25, 6],
    replies: NICE('Oii! Obrigada por aceitar 😄', 'Tô maratonando uma série ótima, curte suspense?', 'Hahaha, a gente tem muito em comum!') },
  { id: 'p_vanessa', prompts: [{"q": "Eu não abro mão de…", "a": "Uma pessoa generosa ❤️"}], name: 'Vanessa', age: 29, g: 'mulher_cis', show: ['homens'], look: 'serio', hue: 0, km: 40, fan: true, trust: 40, city: 'Januária, MG',
    bio: 'Sou nova na região, quero conhecer alguém especial.', tags: [2, 47, 48, 24],
    replies: NICE('Oi amor, adorei seu perfil ❤️', 'Olha, tô passando um aperto... me empresta um dinheiro no pix? Te devolvo amanhã', 'É rapidinho, me chama aqui: http://bit.ly/meu-zap-vanessa') },
  { id: 'p_lucas', prompts: [{"q": "Meu lugar preferido na beira do Velho Chico é…", "a": "A prainha no fim da tarde"}, {"q": "No primeiro encontro eu gostaria de…", "a": "Pescar e conversar sem pressa"}], name: 'Lucas', age: 28, g: 'homem_cis', show: ['mulheres'], look: 'serio', hue: 205, km: 3, fan: true,
    bio: 'Professor de educação física. Futebol, pescaria e família.', tags: [11, 12, 17, 41, 29],
    replies: NICE('E aí, tudo bem? 😊', 'Curte pescar? Domingo vou pro rio.', 'Que tal um café essa semana?') },
  { id: 'p_diego', prompts: [{"q": "A música que não sai da minha playlist é…", "a": "Djavan, sempre"}, {"q": "O que me faz rir na hora é…", "a": "Gente que canta errado com convicção"}], name: 'Diego', age: 30, g: 'homem_trans', show: ['mulheres', 'nao_binarios'], look: 'nao_sei', hue: 160, km: 8, fan: true, o: 'Queer',
    bio: 'Músico, toco violão na praça às sextas. MPB e boas conversas.', tags: [5, 40, 33, 26, 38],
    replies: NICE('Oi! 🎸', 'Sexta tem roda de violão, aparece!', 'Qual música você mais gosta?') },
  { id: 'p_carlos', prompts: [{"q": "Eu não abro mão de…", "a": "Viajar o mundo"}], name: 'Carlos', age: 38, g: 'homem_cis', show: ['mulheres'], look: 'serio', hue: 30, km: 60, fan: true, trust: 35, city: 'Manga, MG',
    bio: 'Empresário, viajo muito. Procuro uma mulher para a vida toda.', tags: [48, 52, 41, 1],
    replies: NICE('Olá princesa, que sorriso lindo', 'Estou viajando e meu cartão foi bloqueado, pode fazer uma transferência pra mim? Devolvo em dobro', 'Manda no pix, por favor, é urgente') },
  { id: 'p_thiago', prompts: [{"q": "Meu rolê ideal em Itacarambi é…", "a": "Pedalar até a cachoeira"}], name: 'Thiago', age: 27, g: 'homem_cis', show: ['mulheres', 'homens'], look: 'casual', hue: 230, km: 4, o: 'Bissexual',
    bio: 'Dev, ciclista e fã de pizza. Bora pedalar até a cachoeira?', tags: [15, 34, 42, 38, 9],
    replies: NICE('Fala! 🚴', 'Tem uma trilha ótima perto da cidade.', 'Bora marcar!') },
  { id: 'p_sam', prompts: [{"q": "Vamos nos dar bem se você…", "a": "curtir arte e comida vegetariana"}, {"q": "Um domingo perfeito pra mim é…", "a": "Pintar ouvindo MPB"}], name: 'Sam', age: 25, g: 'nao_binario', show: ['mulheres', 'homens', 'nao_binarios'], look: 'amizade', hue: 120, km: 6, fan: true, o: 'Queer',
    bio: 'Artista visual, pronomes elu/delu. Arte, dança e comida vegetariana.', tags: [35, 36, 45, 25, 5],
    replies: NICE('Oii, prazer! 🌈', 'Você curte arte também?', 'Tem exposição na biblioteca semana que vem') },
]
export const seedById = (id) => SEED_PROFILES.find(p => p.id === id)
