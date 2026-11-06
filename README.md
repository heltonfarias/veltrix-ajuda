# veltrix-ajuda

Base de conhecimento central dos produtos Veltrix. Os artigos ficam em Markdown versionado, e a partir deles saem:

- a central pública em `ajuda.veltrixlabs.com.br/<produto>`;
- a academia em `academia.veltrixlabs.com.br`;
- a ajuda contextual dentro de cada sistema.

| Produto | Slug | Repositório |
|---|---|---|
| VeltrixOne | `one` | heltonfarias/veltrixone |
| Veltrix (varejo) | `varejo` | heltonfarias/veltrix |
| Veltrix Decor | `decor` | heltonfarias/innoair |

## Estrutura

```
conteudo/<produto>/<modulo>/<id>.mdx   artigos de um produto
conteudo/comum/<modulo>/<id>.mdx       artigos que servem a mais de um produto (produto: [one, varejo, …])
modelos/                               modelo de cada tipo de artigo — copie e preencha
taxonomia/produtos.yml                 produtos e onde ficam rotas/menu/módulos no código
taxonomia/perfis.yml                   perfis de operador (vendedor, caixa, faturista…)
taxonomia/modulos.yml                  nome, descrição e ícone de cada módulo na central
manifestos/<produto>.json              telas de cada produto (cópia atualizada pelo CI)
cli/                                   CLI editorial (manifesto, impacto, validar…)
site/                                  central pública (Astro + busca Pagefind)
Dockerfile                             build do site para o Coolify (nginx)
```

## Central pública (`site/`)

| Endereço | Conteúdo |
|---|---|
| `/` | escolha do produto |
| `/<produto>/` | "O que você precisa fazer?": busca, tarefas mais procuradas, ajuda por função e módulos por área |
| `/<produto>/<modulo>/` | página do módulo, com os procedimentos agrupados por atividade, telas, regras, problemas e FAQ |
| `/<produto>/<modulo>/<artigo>/` | artigo, com sumário, vídeo, "Onde fica no sistema", avaliação e "Veja também" |
| `/<produto>/perfil/<perfil>/` | o que cada função precisa saber |
| `/<produto>/tela/<featureId>/` | ajuda de uma tela do sistema, destino do botão "?" dentro do ERP. Existe para todas as telas, mesmo as que ainda não têm artigo |
| `/<produto>/problemas/`, `/perguntas/`, `/videos/`, `/novidades/`, `/busca/` | listas e busca |

O site **só publica artigos com `status: publicado`**. Para ver também os rascunhos:

```bash
cd site && npm ci
npm run dev                                  # desenvolvimento (sem busca)
AJUDA_RASCUNHOS=1 npm run build && npx astro preview   # com rascunhos e busca
```

Variáveis opcionais do build:
- `PUBLIC_SUPORTE_URL`: link "Falar com o suporte".
- `PUBLIC_AJUDA_API`: API do bloco "Este artigo ajudou?".

Se uma variável não estiver definida, o bloco correspondente não aparece.

### Deploy no Coolify (uma vez)

1. **DNS:** crie um registro `A` para `ajuda.veltrixlabs.com.br` apontando para o IP do servidor do Coolify.
2. **Coolify › New Resource › Public Repository:**
   - informe `https://github.com/heltonfarias/veltrix-ajuda`, branch `main`;
   - em **Build Pack**, escolha **Dockerfile**;
   - em **Domains**, informe `https://ajuda.veltrixlabs.com.br`;
   - em **Ports Exposes**, informe `80`;
   - em **Build arguments** (opcional), informe `PUBLIC_SUPORTE_URL`.
