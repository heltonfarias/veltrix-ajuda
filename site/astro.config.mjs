import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Raiz do repositório veltrix-ajuda (conteudo/, taxonomia/, manifestos/).
process.env.AJUDA_RAIZ ??= path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export default defineConfig({
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
