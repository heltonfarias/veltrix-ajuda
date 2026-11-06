import fs from 'node:fs';
import path from 'node:path';
import type { Funcionalidade, Manifesto } from './esquema.ts';
import { carregarArtigos, indicePorFeature, type Artigo } from './artigos.ts';
import { arquivosAlterados, commits, lerNoCommit, ultimaAlteracao } from './git.ts';
import { carregarManifestos, carregarProdutos } from './taxonomia.ts';

type Args = Record<string, string>;

const lerManifesto = (arquivo: string): Manifesto => JSON.parse(fs.readFileSync(arquivo, 'utf8'));
const linkArtigo = (a: Artigo) => `\`${a.fm.id}\` — ${a.fm.titulo} (${a.fm.status}${a.fm.responsavel ? `, @${a.fm.responsavel}` : ''})`;

function escrever(saida: string | undefined, md: string) {
  if (saida) fs.writeFileSync(saida, md);
  else process.stdout.write(md);
}

function afeta(f: Funcionalidade, arquivo: string): boolean {
  return f.arquivos.some(a => (a.endsWith('/') ? arquivo.startsWith(a) : arquivo === a));
}

/**
 * impacto: diff do PR → funcionalidades afetadas → artigos ligados.
 * Também compara o manifesto da base com o atual para apontar telas novas/removidas.
 *   --repo <produto>  --base <ref>  [--head HEAD]  [--manifesto ajuda/manifesto.json]  [--saida arquivo.md]
 */
export function impacto(args: Args) {
  const repo = args.repo ?? '.';
  const relManifesto = args.manifesto ?? 'ajuda/manifesto.json';
  const atual = lerManifesto(path.resolve(repo, relManifesto));
  const baseTxt = lerNoCommit(repo, args.base, relManifesto);
  const anterior: Manifesto | undefined = baseTxt ? JSON.parse(baseTxt) : undefined;
  const alterados = arquivosAlterados(repo, args.base, args.head ?? 'HEAD');
  const { artigos } = carregarArtigos();
  const idx = indicePorFeature(artigos);

  const idsAnteriores = new Set(anterior?.funcionalidades.map(f => f.id) ?? []);
  const idsAtuais = new Set(atual.funcionalidades.map(f => f.id));
  const novas = anterior ? atual.funcionalidades.filter(f => !idsAnteriores.has(f.id)) : [];
  const removidas = anterior ? anterior.funcionalidades.filter(f => !idsAtuais.has(f.id)) : [];
  const afetadas = atual.funcionalidades.filter(f => !novas.includes(f) && alterados.some(a => afeta(f, a)));

  const linhas: string[] = ['<!-- veltrix-ajuda:impacto -->', '## 📚 Impacto na Central de Ajuda', ''];
  if (!novas.length && !removidas.length && !afetadas.length) {
    linhas.push('Nenhuma tela do manifesto foi afetada por este PR.');
  }
  if (novas.length) {
    linhas.push('### Telas novas', '');
    for (const f of novas) {
      const arts = idx.get(f.id) ?? [];
      linhas.push(`- **${f.titulo}** \`${f.id}\` (${f.rota})${arts.length ? '' : ' — ⚠️ **sem artigo de ajuda**'}`);
    }
    linhas.push('');
  }
  if (afetadas.length) {
    linhas.push('### Telas alteradas — revisar artigos', '');
    for (const f of afetadas) {
      const arts = idx.get(f.id) ?? [];
      linhas.push(`- **${f.titulo}** \`${f.id}\``);
      if (!arts.length) linhas.push('  - ⚠️ nenhum artigo associado');
      for (const a of arts) linhas.push(`  - ${linkArtigo(a)}`);
    }
    linhas.push('');
  }
  if (removidas.length) {
    linhas.push('### Telas removidas — marcar artigos como obsoletos', '');
    for (const f of removidas) {
      linhas.push(`- \`${f.id}\` (${f.rota})`);
      for (const a of idx.get(f.id) ?? []) linhas.push(`  - ${linkArtigo(a)}`);
    }
    linhas.push('');
  }
  linhas.push('', '_Informe nos commits `Ajuda: <featureId>` (ou `Ajuda: sem-impacto`). Gerado por veltrix-ajuda._', '');
  escrever(args.saida, linhas.join('\n'));
}