3. **Deploy automático a cada merge:**
   - **URL de deploy:** `https://<painel-coolify>/api/v1/deploy?uuid=<UUID>&force=false`. O `<UUID>` é o trecho depois de `/application/` na barra de endereço do recurso. A seção *Webhooks* do recurso mostra a mesma URL, mas nem toda versão do Coolify exibe essa seção.
   - **Token:** crie em *Keys & Tokens › API Tokens*, só com a permissão **deploy**. Se o formulário não aparecer, ligue *Settings › Advanced › API Access* e deixe *Allowed IPs* vazio.
   - **No GitHub:** cadastre os **secrets** `COOLIFY_DEPLOY_WEBHOOK` e `COOLIFY_TOKEN` e a **variável** (aba *Variables*, não *Secrets*) `PUBLICAR=true`.
   - O painel do Coolify precisa estar em **HTTPS**, porque o token trafega no cabeçalho. Nas versões atuais, a chamada é `POST`.

   A partir daí, cada merge aprovado no `main` publica a central. Para republicar sem merge, use *Actions › conteudo › Run workflow*.

### Relação com o site comercial

`veltrixlabs.com.br` vende e `ajuda.veltrixlabs.com.br` ensina. São sites separados que apontam um para o outro:
- o rodapé da central leva ao site comercial;
- o site comercial deve ter um link **Central de Ajuda** no menu ou no rodapé, apontando para `ajuda.veltrixlabs.com.br`. A FAQ dele pode remeter às perguntas frequentes da central.

Os nomes e as descrições dos produtos em `taxonomia/produtos.yml` seguem os do site comercial.

## A ligação entre código e artigo: o featureId

Cada tela de cada produto tem um **featureId** estável, derivado da rota. Por exemplo, a rota `/pedidos/faturamento` vira `one.pedidos.faturamento`, e `/comercial/pre-vendas/:numero` vira `one.comercial.pre-vendas.item`.

O `manifesto` lê o `App.tsx` (rotas), o menu (`Sidebar.tsx` ou `menu.ts`) e as pastas de módulo do backend, e gera a lista de telas com área, permissões e arquivos. Os artigos apontam para as telas que documentam:

```yaml
features: [one.comercial.pre-vendas.nova]
```

Com isso dá para responder:

- quais artigos um PR afeta;
- quais telas não têm artigo;
- qual artigo ficou para trás depois de uma mudança.

## Escrever um artigo

1. Copie o modelo de `modelos/` (procedimento, referência, solução, conceito, FAQ, aula).
2. Preencha o front-matter. O schema está em `cli/esquema.ts` e o CI valida cada campo.
3. Use os nomes **exatos** dos botões e campos da tela, em negrito.
4. Abra um PR. Ele só é publicado depois da **aprovação do usuário master** (CODEOWNERS).

Ciclo de status: `rascunho` → `revisao` → `publicado` → `obsoleto`. Um artigo publicado precisa de `responsavel` e `revisado_em`.

## Comandos

```bash
npm ci
npx tsx cli/index.ts manifesto --produto one --repo ../VeltrixOne --saida ajuda/manifesto.json
npx tsx cli/index.ts impacto   --repo ../VeltrixOne --base origin/main
npx tsx cli/index.ts trailer   --repo ../VeltrixOne --base origin/main --modo aviso
npm run validar
npm run cobertura -- --produto one
npm run desatualizados -- --repos one=../VeltrixOne,varejo=../Veltrix,decor=../InnoAir
```

## Fluxo com o desenvolvimento

1. Todo commit `feat`/`fix` no produto informa o impacto na ajuda:
   ```
   feat(prevenda): modo scanner no lançamento

   Ajuda: one.comercial.pre-vendas.nova
   ```
   Se a mudança não afeta o operador, use `Ajuda: sem-impacto`. Para apontar um módulo inteiro, use o prefixo, como `one.comercial.pre-vendas`.
2. O CI do produto roda `.github/workflows/ajuda.yml`, que chama `verificar-produto.yml` deste repositório. Ele:
   - confere se `ajuda/manifesto.json` está em dia;
   - comenta no PR as telas novas, alteradas e removidas, com os artigos ligados a cada uma;
   - avisa sobre commits sem o trailer. Começa em modo `aviso` e depois passa a `bloquear`.
3. No merge em `main` do produto, o bot abre aqui um PR com o manifesto atualizado.
4. O PR de conteúdo é validado por `conteudo.yml`. O merge, que só acontece com a aprovação do master, publica o conteúdo.
5. Toda segunda-feira, `revisao-semanal.yml` atualiza a issue "Revisão da Central de Ajuda" com os artigos desatualizados e as telas sem artigo.

