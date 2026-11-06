// Gera o manifesto de funcionalidades de um produto a partir do código:
//  - rotas do App.tsx (<Route path=... element=...>)
//  - itens do menu (objetos { label, path, permissao|perm } dentro de grupos/ramos)
//  - pastas de módulo do backend
// O resultado é determinístico (sem data) para poder ser versionado no repositório
// do produto e verificado no CI como um lockfile.
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import type { Funcionalidade, Manifesto } from './esquema.ts';
import { carregarProduto, type ConfigProduto } from './taxonomia.ts';

const RE_PERMISSAO = /^[a-z][\w-]*(:[\w-]+)+$/;
const EXTENSOES = ['.tsx', '.ts', '/index.tsx', '/index.ts'];

function parse(arquivo: string): ts.SourceFile {
  return ts.createSourceFile(arquivo, fs.readFileSync(arquivo, 'utf8'), ts.ScriptTarget.Latest, true,
    arquivo.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}

function texto(n: ts.Node | undefined): string | undefined {
  if (!n) return undefined;
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
  if (ts.isJsxExpression(n)) return texto(n.expression);
  return undefined;
}

function resolverImport(origem: string, especificador: string): string | undefined {
  if (!especificador.startsWith('.')) return undefined;
  const base = path.resolve(path.dirname(origem), especificador);
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
  for (const ext of EXTENSOES) if (fs.existsSync(base + ext)) return base + ext;
  return undefined;
}

/** nome local → arquivo, para imports estáticos e lazy(() => import('...')). */
function mapaImports(sf: ts.SourceFile): Map<string, string> {
  const mapa = new Map<string, string>();
  const visitar = (n: ts.Node) => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier) && n.importClause) {
      const alvo = resolverImport(sf.fileName, n.moduleSpecifier.text);
      if (alvo) {
        if (n.importClause.name) mapa.set(n.importClause.name.text, alvo);
        const nb = n.importClause.namedBindings;
        if (nb && ts.isNamedImports(nb)) nb.elements.forEach(e => mapa.set(e.name.text, alvo));
      }
    }
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      let achado: string | undefined;
      const procurar = (m: ts.Node) => {
        if (ts.isCallExpression(m) && m.expression.kind === ts.SyntaxKind.ImportKeyword) {
          const esp = texto(m.arguments[0]);
          if (esp) achado = resolverImport(sf.fileName, esp);
        }
        if (!achado) ts.forEachChild(m, procurar);
      };
      procurar(n.initializer);
      if (achado) mapa.set(n.name.text, achado);
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return mapa;
}

interface RotaBruta {
  rota: string;
  componente?: string;
  arquivo?: string;
  permissoes: string[];
  contexto: 'interno' | 'publico';
}

function atributos(el: ts.JsxOpeningLikeElement): Map<string, ts.JsxAttribute> {
  const m = new Map<string, ts.JsxAttribute>();
  for (const a of el.attributes.properties) if (ts.isJsxAttribute(a)) m.set(a.name.getText(), a);
  return m;
}

function tagsJsx(n: ts.Node): string[] {
  const tags: string[] = [];
  const visitar = (m: ts.Node) => {
    if (ts.isJsxOpeningElement(m) || ts.isJsxSelfClosingElement(m)) tags.push(m.tagName.getText());
    ts.forEachChild(m, visitar);
  };
  visitar(n);
  return tags;
}

function permissoesEm(n: ts.Node): string[] {
  const achadas = new Set<string>();
  const visitar = (m: ts.Node) => {
    const t = texto(m);
    if (t && RE_PERMISSAO.test(t)) achadas.add(t);
    ts.forEachChild(m, visitar);
  };
  visitar(n);
  return [...achadas];
}

function juntarRota(pai: string, filho: string): string {
  if (filho.startsWith('/')) return filho;
  return `${pai.replace(/\/$/, '')}/${filho}`;
}

