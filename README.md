# veltrix-ajuda

Base de conhecimento central dos produtos Veltrix. Os artigos ficam em Markdown versionado, e a partir deles saem:

- a central pública em `ajuda.veltrixlabs.com.br/<produto>`;
- a academia em `academia.veltrixlabs.com.br`;
- a ajuda contextual dentro de cada sistema.

| Produto | Slug | Repositório |
|---|---|---|
| Veltrix One | `one` | heltonfarias/veltrixone |
| Veltrix Varejo | `varejo` | heltonfarias/veltrix |
| Veltrix Decor | `decor` | heltonfarias/innoair |

## Estrutura

```
conteudo/<produto>/<modulo>/<id>.mdx   artigos de um produto
conteudo/comum/<modulo>/<id>.mdx       artigos que servem a mais de um produto (produto: [one, varejo, …])
modelos/                               modelo de cada tipo de artigo — copie e preencha
taxonomia/produtos.yml                 produtos e onde ficam rotas/menu/módulos no código
taxonomia/perfis.yml                   perfis de operador (vendedor, caixa, faturista…)
manifestos/<produto>.json              telas de cada produto (cópia atualizada pelo CI)
cli/                                   CLI editorial (manifesto, impacto, validar…)
```

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
3. Crie o bot como **GitHub App** "Veltrix Ajuda Bot", com acesso aos 4 repositórios e permissões de leitura e escrita em Contents, Pull requests e Issues. **Não use um token pessoal seu**: os PRs do bot sairiam no seu nome e você não conseguiria aprová-los.
4. Cadastre o secret `AJUDA_BOT_TOKEN` nos 4 repositórios. Em conta pessoal, os secrets são por repositório.
5. Crie os labels `manifesto` e `revisao-ajuda` neste repositório.
6. Em cada produto, faça commit de `.github/workflows/ajuda.yml` e de `ajuda/manifesto.json`.
