FROM node:20-bookworm-slim AS build
WORKDIR /workspace

COPY package*.json ./
COPY packages/console/package*.json ./packages/console/
COPY packages/pdk/package*.json ./packages/pdk/
RUN npm ci

COPY . .
RUN npm run build:core

FROM node:20-bookworm-slim AS runtime
WORKDIR /app

COPY package*.json ./
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/dist ./dist
COPY scripts ./scripts

ENV NODE_ENV=production
EXPOSE 8787

CMD ["node", "dist/src/cli/main.js", "api", "serve", "--host", "0.0.0.0", "--port", "8787"]