/**
 * trailer: commits feat/fix precisam de "Ajuda: <featureId>[, ...]" ou "Ajuda: sem-impacto".
 *   --repo  --base  [--head]  [--manifesto]  [--modo aviso|bloquear]
 */
export function trailer(args: Args) {
  const repo = args.repo ?? '.';
  const modo = args.modo ?? 'aviso';
  const manifesto = lerManifesto(path.resolve(repo, args.manifesto ?? 'ajuda/manifesto.json'));
  const ids = new Set(manifesto.funcionalidades.map(f => f.id));
  const problemas: string[] = [];
  for (const c of commits(repo, args.base, args.head ?? 'HEAD')) {
    if (!/^(feat|fix)(\(.+\))?!?:/.test(c.assunto)) continue;
    if (!c.ajuda.length) { problemas.push(`${c.sha.slice(0, 7)} "${c.assunto}" sem trailer Ajuda:`); continue; }
    for (const v of c.ajuda) {
      if (v === 'sem-impacto') continue;
      const id = v.replace(/\.\*$/, '');
      const existe = ids.has(id) || [...ids].some(i => i.startsWith(id + '.'));
      if (!existe) problemas.push(`${c.sha.slice(0, 7)} "${c.assunto}": featureId desconhecido "${v}"`);
    }
  }
  const nivel = modo === 'bloquear' ? 'error' : 'warning';
  for (const p of problemas) console.log(`::${nivel}::${p}`);
  if (!problemas.length) console.log('Todos os commits feat/fix informam o impacto na ajuda.');
  if (problemas.length && modo === 'bloquear') process.exitCode = 1;
}

/**
 * validar: front-matter, ids únicos, relacionados existentes e featureIds conhecidos.
 *   [--manifestos dir]
 */
export function validar(args: Args) {
  const { artigos, erros } = carregarArtigos();
  const manifestos = carregarManifestos(args.manifestos);
  const avisos: string[] = [];
  const porId = new Map<string, Artigo>();
  for (const a of artigos) {
    const dup = porId.get(a.fm.id);
    if (dup) erros.push({ arquivo: a.arquivo, mensagem: `id "${a.fm.id}" já usado em ${dup.arquivo}` });
    porId.set(a.fm.id, a);
    const nome = path.basename(a.arquivo).replace(/\.mdx?$/, '');
    if (!a.fm.id.endsWith(nome)) avisos.push(`${a.arquivo}: o nome do arquivo deveria terminar o id ("${a.fm.id}")`);
  }
  // Repositório público: nada de dado real de cliente em texto de artigo.
  const DADO_SENSIVEL: [RegExp, string][] = [
    [/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/, 'CPF'],
    [/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/, 'CNPJ'],
    [/\b[\w.+-]+@(?!exemplo\.com|example\.com|veltrixlabs\.com\.br)[\w-]+\.[\w.]+\b/i, 'e-mail'],
    [/\b(senha|password|token|api[_-]?key)\s*[:=]\s*\S{6,}/i, 'credencial'],
  ];
  for (const a of artigos) {
    for (const [re, nome] of DADO_SENSIVEL) {
      const m = a.corpo.match(re);
      if (m) erros.push({ arquivo: a.arquivo, mensagem: `possível ${nome} real no texto ("${m[0]}") — use dados fictícios` });
    }
  }
  for (const a of artigos) {
    for (const r of a.fm.relacionados) if (!porId.has(r)) erros.push({ arquivo: a.arquivo, mensagem: `relacionado inexistente: ${r}` });
    for (const f of a.fm.features) {
      const m = manifestos.get(f.split('.')[0]);
      if (!m) { avisos.push(`${a.arquivo}: sem manifesto do produto de ${f} para conferir`); continue; }
      if (!m.funcionalidades.some(x => x.id === f || x.id.startsWith(f + '.'))) {
        erros.push({ arquivo: a.arquivo, mensagem: `featureId não existe no manifesto: ${f}` });
      }
    }
  }
  for (const w of avisos) console.log(`::warning::${w}`);
  for (const e of erros) console.log(`::error file=${e.arquivo}::${e.mensagem}`);
  console.log(`${artigos.length} artigo(s) válido(s), ${erros.length} erro(s), ${avisos.length} aviso(s).`);
  if (erros.length) process.exitCode = 1;
}

