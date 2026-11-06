#!/usr/bin/env -S npx tsx
import { comandoManifesto } from './manifesto.ts';
import { cobertura, desatualizados, impacto, produtos, trailer, validar } from './comandos.ts';

const AJUDA = `veltrix-ajuda — CLI editorial da Central de Ajuda

  manifesto       gera o manifesto de telas de um produto
                  --produto one|varejo|decor --repo <dir> [--saida ajuda/manifesto.json] [--verificar]
  impacto         telas e artigos afetados por um PR (markdown para comentário)
                  --repo <dir> --base <ref> [--head HEAD] [--saida impacto.md]
  trailer         confere o trailer "Ajuda:" nos commits feat/fix
                  --repo <dir> --base <ref> [--modo aviso|bloquear]
  validar         valida o front-matter e as referências de todos os artigos
  cobertura       telas sem artigo   [--produto one] [--saida cobertura.md]
  desatualizados  artigos a revisar  [--repos one=../VeltrixOne,...] [--dias 180]
  produtos        lista os produtos cadastrados
`;

function parseArgs(argv: string[]): Record<string, string> {
  const r: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const [k, v] = a.slice(2).split('=', 2);
    if (v !== undefined) r[k] = v;
    else if (argv[i + 1] && !argv[i + 1].startsWith('--')) r[k] = argv[++i];
    else r[k] = '';
  }
  return r;
}

const [cmd, ...resto] = process.argv.slice(2);
const args = parseArgs(resto);
const comandos: Record<string, (a: Record<string, string>) => void> = {
  manifesto: comandoManifesto, impacto, trailer, validar, cobertura, desatualizados, produtos,
};

const fn = comandos[cmd ?? ''];
if (!fn) { console.log(AJUDA); process.exitCode = cmd ? 1 : 0; }
else {
  try { fn(args); }
  catch (e) { console.error(`::error::${(e as Error).message}`); process.exitCode = 1; }
}