## Repositório público: cuidados

Este repositório é **público**. Os produtos continuam privados, e o que está aqui é o mesmo conteúdo que vai para a central pública. Valem estas regras:

- **Rascunhos também são públicos.** Um PR aberto, mesmo antes da aprovação, fica visível. Não escreva aqui nada que não possa ir ao ar: regra comercial sigilosa, nome de cliente, problema interno.
- **Use só dados fictícios** em textos e capturas de tela: cliente "Loja Exemplo", CNPJ e CPF de teste, e-mail `@exemplo.com`. O `validar` barra CPF, CNPJ, e-mail e credenciais no texto. **Capturas de tela não são verificadas automaticamente**, então revise cada imagem antes de aprovar e gere as capturas no ambiente de homologação com dados de demonstração.
- **Nenhum segredo em arquivo.** Tokens ficam apenas em *Settings › Secrets*. Workflows de PR vindos de fork não recebem segredos, e nenhuma workflow de PR daqui usa algum.
- **O que fica exposto do código dos produtos:** os manifestos publicam rotas, nomes de telas, chaves de permissão e caminhos de arquivo. Não há dado nem lógica neles.
- Em **Settings › Actions › General › Fork pull request workflows**, deixe marcado *"Require approval for all outside collaborators"*.

## Configuração no GitHub (uma vez)

1. Crie o repositório **público** `heltonfarias/veltrix-ajuda` e faça o push deste diretório.
2. Em **Settings › Rules › Rulesets › New branch ruleset**, crie o ruleset `proteger-main`:
   - **Enforcement:** Active.
   - **Bypass list:** Repository admin, no modo *For pull requests only*. Assim o master consegue fazer merge dos artigos que ele próprio escrever, porque o GitHub não deixa aprovar o próprio PR.
   - **Target:** default branch.
   - **Regras:**
     - Restrict deletions;
     - Block force pushes;
     - Require a pull request, com 1 aprovação, **Require review from Code Owners** e *Dismiss stale approvals*;
     - Require status checks: `validar` (adicione depois do primeiro PR, quando o check já existir).
3. Crie o bot como **GitHub App**. **Não use um token pessoal seu**: os PRs do bot sairiam no seu nome e você não conseguiria aprová-los.
   1. Acesse `github.com/settings/apps` e clique em **New GitHub App**.
   2. Preencha:
      - **GitHub App name:** `Veltrix Ajuda Bot`. O nome é único em todo o GitHub; se já existir, use `veltrix-ajuda-bot-hf`.
      - **Homepage URL:** `https://github.com/heltonfarias/veltrix-ajuda`.
      - **Webhook:** desmarque **Active**.
   3. Em **Repository permissions**, marque *Read and write* em **Contents**, **Pull requests** e **Issues**. **Metadata** fica em *Read-only*, que é automático.
   4. Em **Where can this GitHub App be installed?**, escolha **Only on this account** e clique em **Create GitHub App**.
   5. Na página do App:
      - anote o **App ID**, que aparece no topo;
      - em **Private keys**, clique em **Generate a private key**. O navegador baixa um arquivo `.pem`.
   6. No menu lateral, clique em **Install App**, depois em **Install** na sua conta. Escolha **Only select repositories**, marque `veltrix-ajuda`, `veltrixone`, `veltrix` e `innoair` e confirme.
4. Cadastre os dois secrets nos **4 repositórios**, em *Settings › Secrets and variables › Actions › New repository secret*. Em conta pessoal, os secrets são por repositório.
   - `AJUDA_APP_ID`: o número do App ID.
   - `AJUDA_APP_PRIVATE_KEY`: o conteúdo inteiro do `.pem`, incluindo as linhas `-----BEGIN…` e `-----END…`.

   Depois de cadastrar, apague o `.pem` do computador ou guarde num cofre de senhas. Se ele vazar, gere outra chave e revogue a antiga na página do App.
5. Crie os labels `manifesto` e `revisao-ajuda` neste repositório.
6. Em cada produto, faça commit de `.github/workflows/ajuda.yml` e de `ajuda/manifesto.json`.
