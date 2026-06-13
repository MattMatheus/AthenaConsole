import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { AthenaError } from "../../runtime/errors.js";
import type { AthenaConfig } from "../../shared/config.js";
import type { ModelProviderSecretReference } from "../../shared/contracts/model-providers.js";
import type { EventService } from "../interfaces.js";

export interface SecretReadAuditContext {
  purpose: string;
  subject?: string;
  resourceId?: string;
}

export interface SecretResolverOptions {
  eventService?: EventService;
}

export class SecretResolver {
  constructor(
    private readonly config: AthenaConfig,
    private readonly options: SecretResolverOptions = {}
  ) {}

  resolve(secret: ModelProviderSecretReference, audit?: SecretReadAuditContext): string {
    const value = this.resolveValue(secret);
    if (audit) {
      void this.emitSecretReadAudit(secret, audit);
    }
    return value;
  }

  private resolveValue(secret: ModelProviderSecretReference): string {
    if (secret.kind === "env") {
      const value = process.env[secret.name] ?? readDotEnvValue(this.config.workspaceRoot, secret.name);
      if (!value) {
        throw new AthenaError("CONFIG_ERROR", `Environment secret is not configured: ${secret.name}`);
      }
      return value;
    }
    if (secret.kind === "local-file") {
      if (!isAbsolute(secret.name)) {
        throw new AthenaError("CONFIG_ERROR", "Local-file secret reference must be an absolute path.");
      }
      if (!existsSync(secret.name)) {
        throw new AthenaError("CONFIG_ERROR", "Local-file secret reference does not exist.");
      }
      const value = readFileSync(secret.name, "utf8").trim();
      if (!value) {
        throw new AthenaError("CONFIG_ERROR", "Local-file secret reference is empty.");
      }
      return value;
    }
    throw new AthenaError("CONFIG_ERROR", "Unsupported secret reference kind.");
  }

  private async emitSecretReadAudit(secret: ModelProviderSecretReference, audit: SecretReadAuditContext): Promise<void> {
    const eventService = this.options.eventService;
    if (!eventService) {
      return;
    }
    try {
      await eventService.emit({
        type: "secret.read",
        payload: {
          reference: {
            kind: secret.kind,
            name: secret.name
          },
          purpose: audit.purpose,
          subject: audit.subject ?? "system",
          ...(audit.resourceId ? { resourceId: audit.resourceId } : {})
        }
      });
    } catch {
      // Secret access auditing is best-effort and must not make provider reads fail.
    }
  }
}

function readDotEnvValue(workspaceRoot: string, key: string): string | undefined {
  const envPath = resolve(workspaceRoot, ".env");
  if (!existsSync(envPath)) {
    return undefined;
  }
  const content = readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) {
      continue;
    }
    const name = line.slice(0, eqIndex).trim();
    if (name !== key) {
      continue;
    }
    return line.slice(eqIndex + 1).trim().replace(/^['"]|['"]$/g, "");
  }
  return undefined;
}
