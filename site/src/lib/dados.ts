// Modelo de dados da central, montado no build a partir de:
// conteudo/ (artigos), taxonomia/ (produtos, perfis, módulos) e manifestos/ (telas).
import { carregarArtigos, type Artigo } from '../../../cli/artigos.ts';
import { carregarManifestos, carregarModulos, carregarPerfis, carregarProdutos, type Perfil } from '../../../cli/taxonomia.ts';
import type { Funcionalidade, Manifesto } from '../../../cli/esquema.ts';

export type { Artigo, Funcionalidade, Perfil };

/** Com AJUDA_RASCUNHOS=1 o build inclui rascunhos e artigos em revisão (pré-visualização). */
export const MOSTRAR_RASCUNHOS = process.env.AJUDA_RASCUNHOS === '1';

export interface Modulo {
  slug: string;
  nome: string;
  descricao?: string;
  icone: string;
  area: string;
  artigos: Artigo[];
}

export interface ProdutoSite {
  slug: string;
  nome: string;
  descricao: string;
  manifesto?: Manifesto;
  artigos: Artigo[];
  modulos: Modulo[];
  perfis: Perfil[];          // perfis que têm ao menos um artigo
}

const TIPO_ROTULO: Record<string, string> = {
  procedimento: 'Passo a passo', conceito: 'Conceito', referencia: 'Referência da tela',
  solucao: 'Solução de problema', faq: 'Pergunta frequente', novidade: 'Novidade', aula: 'Aula',
};
export const rotuloTipo = (t: string) => TIPO_ROTULO[t] ?? t;

// Slugs não têm acento ("movimentacao"); devolve a grafia de exibição.
const PALAVRAS: Record<string, string> = {
  lancamento: 'lançamento', lancamentos: 'lançamentos', relatorio: 'relatório', relatorios: 'relatórios',
  pre: 'pré', previa: 'prévia', servico: 'serviço', servicos: 'serviços',
  orcamento: 'orçamento', orcamentos: 'orçamentos', area: 'área',
};
const acentuar = (p: string) => PALAVRAS[p]
  ?? p.replace(/coes$/, 'ções').replace(/cao$/, 'ção').replace(/soes$/, 'sões').replace(/sao$/, 'são');

export const tituloSlug = (s: string) => {
  const t = s.split('-').map(acentuar).join(' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const visivel = (a: Artigo) =>
  a.fm.status === 'publicado' || (MOSTRAR_RASCUNHOS && (a.fm.status === 'rascunho' || a.fm.status === 'revisao'));

/** Parte final da URL do artigo: tira o prefixo "<produto>-<modulo>-" do id. */
export function slugArtigo(a: Artigo): string {
  let id = a.fm.id;
  for (const pre of [...a.fm.produto.map(p => `${p}-${a.fm.modulo}-`), ...a.fm.produto.map(p => `${p}-`), 'comum-']) {
    if (id.startsWith(pre)) { id = id.slice(pre.length); break; }
  }
  return id;
}

export const urlArtigo = (produto: string, a: Artigo) => `/${produto}/${a.fm.modulo}/${slugArtigo(a)}/`;
export const urlModulo = (produto: string, modulo: string) => `/${produto}/${modulo}/`;
export const urlTela = (produto: string, featureId: string) => `/${produto}/tela/${featureId}/`;

const ordenar = (a: Artigo, b: Artigo) =>
  (a.fm.ordem ?? 999) - (b.fm.ordem ?? 999) || a.fm.titulo.localeCompare(b.fm.titulo, 'pt-BR');

function maisFrequente(valores: (string | undefined)[]): string | undefined {
  const cont = new Map<string, number>();
  for (const v of valores) if (v) cont.set(v, (cont.get(v) ?? 0) + 1);
  return [...cont].sort((a, b) => b[1] - a[1])[0]?.[0];
}

let cache: ProdutoSite[] | undefined;

export function produtos(): ProdutoSite[] {
  if (cache) return cache;
  const { artigos, erros } = carregarArtigos();
  if (erros.length) {
    throw new Error(`Artigos inválidos — rode "npm run validar" na raiz:\n${erros.map(e => `${e.arquivo}: ${e.mensagem}`).join('\n')}`);
  }
  const manifestos = carregarManifestos();
  const infoModulos = carregarModulos();
  const todosPerfis = carregarPerfis();

  cache = carregarProdutos().map(cfg => {
    const manifesto = manifestos.get(cfg.slug);
    const doProduto = artigos.filter(a => a.fm.produto.includes(cfg.slug as never) && visivel(a)).sort(ordenar);

    const slugsModulos = [...new Set(doProduto.map(a => a.fm.modulo))];
    const modulos: Modulo[] = slugsModulos.map(slug => {
      const info = infoModulos[cfg.slug]?.[slug] ?? {};
      const telas = manifesto?.funcionalidades.filter(f => f.modulo === slug) ?? [];
      const principal = [...telas].filter(f => f.area).sort((a, b) => a.rota.length - b.rota.length)[0];
      return {
        slug,
        nome: info.nome ?? principal?.titulo ?? tituloSlug(slug),
        descricao: info.descricao,
        icone: info.icone ?? 'book-open',
        area: info.area ?? maisFrequente(telas.map(t => t.area)) ?? 'Geral',
        artigos: doProduto.filter(a => a.fm.modulo === slug),
      };
    }).sort((a, b) => a.area.localeCompare(b.area, 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR'));

    const perfisUsados = new Set(doProduto.flatMap(a => a.fm.perfis));
    return {
      slug: cfg.slug,
      nome: cfg.nome,
      descricao: cfg.descricao,
      manifesto,
      artigos: doProduto,
      modulos,
      perfis: todosPerfis.filter(p => perfisUsados.has(p.id)),
    };
  });
  return cache;
}

export function produto(slug: string): ProdutoSite {
  const p = produtos().find(x => x.slug === slug);
  if (!p) throw new Error(`produto desconhecido: ${slug}`);
  return p;
}

export function modulosPorArea(p: ProdutoSite): [string, Modulo[]][] {
  const mapa = new Map<string, Modulo[]>();
  for (const m of p.modulos) mapa.set(m.area, [...(mapa.get(m.area) ?? []), m]);
  return [...mapa];
}

export function artigoPorId(p: ProdutoSite, id: string): Artigo | undefined {
  return p.artigos.find(a => a.fm.id === id);
}

export function nomePerfil(id: string): string {
  return carregarPerfis().find(p => p.id === id)?.nome ?? tituloSlug(id);
}

export function dataBR(iso?: string): string | undefined {
  if (!iso) return undefined;
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

/** yt:<id>[@segundos] → URL do player sem cookies. */
export function urlVideo(v: string): { id: string; embed: string; inicio?: number } {
  const [, resto] = v.split(':');
  const [id, seg] = resto.split('@');
  const inicio = seg ? Number(seg) : undefined;
  return { id, inicio, embed: `https://www.youtube-nocookie.com/embed/${id}${inicio ? `?start=${inicio}` : ''}` };
}
