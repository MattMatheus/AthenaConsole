FROM node:20-bookworm-slim
WORKDIR /workspace

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/console/package*.json ./apps/console/
COPY packages/core/package*.json ./packages/core/
COPY packages/pdk/package*.json ./packages/pdk/
RUN npm ci

COPY . .
RUN npm run build --workspace @athena/core
RUN npm run build --workspace @athena/api

ENV NODE_ENV=production
ENV ATHENA_DEV_API_HOST=0.0.0.0
ENV ATHENA_DEV_API_PORT=8787
EXPOSE 8787

CMD ["node", "apps/api/dist/main.js"]
