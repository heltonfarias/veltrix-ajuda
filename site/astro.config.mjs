import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Raiz do repositório veltrix-ajuda (conteudo/, taxonomia/, manifestos/).
process.env.AJUDA_RAIZ ??= path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Capturas dos artigos: ficam em conteudo/<produto>/<modulo>/img/ e são servidas em /conteudo/<produto>/<modulo>/img/.
const TIPOS_IMAGEM = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };
function imagensDoConteudo() {
  const conteudo = path.join(process.env.AJUDA_RAIZ, 'conteudo');
  const ehImagem = (rel) => rel.split(path.sep).includes('img') && path.extname(rel).toLowerCase() in TIPOS_IMAGEM;
  return {
    name: 'imagens-do-conteudo',
    hooks: {
      'astro:server:setup': ({ server }) => {
        server.middlewares.use('/conteudo', (req, res, next) => {
          const arq = path.join(conteudo, decodeURIComponent((req.url ?? '').split('?')[0]));
          const rel = path.relative(conteudo, arq);
          if (rel.startsWith('..') || !ehImagem(rel) || !fs.existsSync(arq)) return next();
          res.setHeader('Content-Type', TIPOS_IMAGEM[path.extname(arq).toLowerCase()]);
          fs.createReadStream(arq).pipe(res);
        });
      },
      'astro:build:done': ({ dir }) => {
        const destino = path.join(fileURLToPath(dir), 'conteudo');
        for (const rel of fs.readdirSync(conteudo, { recursive: true })) {
          if (!ehImagem(rel)) continue;
          fs.mkdirSync(path.dirname(path.join(destino, rel)), { recursive: true });
          fs.copyFileSync(path.join(conteudo, rel), path.join(destino, rel));
        }
      },
    },
  };
}

export default defineConfig({
  integrations: [imagensDoConteudo()],
  site: 'https://ajuda.veltrixlabs.com.br',
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  vite: {
    plugins: [tailwindcss()],
    // O site lê o conteúdo e o CLI da raiz do repositório (../conteudo, ../cli).
    server: { fs: { allow: ['..'] } },
  },
});
