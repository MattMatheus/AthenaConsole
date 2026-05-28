FROM node:20-bookworm-slim AS builder
WORKDIR /workspace

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/console/package*.json ./apps/console/
COPY apps/marketing/package*.json ./apps/marketing/
COPY packages/core/package*.json ./packages/core/
COPY packages/pdk/package*.json ./packages/pdk/
RUN npm ci

COPY . .
ARG VITE_ATHENA_API_TOKEN
ARG VITE_ATHENA_IDENTITY
ARG VITE_CONSOLE_PASSWORD
ENV VITE_ATHENA_API_TOKEN=$VITE_ATHENA_API_TOKEN
ENV VITE_ATHENA_IDENTITY=$VITE_ATHENA_IDENTITY
ENV VITE_CONSOLE_PASSWORD=$VITE_CONSOLE_PASSWORD
RUN npm run build --workspace @athena/console

FROM nginx:1.27-alpine
COPY packages/core/infrastructure/docker/console.nginx.prod.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /workspace/apps/console/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
