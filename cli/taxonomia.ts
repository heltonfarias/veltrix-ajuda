import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import type { Manifesto } from './esquema.ts';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export interface ConfigProduto {
  slug: string;
  nome: string;
  repositorio: string;
  descricao: string;
  frontend: string;
  backend_modulos: string;
  menu: string[];
}

export interface Perfil { id: string; nome: string; permissoes: string[] }

const lerYaml = <T>(arquivo: string): T => YAML.parse(fs.readFileSync(path.join(RAIZ, 'taxonomia', arquivo), 'utf8'));

export const carregarProdutos = () => lerYaml<ConfigProduto[]>('produtos.yml');
export const carregarPerfis = () => lerYaml<Perfil[]>('perfis.yml');

export function carregarProduto(slug: string | undefined): ConfigProduto {
  const produtos = carregarProdutos();
  const cfg = produtos.find(p => p.slug === slug);
  if (!cfg) throw new Error(`--produto obrigatório: ${produtos.map(p => p.slug).join(' | ')}`);
  return cfg;
}

/** Lê manifestos/<produto>.json (cópia dos manifestos dos produtos, atualizada pelo CI). */
export function carregarManifestos(dir = path.join(RAIZ, 'manifestos')): Map<string, Manifesto> {
  const mapa = new Map<string, Manifesto>();
  if (!fs.existsSync(dir)) return mapa;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
    const m: Manifesto = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    mapa.set(m.produto, m);
  }
  return mapa;
}