function extrairRotas(appTsx: string): RotaBruta[] {
  const sf = parse(appTsx);
  const imports = mapaImports(sf);
  const rotas: RotaBruta[] = [];

  const visitar = (n: ts.Node, prefixo: string, interno: boolean) => {
    const abertura = ts.isJsxElement(n) ? n.openingElement : ts.isJsxSelfClosingElement(n) ? n : undefined;
    if (abertura && abertura.tagName.getText() === 'Route') {
      const attrs = atributos(abertura);
      const p = texto(attrs.get('path')?.initializer);
      const elemento = attrs.get('element')?.initializer;
      const tags = elemento ? tagsJsx(elemento) : [];
      const ehLayout = !p && tags.some(t => /Layout/.test(t));
      const rota = p !== undefined ? juntarRota(prefixo, p) : prefixo;
      if (p !== undefined && elemento && p !== '*' && rota !== '/') {
        const componente = tags.find(t => t !== 'Navigate' && imports.has(t));
        if (componente) {
          rotas.push({
            rota,
            componente,
            arquivo: imports.get(componente),
            permissoes: permissoesEm(elemento),
            contexto: interno ? 'interno' : 'publico',
          });
        }
      }
      if (ts.isJsxElement(n)) n.children.forEach(c => visitar(c, rota, interno || ehLayout));
      return;
    }
    ts.forEachChild(n, c => visitar(c, prefixo, interno));
  };
  visitar(sf, '', false);
  return rotas;
}

interface ItemMenu { rota: string; titulo: string; area?: string; submenu?: string; permissoes: string[] }

