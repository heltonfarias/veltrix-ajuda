import { z } from 'zod';

export const PRODUTOS = ['one', 'varejo', 'decor'] as const;
export type Produto = (typeof PRODUTOS)[number];

export const TIPOS_ARTIGO = [
  'procedimento', // passo a passo de uma tarefa
  'conceito',     // regra de negócio explicada
  'referencia',   // campos e botões de uma tela
  'solucao',      // problema → causa → solução
  'faq',          // pergunta curta
  'novidade',     // gerado por versão
  'aula',         // unidade da academia
] as const;

export const STATUS_ARTIGO = ['rascunho', 'revisao', 'publicado', 'obsoleto'] as const;

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'use minúsculas, números e hífens');
const featureId = z.string().regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/, 'featureId no formato produto.modulo.tela');
const data = z.union([z.date(), z.string()]).transform((v, ctx) => {
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'data inválida (use AAAA-MM-DD)' });
    return z.NEVER;
  }
  return d.toISOString().slice(0, 10);
});
const video = z.string().regex(/^(yt):[\w-]{6,}(@\d+)?$/, 'vídeo no formato yt:<id> ou yt:<id>@<segundos>');

export const FrontMatter = z
  .object({
    id: slug,
    titulo: z.string().min(5).max(120),
    resumo: z.string().max(240).optional(),
    tipo: z.enum(TIPOS_ARTIGO),
    produto: z.array(z.enum(PRODUTOS)).min(1),
    modulo: slug,
    atividade: slug.optional(),
    features: z.array(featureId).default([]),
    perfis: z.array(slug).default([]),
    tags: z.array(slug).default([]),
    videos: z.array(video).default([]),
    relacionados: z.array(slug).default([]),
    responsavel: z.string().min(2).optional(),
    revisado_em: data.optional(),
    valido_desde: z.string().regex(/^\d+\.\d+\.\d+$/).optional(),
    status: z.enum(STATUS_ARTIGO),
    ordem: z.number().int().optional(),
  })
  .strict()
  .superRefine((fm, ctx) => {
    if (fm.status === 'publicado') {
      if (!fm.responsavel) ctx.addIssue({ code: 'custom', path: ['responsavel'], message: 'artigo publicado precisa de responsável' });
      if (!fm.revisado_em) ctx.addIssue({ code: 'custom', path: ['revisado_em'], message: 'artigo publicado precisa de data de revisão' });
    }
    if (['procedimento', 'referencia'].includes(fm.tipo) && fm.features.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['features'], message: `artigo do tipo ${fm.tipo} deve apontar ao menos uma funcionalidade` });
    }
  });

export type FrontMatter = z.infer<typeof FrontMatter>;

/** Uma tela/funcionalidade do produto, extraída do código. */
export interface Funcionalidade {
  id: string;                 // one.pedidos.faturamento
  rota: string;               // /pedidos/faturamento
  titulo: string;             // rótulo do menu ou nome do componente
  modulo: string;             // pedidos
  area?: string;              // grupo do menu (Comercial, Financeiro…)
  submenu?: string;           // ramo do menu (Relatórios…)
  contexto: 'interno' | 'publico';
  permissoes: string[];       // 'modulo:acao'
  arquivos: string[];         // arquivos/pastas cujo diff afeta a funcionalidade
}

export interface Manifesto {
  produto: string;
  versao: string;
  funcionalidades: Funcionalidade[];
}
