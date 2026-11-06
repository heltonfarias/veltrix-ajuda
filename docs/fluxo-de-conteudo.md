# Fluxo de conteúdo da Central de Ajuda

Este guia mostra como nasce e como se mantém o conteúdo da central para os três produtos: **VeltrixOne** (`one`), **Veltrix** (`varejo`) e **Veltrix Decor** (`decor`). Ele cobre três situações:

1. levar a central a um produto que ainda não tem conteúdo;
2. atualizar a ajuda quando muda uma tela de um módulo existente;
3. documentar um módulo novo.

Em todos os casos, **nada vai ao ar sem a aprovação do usuário master**. Só artigos com `status: publicado` aparecem no site, e o deploy acontece no merge em `main`, que exige essa aprovação (CODEOWNERS + ruleset `proteger-main`).

---

## 1. Gerar o conteúdo de um produto

O processo foi validado no piloto do VeltrixOne, que cobriu Pedidos, Pré-venda e Caixa:

1. **Escolher os módulos-piloto:** de 2 a 3 módulos, os mais usados ou os que mais geram chamados de suporte.
2. **Ler as telas e o backend de cada módulo:**
   - as páginas em `packages/frontend/src/pages/<modulo>/`, para os nomes dos botões, campos, abas e avisos;
   - as rotas em `packages/backend/src/modules/<modulo>/*.routes.ts`, para a permissão que cada ação exige;
   - os services, para as mensagens de erro exatas, que vão para "Se algo der errado" e para os artigos de solução;
   - o catálogo de permissões (`PERMISSOES_PADRAO`), para o texto da permissão que o operador vê no cadastro de perfis.
3. **Escrever os artigos** a partir de `modelos/`. Para cada módulo, o conjunto mínimo é:
   - um **conceito**, que explica a regra de negócio, por exemplo o ciclo de status;
   - um **procedimento** por tarefa do dia a dia;
   - uma **solução** que reúna as mensagens de bloqueio mais comuns;
   - **FAQ** para dúvidas curtas.
4. **Cadastrar o módulo** em `taxonomia/modulos.yml`, com nome, descrição e ícone do lucide.
5. **Validar localmente:**
   ```bash
   npx tsx cli/index.ts validar
   npx tsx cli/index.ts cobertura --produto <produto>
   cd site && npm run build      # confere páginas e busca
   ```
6. **Abrir o PR** no `veltrix-ajuda`. O master revisa e faz o merge, e o deploy no Coolify sai sozinho.

### Pré-requisitos por produto

| Produto | Situação |
|---|---|
| VeltrixOne | CI ligado (`.github/workflows/ajuda.yml` no `main`). Piloto pronto. |
| Veltrix (varejo) | O branch `ci/central-ajuda` precisa de merge no `master` para o manifesto se atualizar sozinho. |
| Veltrix Decor | O mesmo: merge de `ci/central-ajuda` no `master`. |

### Módulos comuns aos três produtos

Fiscal/NF-e, DF-e, financeiro, estoque e usuários/perfis existem nos três produtos. Cada assunto desses vira **um artigo só**:

```yaml
produto: [one, varejo, decor]
```

As diferenças entre os produtos ficam em blocos condicionais:

```mdx
<SoNo produto="decor">No Decor, a nota de serviço sai pela NFS-e…</SoNo>
```

Uma correção nesse artigo vale para os três produtos.

---

## 2. Tela alterada em um módulo existente

```
Commit no produto com o trailer  "Ajuda: <featureId>"
  → CI do produto comenta no PR: telas novas, alteradas e removidas,
    com os artigos ligados a cada uma
  → merge no produto → o bot abre aqui o PR do manifesto atualizado
  → o artigo afetado é ajustado → PR no veltrix-ajuda
  → master aprova (merge) → central publicada
```

- Todo commit `feat` ou `fix` no produto informa o impacto: `Ajuda: one.caixa` ou `Ajuda: sem-impacto`.
- **Rede de segurança:** toda segunda-feira, a issue **"Revisão da Central de Ajuda"** lista as telas sem artigo e os artigos cuja tela mudou depois da última revisão (`revisado_em`).
- Ao revisar um artigo, atualize `revisado_em`.

---

## 3. Módulo novo

1. **O manifesto detecta as telas sozinho**, a partir das rotas do `App.tsx` e do menu. Não há configuração a fazer.
2. **A página `/<produto>/tela/<featureId>/` já nasce**, mesmo sem artigo. É o destino do botão "?" do ERP.
3. **`cobertura` aponta o módulo como "sem artigo"**, e a issue semanal também.
4. **Cadastre o módulo** em `taxonomia/modulos.yml` e escreva os artigos seguindo a seção 1.

Escreva a ajuda **junto com a spec do módulo** (`docs/superpowers/specs/*-design.md` no produto). Os critérios de aceite da spec costumam virar o passo a passo do artigo.

---

## Hoje e na Fase 3

| Etapa | Hoje | Fase 3 (automação editorial) |
|---|---|---|
| Descobrir o que mudou | CI do produto e issue semanal | CI do produto e issue semanal |
| Escrever o rascunho | Sob pedido, com leitura do código | Um bot abre um PR de rascunho a partir da spec, do diff e das capturas |
| Capturas e vídeos | Manuais, no ambiente de homologação | Motor do módulo `treinamento` do Decor: análise da tela, Playwright e narração |
| Publicar | Master, pelo merge | Master, pelo merge ou pelo painel editorial |

Os pilotos manuais de cada produto definem o padrão de artigo que o bot da Fase 3 vai seguir.

---

## Regras que valem sempre

- **O repositório é público.** Use só dados fictícios em textos e capturas, como "Loja Exemplo", `@exemplo.com` e CNPJ de teste. Nenhum segredo vai em arquivo.
- **Use os nomes exatos dos botões e campos, em negrito**, como aparecem na tela.
- **Copie as mensagens de erro exatamente como o sistema mostra.** É por elas que o operador busca ajuda.
- **Links internos** seguem o formato `/<produto>/<modulo>/<slug>/`. O slug é o `id` sem o prefixo `<produto>-<modulo>-`.