/**
 * cobertura: telas internas do manifesto sem nenhum artigo.
 *   [--produto one]  [--manifestos dir]  [--saida arquivo.md]
 */
export function cobertura(args: Args) {
  const manifestos = carregarManifestos(args.manifestos);
  const idx = indicePorFeature(carregarArtigos().artigos);
  const linhas: string[] = ['# Cobertura da ajuda', ''];
  for (const [produto, m] of manifestos) {
    if (args.produto && produto !== args.produto) continue;
    const internas = m.funcionalidades.filter(f => f.contexto === 'interno');
    const sem = internas.filter(f => !idx.has(f.id));
    const pct = internas.length ? Math.round(((internas.length - sem.length) / internas.length) * 100) : 100;
    linhas.push(`## ${produto} v${m.versao} — ${pct}% (${internas.length - sem.length}/${internas.length} telas com artigo)`, '');
    const porArea = new Map<string, Funcionalidade[]>();
    for (const f of sem) porArea.set(f.area ?? '(fora do menu)', [...(porArea.get(f.area ?? '(fora do menu)') ?? []), f]);
    for (const [area, fs_] of [...porArea].sort()) {
      linhas.push(`### ${area}`, '');
      for (const f of fs_) linhas.push(`- [ ] ${f.titulo} — \`${f.id}\` (${f.rota})`);
      linhas.push('');
    }
  }
  escrever(args.saida, linhas.join('\n'));
}

/**
 * desatualizados: artigos sem responsável, revisão vencida, ou cuja tela mudou depois da revisão.
 *   [--dias 180]  [--repos one=../VeltrixOne,varejo=../Veltrix,decor=../InnoAir]  [--saida arquivo.md]
 */
export function desatualizados(args: Args) {
  const dias = Number(args.dias ?? 180);
  const limite = new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10);
  const repos = new Map((args.repos ?? '').split(',').filter(Boolean).map(p => p.split('=') as [string, string]));
  const manifestos = carregarManifestos(args.manifestos);
  const { artigos } = carregarArtigos();
  const semResponsavel: Artigo[] = [];
  const vencidos: Artigo[] = [];
  const telaMudou: { a: Artigo; f: string; data: string }[] = [];

  for (const a of artigos) {
    if (a.fm.status === 'obsoleto') continue;
    if (!a.fm.responsavel) semResponsavel.push(a);
    if (a.fm.status === 'publicado' && (!a.fm.revisado_em || a.fm.revisado_em < limite)) vencidos.push(a);
    for (const fid of a.fm.features) {
      const produto = fid.split('.')[0];
      const repo = repos.get(produto);
      const f = manifestos.get(produto)?.funcionalidades.find(x => x.id === fid);
      if (!repo || !f) continue;
      const data = ultimaAlteracao(repo, f.arquivos);
      if (data && (!a.fm.revisado_em || data > a.fm.revisado_em)) telaMudou.push({ a, f: fid, data });
    }
  }

  const md = [
    '# Artigos a revisar', '',
    `## Tela alterada depois da última revisão (${telaMudou.length})`, '',
    ...telaMudou.map(t => `- ${linkArtigo(t.a)} — \`${t.f}\` alterada em ${t.data}, revisado em ${t.a.fm.revisado_em ?? 'nunca'}`), '',
    `## Revisão vencida (> ${dias} dias) (${vencidos.length})`, '',
    ...vencidos.map(a => `- ${linkArtigo(a)} — revisado em ${a.fm.revisado_em ?? 'nunca'}`), '',
    `## Sem responsável (${semResponsavel.length})`, '',
    ...semResponsavel.map(a => `- ${linkArtigo(a)} — ${a.arquivo}`), '',
  ].join('\n');
  escrever(args.saida, md);
}

export function produtos() {
  for (const p of carregarProdutos()) console.log(`${p.slug}\t${p.nome}\t${p.repositorio}`);
}
