import { execFileSync } from 'node:child_process';

export function git(repo: string, args: string[]): string {
  return execFileSync('git', ['-C', repo, ...args], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
}

export function arquivosAlterados(repo: string, base: string, head = 'HEAD'): string[] {
  return git(repo, ['diff', '--name-only', `${base}...${head}`]).split('\n').map(s => s.trim()).filter(Boolean);
}

export function lerNoCommit(repo: string, ref: string, arquivo: string): string | undefined {
  try { return git(repo, ['show', `${ref}:${arquivo}`]); } catch { return undefined; }
}

export interface Commit { sha: string; assunto: string; ajuda: string[] }

/** Commits do intervalo com o valor dos trailers "Ajuda:". */
export function commits(repo: string, base: string, head = 'HEAD'): Commit[] {
  const SEP_CAMPO = '\x1f', SEP_REG = '\x1e';
  const saida = git(repo, ['log', '--no-merges',
    `--format=%H${SEP_CAMPO}%s${SEP_CAMPO}%(trailers:key=Ajuda,valueonly,separator=%x2C)${SEP_REG}`, `${base}..${head}`]);
  return saida.split(SEP_REG).map(r => r.trim()).filter(Boolean).map(r => {
    const [sha, assunto, ajuda] = r.split(SEP_CAMPO);
    return { sha, assunto, ajuda: (ajuda ?? '').split(',').map(s => s.trim()).filter(Boolean) };
  });
}

/** Data (AAAA-MM-DD) do último commit que tocou algum dos caminhos. */
export function ultimaAlteracao(repo: string, caminhos: string[]): string | undefined {
  if (!caminhos.length) return undefined;
  const d = git(repo, ['log', '-1', '--format=%cs', '--', ...caminhos]).trim();
  return d || undefined;
}
