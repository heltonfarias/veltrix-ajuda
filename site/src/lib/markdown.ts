import { Marked } from 'marked';

export interface Secao { id: string; titulo: string }

const slugify = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Blocos condicionais por produto, para artigos que servem a mais de um produto:
 *   <SoNo produto="decor">Texto que só aparece no Veltrix Decor.</SoNo>
 *   <SoNo produto="one,varejo">…</SoNo>
 */
function aplicarCondicionais(md: string, produto: string): string {
  return md.replace(/<SoNo\s+produto="([^"]+)"\s*>([\s\S]*?)<\/SoNo>/g, (_, lista: string, corpo: string) =>
    lista.split(',').map(s => s.trim()).includes(produto) ? corpo : '');
}

/** Converte o corpo do artigo em HTML e devolve o sumário (títulos H2). */
export function renderizar(md: string, produto: string): { html: string; secoes: Secao[] } {
  const secoes: Secao[] = [];
  const usados = new Set<string>();
  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      heading({ tokens, depth }) {
        const texto = this.parser.parseInline(tokens);
        let id = slugify(texto) || 'secao';
        for (let n = 2; usados.has(id); n++) id = `${slugify(texto)}-${n}`;
        usados.add(id);
        if (depth === 2) secoes.push({ id, titulo: texto.replace(/<[^>]+>/g, '') });
        return `<h${depth} id="${id}">${texto}</h${depth}>\n`;
      },
      table(token) {
        // Tabelas roláveis no celular.
        const html = marked.Renderer.prototype.table.call(this, token);
        return `<div class="tabela">${html}</div>`;
      },
    },
  });
  const html = marked.parse(aplicarCondicionais(md, produto), { async: false }) as string;
  return { html, secoes };
}
