# Ronrom 🐈

Planner pessoal da Julia, com gatos por perto: semana, metas, trimestre, projetos,
hábitos, aulas, intercâmbio, Roda da Vida e o cantinho da Phoebe, do Peleguinho
e do Manteguinha.

Só entra quem tem **código de convite**. Não há planos nem assinatura.

## Stack

| Parte | Tecnologia |
| --- | --- |
| Front | Vite (vanilla JS, três páginas: `/`, `/entrar`, `/app`) |
| API | Hono, rodando como Vercel Function em `/api/*` |
| Banco | Neon Postgres, via Drizzle ORM |
| Login | Better Auth: e-mail e senha + Google |

## Estrutura

```
api/index.ts            Entrada da função da Vercel (repassa tudo para o Hono)
server/
  app.ts                Rotas: /api/auth/*, /api/invite, /api/state, /api/config
  auth.ts               Better Auth + portão de convite (validateUserInfo)
  invite.ts             Cookie assinado do convite e consumo atômico do código
  db/schema.ts          Tabelas (Better Auth + activation_code + planner_state)
  dev.ts                Servidor local da API
scripts/
  migrate.ts            Aplica as migrações da pasta drizzle/
  codes.ts              Cria e lista códigos de convite
drizzle/                Migrações SQL geradas
src/
  landing.js, landing/  Landing page
  entrar.js, auth/      Login, cadastro com convite, Google
  app.js                Abre o planner depois de conferir a sessão
  planner/
    planner.js          Estado, cálculos, páginas e ações do planner
    sync.js             Salva na API (com versão) e guarda cópia offline
    seed.js             Estado vazio e os dados de exemplo
    constants.js        Dias, meses, categorias, temas, Roda da Vida
    planner.css
  shared/               Ícones, gatos em SVG e utilitários de data
  styles/tokens.css     Paletas (Manteguinha, Phoebe, Peleguinho, Noite)
index.html, entrar.html, app.html
```

### Como o convite funciona

1. Em `/entrar` → **Tenho um convite**, a pessoa digita o código. `POST /api/invite`
   confere se ele existe, não expirou e ainda tem usos, e grava um cookie assinado
   (válido por 30 minutos).
2. Ela cria a conta com e-mail e senha **ou** com o Google.
3. Antes de criar qualquer usuário, o hook `validateUserInfo` do Better Auth lê o
   cookie, gasta um uso do código de forma atômica e só então deixa criar.
   Sem cookie válido, nada é criado, inclusive pelo Google.

Quem já tem conta entra normalmente, sem código.

### Como os dados são salvos

O planner inteiro de cada pessoa é um documento JSON na tabela `planner_state`.
Cada gravação aumenta `version`. Se um aparelho desatualizado tentar gravar,
a API responde `409` com a versão atual, e o app adota essa versão.
Uma cópia fica no `localStorage` para abrir rápido e para não perder nada sem internet.

## Rodar no computador

Precisa de Node 20+ e pnpm.

```bash
pnpm install
cp .env.example .env       # preencha DATABASE_URL e BETTER_AUTH_SECRET
pnpm db:migrate            # cria as tabelas no Neon
pnpm code:new --uses 3 --note "Julia e família"
pnpm dev                   # http://localhost:5173
```

Dica: no Neon, crie uma *branch* `dev` do banco para testar sem mexer nos dados reais.

## Códigos de convite

```bash
pnpm code:new                              # 1 uso, nunca expira
pnpm code:new --uses 2 --days 30 --note "mãe e pai"
pnpm code:new --code MIAU-JULIA-2026       # escolher o texto
pnpm code:list                             # ver usos
```

Sem o terminal, também dá no **SQL Editor** do Neon:

```sql
insert into activation_code (code, max_uses, note) values ('MIAU-JULIA-2026', 1, 'Julia');
```

## Login com Google

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs e serviços → **Tela de consentimento OAuth**:
   tipo *Externo*, nome "Ronrom", e-mail de suporte.
2. **Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web**.
3. Origens JavaScript autorizadas: `https://SEU-DOMINIO` e `http://localhost:5173`.
4. URIs de redirecionamento autorizados:
   - `https://SEU-DOMINIO/api/auth/callback/google`
   - `http://localhost:5173/api/auth/callback/google`
5. Copie o Client ID e o Client Secret para `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`.

Enquanto o app estiver em modo "Teste" no Google, adicione os e-mails das pessoas em
*Usuários de teste* (ou publique o app; para escopos básicos não há revisão).

## Deploy na Vercel

1. **Add New → Project** → importe `Mauduailibi/ronrom`. A Vercel lê o `vercel.json`
   (pnpm, Vite, pasta `dist`, função em `api/`).
2. Em **Settings → Environment Variables**, cadastre:
   `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (ex.: `https://ronrom.vercel.app`),
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
3. Deploy. Cada `git push` na `main` publica de novo.
4. Rode `pnpm db:migrate` uma vez (do seu computador, com a `DATABASE_URL` de produção)
   e crie o código de convite da Julia.

Também dá para usar a integração **Neon** do marketplace da Vercel, que cria o banco e
já preenche `DATABASE_URL`.

## Mandar o convite como cartinha 💌

A página `/convite` é uma cartinha: um envelope com selo de gatinho que se abre
numa carta escrita à mão e termina num vale-presente com o código e o botão
**Usar meu convite**, que já abre o cadastro com o código preenchido.

1. Crie o código: `pnpm code:new --code MIAU-JULIA --uses 1 --note "Julia"`
2. Edite o texto da carta no topo de `src/convite.js` (objeto `CARTA`) e faça o push.
3. Mande o link:

```
https://ronrom.vercel.app/convite?para=Julia&de=Maurício#MIAU-JULIA
```

O código vai depois do `#`, então não aparece em logs de servidor nem na prévia
do WhatsApp (que mostra a imagem `public/og-convite.png`). `para` e `de` são opcionais.
Se o domínio não for `ronrom.vercel.app`, troque a URL da `og:image` em `convite.html`.

## Trazer os dados da versão antiga

Se a Julia usou a versão sem login no mesmo domínio, o app oferece
**Trazer meus dados deste navegador** na primeira entrada. De outro endereço,
use **Aparência → Backup e restauração** na versão antiga e cole na nova.
