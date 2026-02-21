# Getting Started (3-Minute Quickstart)

Use this guide to go from clone to your first local Athena persona run.

## 1. Prerequisites

Install:

- Node.js 20+
- Podman (recommended) or Docker, with Compose support

## 2. Clone The Repository

```bash
git clone <your-repo-url>
cd athena
```

## 3. Set Up Environment Variables

Copy the example environment file and add your LLM API key.

```bash
cp packages/core/.env.example .env
```

At minimum, set this in `.env`:

```env
ATHENA_OPENAI_API_KEY=your_api_key_here
```

## 4. Start The Local Stack

```bash
podman compose -f docker-compose.local.yml up --build
```

## 5. Start A Production-Like Stack (Optional)

Builds compiled API artifacts and serves static console assets through Nginx with `/api/*` proxied to the API container.

```bash
podman compose -f docker-compose.prod.yml up --build
```

Useful checks:

```bash
curl http://127.0.0.1:8787/api/v1/health
curl http://127.0.0.1:5173/api/v1/health
```

To stop and remove containers:

```bash
podman compose -f docker-compose.prod.yml down
```

## 6. Run A Sample Persona

In a second terminal (from the repository root), run:

```bash
athena persona run --name code-review --repo . --head main --stdout summary
```

If `athena` is not in your PATH yet, run the same command via npm:

```bash
npm run athena -- persona run --name code-review --repo . --head main --stdout summary
```

## Container Build Context Hygiene

Root `.dockerignore` is configured to exclude high-churn and heavy directories (`.git`, `node_modules`, `dist`, `.turbo`, `.athena`, `planning`, and related artifacts).

Measured local context payload on February 21, 2026:

- Baseline file payload (no ignore filtering): `825,900,457` bytes
- Filtered payload (with `.dockerignore` patterns): `277,442,309` bytes
- Reduction: `548,458,148` bytes (`66.4%`)

Measurement method:

```bash
find . -type f -print0 | xargs -0 stat -f%z | awk '{s+=$1} END {print s}'
find . \( -name .git -o -name node_modules -o -name .turbo -o -name .cache -o -name dist -o -name coverage -o -name .nyc_output -o -name .athena -o -name planning \) -prune -o -type f ! -name '.DS_Store' ! -name '*.log' ! -name '.env' ! -name '.env.*' -print0 | xargs -0 stat -f%z | awk '{s+=$1} END {print s}'
```

## Important Scope Note

Terraform and Azure infrastructure setup are for production deployments only and are not required for local development.
