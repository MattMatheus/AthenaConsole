FROM node:20-bookworm-slim AS builder
WORKDIR /workspace

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/console/package*.json ./apps/console/
COPY packages/core/package*.json ./packages/core/
COPY packages/pdk/package*.json ./packages/pdk/
RUN npm ci

COPY . .
RUN npm run build --workspace @athena/console

FROM nginx:1.27-alpine
RUN apk add --no-cache apache2-utils
COPY packages/core/infrastructure/docker/console.nginx.prod.conf /etc/nginx/templates/athena-console.conf.template
COPY packages/core/infrastructure/docker/console-entrypoint.sh /usr/local/bin/athena-console-entrypoint.sh
RUN chmod +x /usr/local/bin/athena-console-entrypoint.sh
COPY --from=builder /workspace/apps/console/dist /usr/share/nginx/html

EXPOSE 80
ENTRYPOINT ["/usr/local/bin/athena-console-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
