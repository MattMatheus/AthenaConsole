FROM node:20-bookworm-slim AS builder
WORKDIR /workspace

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/console/package*.json ./apps/console/
COPY packages/core/package*.json ./packages/core/
COPY packages/pdk/package*.json ./packages/pdk/
RUN npm ci

COPY . .
RUN npm run build --workspace @athena/core && npm run build --workspace @athena/api

FROM node:20-bookworm-slim AS runtime
WORKDIR /workspace

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates git python3 python3-pip python3-venv \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV ATHENA_DEV_API_HOST=0.0.0.0
ENV ATHENA_DEV_API_PORT=8787
ENV ATHENA_AGENT_REPO=/opt/athena-agent-src
ENV ATHENA_AGENT_PYTHON=/opt/athena-agent-venv/bin/python

COPY --from=athena_agent . /opt/athena-agent-src
RUN python3 -m venv /opt/athena-agent-venv \
  && /opt/athena-agent-venv/bin/python -m pip install --upgrade pip \
  && /opt/athena-agent-venv/bin/python -m pip install --no-cache-dir /opt/athena-agent-src

COPY --from=builder /workspace/package*.json ./
COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/apps/api/package*.json ./apps/api/
COPY --from=builder /workspace/apps/api/dist ./apps/api/dist
COPY --from=builder /workspace/packages/core/package*.json ./packages/core/
COPY --from=builder /workspace/packages/core/dist ./packages/core/dist

EXPOSE 8787
CMD ["node", "apps/api/dist/main.js"]
