# Central de Ajuda (ajuda.veltrixlabs.com.br) — site estático servido pelo nginx.
# Build no Coolify: Build Pack "Dockerfile", contexto na raiz do repositório.

FROM node:24-slim AS build
WORKDIR /app

# Dependências do CLI (validação e leitura do conteúdo) e do site
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY site/package.json site/package-lock.json site/
RUN cd site && npm ci --no-audit --no-fund

COPY . .

# Endereço do suporte e da API de avaliações (opcionais; vazios escondem os blocos)
ARG PUBLIC_SUPORTE_URL=""
ARG PUBLIC_AJUDA_API=""
ENV PUBLIC_SUPORTE_URL=$PUBLIC_SUPORTE_URL PUBLIC_AJUDA_API=$PUBLIC_AJUDA_API

# Só conteúdo válido vai ao ar; rascunhos ficam de fora (AJUDA_RASCUNHOS não definido)
RUN npx tsx cli/index.ts validar && cd site && npm run build

FROM nginx:1.27-alpine
COPY site/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/site/dist /usr/share/nginx/html
EXPOSE 80
