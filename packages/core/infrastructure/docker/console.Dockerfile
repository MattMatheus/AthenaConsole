FROM node:20-bookworm-slim
WORKDIR /workspace

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/console/package*.json ./apps/console/
COPY packages/core/package*.json ./packages/core/
COPY packages/pdk/package*.json ./packages/pdk/
RUN npm ci

COPY . .

WORKDIR /workspace/apps/console
EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
