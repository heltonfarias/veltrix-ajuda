import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import matter from 'gray-matter';
import { FrontMatter } from './esquema.ts';
import { RAIZ } from './taxonomia.ts';

export interface Artigo {
  arquivo: string;          // relativo à raiz do repositório
  fm: FrontMatter;
  corpo: string;
}

export interface ErroArtigo { arquivo: string; mensagem: string }

export function carregarArtigos(dir = path.join(RAIZ, 'conteudo')): { artigos: Artigo[]; erros: ErroArtigo[] } {
  const artigos: Artigo[] = [];
  const erros: ErroArtigo[] = [];
  const arquivos = fg.sync('**/*.{md,mdx}', { cwd: dir, absolute: true }).sort();
  for (const abs of arquivos) {
    const arquivo = path.relative(RAIZ, abs).split(path.sep).join('/');
    let bruto: matter.GrayMatterFile<string>;
    try {
      bruto = matter(fs.readFileSync(abs, 'utf8'));
    } catch (e) {
      erros.push({ arquivo, mensagem: `front-matter ilegível: ${(e as Error).message}` });
      continue;
    }
    const r = FrontMatter.safeParse(bruto.data);
    if (!r.success) {
      for (const i of r.error.issues) erros.push({ arquivo, mensagem: `${i.path.join('.') || '(raiz)'}: ${i.message}` });
      continue;
    }
    artigos.push({ arquivo, fm: r.data, corpo: bruto.content });
  }
  return { artigos, erros };
}

/** featureId → artigos que apontam para ele. */
export function indicePorFeature(artigos: Artigo[]): Map<string, Artigo[]> {
  const idx = new Map<string, Artigo[]>();
  for (const a of artigos) {
    if (a.fm.status === 'obsoleto') continue;
    for (const f of a.fm.features) idx.set(f, [...(idx.get(f) ?? []), a]);
  }
  return idx;
}
