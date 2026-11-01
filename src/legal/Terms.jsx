import { LegalPage } from './LegalPage'

export function TermsContent() {
  return (
    <div className="prose-legal space-y-4 text-[15px] leading-relaxed text-ink-soft">
      <p className="text-[13px]">Versão de 01/11/2026. Ao criar uma conta você declara ter lido e aceito estes Termos.</p>
      <h3>1. Quem pode usar</h3>
      <p>O ITAC LOVE é exclusivo para pessoas <b>maiores de 18 anos</b>. Cada pessoa pode ter apenas uma conta, vinculada à sua identidade real, confirmada por selfie com documento oficial (RG ou CNH).</p>
      <h3>2. Verificação de identidade</h3>
      <p>O acesso ao aplicativo só é liberado após a análise da selfie com documento pela moderação. A moderação pode aprovar, reprovar (informando o motivo) ou pedir uma nova foto. Perfis aprovados exibem o selo "Verificado".</p>
      <h3>3. Conduta esperada</h3>
      <p>É proibido: assédio, discurso de ódio, conteúdo sexual explícito não solicitado, pedir dinheiro, Pix ou dados bancários, divulgar dados de outras pessoas, gravar ou capturar conversas sem consentimento, e qualquer conduta ilegal.</p>
      <h3>4. Cláusula antifraude</h3>
      <p className="rounded-xl bg-secondary-fixed/50 text-ink p-3 font-semibold">Qualquer tentativa de fraude identificada — perfil falso, uso de fotos ou documentos de terceiros, golpes ou falsidade de informações — resultará no banimento permanente da plataforma ITAC LOVE.</p>
      <p>O banimento bloqueia também o e-mail e o documento utilizados, impedindo novo cadastro.</p>
      <h3>5. Denúncias, bloqueios e moderação</h3>
      <p>Você pode denunciar ou bloquear qualquer perfil. As denúncias são analisadas por pessoas da moderação, que podem advertir, suspender temporariamente ou banir contas. O ITAC LOVE mantém uma nota interna de confiança, usada apenas pela moderação.</p>
      <h3>6. Cotas e pagamentos</h3>
      <p>Algumas contas têm limite diário de curtidas e convites, renovado à meia-noite (horário de Brasília). Cotas extras podem ser compradas via Pix. Valores pagos por cotas já utilizadas não são reembolsáveis, salvo nos casos previstos no Código de Defesa do Consumidor.</p>
      <h3>7. Segurança nos encontros</h3>
      <p>O ITAC LOVE oferece ferramentas de segurança (como o Modo Encontro Seguro e o alerta de golpe), mas não se responsabiliza pela conduta dos usuários fora da plataforma. Encontre-se sempre em locais públicos e avise alguém de confiança.</p>
      <h3>8. Conta</h3>
      <p>Você pode pausar ou excluir sua conta a qualquer momento nas configurações. A exclusão é definitiva.</p>
      <h3>9. Contato</h3>
      <p>Dúvidas e solicitações: <b>[e-mail de contato do ITAC LOVE]</b>. Foro: comarca de Itacarambi/MG.</p>
    </div>
  )
}

export default function Terms() { return <LegalPage title="Termos de Uso"><TermsContent /></LegalPage> }
