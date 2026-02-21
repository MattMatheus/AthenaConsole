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

## 5. Run A Sample Persona

In a second terminal (from the repository root), run:

```bash
athena persona run --name code-review --repo . --head main --stdout summary
```

If `athena` is not in your PATH yet, run the same command via npm:

```bash
npm run athena -- persona run --name code-review --repo . --head main --stdout summary
```

## Important Scope Note

Terraform and Azure infrastructure setup are for production deployments only and are not required for local development.
