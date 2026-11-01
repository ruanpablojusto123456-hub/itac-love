# ITAC LOVE 💙❤️

App de namoro verificado para Itacarambi e região — **um só código** para a versão **web** (navegador no computador e no celular) e o **APK Android**, usando o **mesmo banco de dados** (Supabase).

**Pronto:** cadastro em 4 etapas, verificação por selfie com documento, tela de aguardo, feed com deslize e afinidade, filtros, cotas, match com prazo de 48 h, convites, chat em tempo real (emojis, enviada/lida, autodestruição, alerta de golpe), proteção contra print (APK e web), denúncia e bloqueio, modo encontro seguro, modo invisível, pausa e exclusão de conta, loja com Pix e painel do administrador (verificações, denúncias, usuários, vendas, números e configurações).

---

## 1. Testar agora (modo demonstração)

Sem configurar nada, o app roda em **modo demonstração**: os dados ficam salvos no próprio navegador.

```bash
npm install
npm run dev        # abre em http://localhost:5173
```

- Crie uma conta e faça o cadastro completo.
- Abra `http://localhost:5173/#/admin` → **admin@itaclove.com / admin123** → aprove seu cadastro.
- Volte ao app e entre com sua conta: o acesso é liberado. (Na tela de aguardo também há um atalho "Aprovar minha conta agora".)
- A demonstração já traz perfis de exemplo: alguns já curtiram você (curtiu = match na hora) e respondem no chat. **Vanessa** e **Carlos** simulam golpistas que pedem Pix, para você ver o alerta de golpe. A Larissa manda um convite assim que você é aprovado.

## 2. Ligar o banco de dados real (Supabase — plano gratuito)

1. Crie um projeto em **supabase.com** (região *South America – São Paulo*).
2. Em **Database → Extensions**, ative **pg_cron**.
3. Em **SQL Editor**, rode **na ordem** os arquivos da pasta `supabase/migrations`:
   `0001_schema.sql` → `0002_functions.sql` → `0003_policies.sql` → `0004_cron_realtime.sql`.
4. Copie `.env.example` para `.env` e preencha com os dados de **Project Settings → API**:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
5. **Login com Google:** em **Authentication → Providers → Google**, cole o *Client ID* e o *Secret* criados no Google Cloud Console (tipo "Aplicativo da Web", com a URL de callback que o Supabase mostra).
6. Em **Authentication → URL Configuration → Redirect URLs**, adicione:
   - o endereço do site (ex.: `https://SEU-USUARIO.github.io/itac-love/`)
   - `http://localhost:5173/`
   - `br.com.itaclove.app://login-callback` (retorno do login no APK)
7. **Criar o administrador:** cadastre-se normalmente pelo app com o e-mail do admin e rode no SQL Editor:
   ```sql
   insert into public.admins (user_id, name)
   select id, 'Administrador' from auth.users where email = 'SEU-EMAIL@gmail.com';
   ```
   Depois acesse `/#/admin`.

### Edge Functions (Pix e avisos do encontro seguro)

Instale a CLI (`npm i -g supabase`), faça `supabase login` e `supabase link`, e publique:

```bash
supabase functions deploy pix-create
supabase functions deploy pix-webhook --no-verify-jwt
supabase functions deploy safe-dates
supabase secrets set MP_ACCESS_TOKEN=APP_USR-... PUBLIC_WEBHOOK_URL=https://xxxx.supabase.co/functions/v1/pix-webhook \
  TWILIO_SID=AC... TWILIO_TOKEN=... TWILIO_FROM=whatsapp:+55... PUBLIC_APP_URL=https://SEU-USUARIO.github.io/itac-love/
```

- **Pix:** crie uma conta no Mercado Pago, gere o *Access Token* de produção em "Suas integrações" e cadastre a chave Pix na conta.
- **SMS/WhatsApp:** os avisos aos contatos de confiança usam a Twilio. Sem as chaves, os avisos só aparecem no log da função.
- No `0004_cron_realtime.sql`, troque o agendamento `itac-safe-dates` pela chamada à função `safe-dates` (o exemplo está comentado no arquivo) para que os SMS saiam mesmo com o app fechado.

## 3. Gerar o APK e publicar a web (GitHub, sem instalar Android Studio)

1. Crie um repositório no GitHub e envie esta pasta.
2. Em **Settings → Secrets and variables → Actions**, crie `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
3. Em **Settings → Pages → Source**, escolha **GitHub Actions**.
4. A cada envio na branch `main`, o GitHub:
   - gera o **APK** e coloca em **Releases** (link direto para baixar e instalar);
   - publica a **versão web** no GitHub Pages.
5. APK assinado de produção (opcional): gere um keystore uma vez
   `keytool -genkey -v -keystore release.keystore -alias itaclove -keyalg RSA -keysize 2048 -validity 10000`
   e crie os secrets `ANDROID_KEYSTORE_BASE64` (`base64 -w0 release.keystore`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. **Guarde o keystore** — sem ele não dá para atualizar o app.

**Aviso de atualização:** ao lançar versão nova, aumente `version` no `package.json`, e no painel admin → Configurações informe a nova versão e o link do APK. Quem abrir um APK antigo verá o aviso para baixar.

## 4. Estrutura

```
supabase/migrations/   banco de dados (tabelas, regras, segurança, rotinas automáticas)
scripts/test-db.mjs    49 testes automáticos do banco (npm run test:db)
src/lib/               conexão com Supabase + modo demonstração
src/screens/           login, cadastro, fotos, interesses, verificação, aguardo
src/app/               feed, convites, conversas, chat, encontro seguro, loja, perfil
supabase/functions/    Pix (Mercado Pago) e avisos do encontro seguro (Twilio)
src/admin/             painel do administrador
src/legal/             Termos de Uso e Política de Privacidade (LGPD)
android-overrides/     MainActivity (FLAG_SECURE + detecção de print) e AndroidManifest
scripts/patch_android.py  gera o projeto Android personalizado (o GitHub roda sozinho)
```

## 5. O que o banco já faz sozinho (servidor)

| Regra | Onde |
|---|---|
| Bloqueio de menores de 18, 3 fotos obrigatórias, mínimo 3 interesses | `submit_verification` |
| Aprovar / reprovar com motivo / pedir nova foto + notificação | `admin_review_verification` |
| Mesmo documento em duas contas é reprovado; banimento bloqueia e-mail e documento | `document_registry`, `banned_identifiers` |
| Cotas por gênero, renovação à meia-noite de Brasília, saldo único web + APK | `consume_quota`, `quota_status` |
| Afinidade (tags em comum + o que buscam) | `affinity`, `get_feed` |
| Match com prazo de 48 h e lembrete 6 h antes | `job_expire_matches`, `job_match_reminders` |
| Autodestruição apagando do servidor; aviso de print no chat | `job_purge_messages`, `report_screenshot` |
| Nota de confiança (+2/semana, cai só com denúncia confirmada, revisão abaixo do limite) | `job_trust_gain`, `admin_resolve_report` |
| Check-in do encontro seguro mesmo com o app fechado | `job_safe_dates` |
| Exclusão definitiva da conta (LGPD) | `delete_my_account` |

> Revise os Termos de Uso e a Política de Privacidade com um(a) advogado(a) e preencha os campos entre colchetes (razão social, CNPJ, e-mail do encarregado) antes de lançar.
