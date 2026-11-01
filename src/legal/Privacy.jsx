import { LegalPage } from './LegalPage'

export function PrivacyContent() {
  return (
    <div className="space-y-4 text-[15px] leading-relaxed text-ink-soft">
      <p className="text-[13px]">Versão de 01/11/2026 — em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).</p>
      <h3>1. Controlador</h3>
      <p>ITAC LOVE — <b>[razão social e CNPJ]</b>. Encarregado(a) de dados (DPO): <b>[nome e e-mail]</b>.</p>
      <h3>2. Dados que tratamos e por quê</h3>
      <ul className="list-disc pl-5 space-y-2">
        <li><b>Cadastro</b> (nome, e-mail, data de nascimento, cidade, identidade de gênero, orientação sexual, bio, interesses e fotos): para criar seu perfil e sugerir conexões. Identidade de gênero e orientação sexual são dados sensíveis, tratados com base no seu consentimento.</li>
        <li><b>Dados biométricos (selfie) e documento de identidade</b>: exclusivamente para confirmar que você é maior de idade e é a pessoa das fotos, prevenindo fraudes (art. 11, II, "g", da LGPD). A imagem fica em área criptografada, acessível <b>somente à moderação</b>, e é <b>excluída definitivamente logo após a análise</b>. Guardamos apenas o resultado (aprovado/reprovado, data) e um código irreversível (hash) do número do documento, para impedir contas duplicadas ou de pessoas banidas.</li>
        <li><b>Localização</b>: aproximada, para calcular a distância no feed (opcional). No <b>Modo Encontro Seguro</b>, a última localização que você compartilhar é enviada aos seus contatos de confiança apenas se você pedir ajuda ou não responder ao check-in.</li>
        <li><b>Contatos de confiança</b> (nome e telefone): só para os avisos do Modo Encontro Seguro.</li>
        <li><b>Mensagens</b>: para entregar as conversas. Mensagens com autodestruição são apagadas também do servidor no prazo escolhido.</li>
        <li><b>Pagamentos</b>: histórico de compras via Pix (não armazenamos dados bancários).</li>
        <li><b>Segurança</b>: denúncias, bloqueios e nota interna de confiança, para proteger a comunidade.</li>
      </ul>
      <h3>3. Prazos de guarda</h3>
      <ul className="list-disc pl-5 space-y-2">
        <li>Selfie com documento: excluída após a análise (normalmente em até 24 horas).</li>
        <li>Dados do perfil e conversas: enquanto a conta existir.</li>
        <li>Registros de acesso: 6 meses (Marco Civil da Internet, art. 15).</li>
        <li>Registro de banimento (hash do e-mail e do documento): enquanto necessário para impedir nova fraude.</li>
      </ul>
      <h3>4. Compartilhamento</h3>
      <p>Não vendemos seus dados. Usamos fornecedores de infraestrutura (hospedagem e banco de dados, envio de notificações, SMS/WhatsApp e pagamento Pix), que tratam os dados apenas para prestar o serviço. Podemos fornecer dados a autoridades mediante ordem judicial.</p>
      <h3>5. Seus direitos (art. 18 da LGPD)</h3>
      <p>Você pode confirmar o tratamento, acessar, corrigir, pedir portabilidade, revogar consentimentos e <b>excluir sua conta e seus dados</b> a qualquer momento em <b>Perfil &gt; Privacidade &gt; Excluir minha conta</b>, ou pelo e-mail do encarregado.</p>
      <h3>6. Segurança</h3>
      <p>Usamos conexão criptografada (HTTPS), armazenamento criptografado, controle de acesso por regras no banco de dados e acesso restrito da moderação.</p>
    </div>
  )
}

export default function Privacy() { return <LegalPage title="Política de Privacidade"><PrivacyContent /></LegalPage> }