function propriedade(obj: ts.ObjectLiteralExpression, nome: string): ts.Expression | undefined {
  for (const p of obj.properties) {
    if (ts.isPropertyAssignment(p) && p.name.getText().replace(/['"]/g, '') === nome) return p.initializer;
  }
  return undefined;
}

function extrairMenu(arquivos: string[]): ItemMenu[] {
  const itens: ItemMenu[] = [];
  for (const arq of arquivos) {
    if (!fs.existsSync(arq)) continue;
    const sf = parse(arq);
    const visitar = (n: ts.Node, area?: string, submenu?: string) => {
      if (ts.isObjectLiteralExpression(n)) {
        const tipo = texto(propriedade(n, 'type'));
        const label = texto(propriedade(n, 'label'));
        const rota = texto(propriedade(n, 'path'));
        if (rota && label) {
          const perm = propriedade(n, 'permissao') ?? propriedade(n, 'perm');
          itens.push({ rota, titulo: label, area, submenu, permissoes: perm ? permissoesEm(perm) : [] });
          return;
        }
        if (tipo === 'group' && label) { ts.forEachChild(n, c => visitar(c, label, undefined)); return; }
        if (tipo === 'branch' && label) { ts.forEachChild(n, c => visitar(c, area, label)); return; }
      }
      ts.forEachChild(n, c => visitar(c, area, submenu));
    };
    visitar(sf);
  }
  return itens;
}

const normalizarSegmento = (s: string) =>
  s.startsWith(':') ? 'item' : s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9-]/g, '-');

const ROTULOS_SEGMENTO: Record<string, string> = {
  item: 'detalhe', editar: 'edição', imprimir: 'impressão',
};

/** "/comercial/pre-vendas/:numero" sob o menu "Pré-vendas" → "Pré-vendas › detalhe". */
function tituloDerivado(rota: string, pai: ItemMenu | undefined): string | undefined {
  if (!pai) return undefined;
  const resto = rota.slice(pai.rota.length).split('/').filter(Boolean).map(normalizarSegmento);
  if (!resto.length) return undefined;
  return `${pai.titulo} › ${resto.map(s => ROTULOS_SEGMENTO[s] ?? s.replace(/-/g, ' ')).join(' › ')}`;
}

export function idDaRota(produto: string, rota: string): string {
  const segs = rota.split('/').filter(Boolean).map(normalizarSegmento);
  return [produto, ...segs].join('.');
}

function moduloDe(rota: string, permissoes: string[]): string {
  const daPermissao = permissoes[0]?.split(':')[0];
  if (daPermissao) return daPermissao;
  return normalizarSegmento(rota.split('/').filter(Boolean)[0] ?? 'geral');
}

export function gerarManifesto(repo: string, cfg: ConfigProduto): Manifesto {
  const raiz = path.resolve(repo);
  const rel = (p: string) => path.relative(raiz, p).split(path.sep).join('/');
  const frontend = path.join(raiz, cfg.frontend);
  const dirModulos = path.join(raiz, cfg.backend_modulos);
  const modulosBackend = new Set(fs.existsSync(dirModulos) ? fs.readdirSync(dirModulos) : []);

  const rotas = extrairRotas(path.join(frontend, 'App.tsx'));
  const menu = new Map(extrairMenu(cfg.menu.map(m => path.join(raiz, m))).map(i => [i.rota, i]));

  const porId = new Map<string, Funcionalidade>();
  // Tela fora do menu (ex.: /pedidos/:id) herda área do item de menu com o maior prefixo de rota.
  const menuPai = (rota: string) => {
    let melhor: ItemMenu | undefined;
    for (const [p, item] of menu) {
      if (rota.startsWith(p + '/') && (!melhor || p.length > melhor.rota.length)) melhor = item;
    }
    return melhor;
  };

  for (const r of rotas) {
    const m = menu.get(r.rota);
    const pai = m ?? menuPai(r.rota);
    const permissoes = [...new Set([...r.permissoes, ...(m?.permissoes ?? [])])].sort();
    const modulo = moduloDe(r.rota, permissoes);
    const arquivos = new Set<string>();
    if (r.arquivo) arquivos.add(rel(r.arquivo));
    for (const p of permissoes) {
      const mod = p.split(':')[0];
      if (modulosBackend.has(mod)) arquivos.add(`${cfg.backend_modulos}/${mod}/`);
    }
    let id = idDaRota(cfg.slug, r.rota);
    for (let n = 2; porId.has(id); n++) id = `${idDaRota(cfg.slug, r.rota)}-${n}`;
    porId.set(id, {
      id,
      rota: r.rota,
      titulo: m?.titulo ?? tituloDerivado(r.rota, pai) ?? r.componente ?? r.rota,
      modulo,
      ...(pai?.area ? { area: pai.area } : {}),
      ...(pai?.submenu ? { submenu: pai.submenu } : {}),
      contexto: r.contexto,
      permissoes,
      arquivos: [...arquivos].sort(),
    });
  }

  const pkg = JSON.parse(fs.readFileSync(path.join(raiz, 'package.json'), 'utf8'));
  return {
    produto: cfg.slug,
    versao: pkg.version ?? '0.0.0',
    funcionalidades: [...porId.values()].sort((a, b) => a.id.localeCompare(b.id)),
  };
}

export function comandoManifesto(args: Record<string, string>) {
  const cfg = carregarProduto(args.produto);
  const repo = args.repo ?? '.';
  const manifesto = gerarManifesto(repo, cfg);
  const json = JSON.stringify(manifesto, null, 2) + '\n';
  const saida = args.saida;
  if (!saida) { process.stdout.write(json); return; }

  const destino = path.resolve(repo, saida);
  if (args.verificar !== undefined) {
    const atual = fs.existsSync(destino) ? fs.readFileSync(destino, 'utf8') : '';
    if (atual.replace(/\r\n/g, '\n') !== json) {
      console.error(`::error::${saida} está desatualizado. Rode "npm run ajuda:manifesto" e faça commit do resultado.`);
      process.exitCode = 1;
    } else console.log(`${saida} está em dia (${manifesto.funcionalidades.length} funcionalidades).`);
    return;
  }
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, json);
  console.log(`${manifesto.funcionalidades.length} funcionalidades → ${saida}`);
}
