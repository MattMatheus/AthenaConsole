import { randomUUID } from "node:crypto";
import { AthenaError } from "../../runtime/errors.js";
import type { AthenaConfig } from "../../shared/config.js";
import type {
  ModelProviderConfig,
  ModelProviderConfigCreateRequest,
  ModelProviderConfigDeleteResult,
  ModelProviderConfigListResult,
  ModelProviderConfigUpdateRequest,
  ModelProviderConnectionTestResult,
  ModelProviderRuntimeConfig,
  ModelProviderSecretMetadata,
  ModelProviderSecretReference,
  ModelProviderSecretStatus
} from "../../shared/contracts/model-providers.js";
import type { AppStateDatabase } from "../app-state/index.js";
import { openAppStateDatabase } from "../app-state/index.js";
import type { ModelProviderConfigRecord } from "../app-state/domain-repositories/model-providers.js";
import { getRequestAuthContext } from "../auth.js";
import type { EventService, ModelProviderConfigService } from "../interfaces.js";
import { SecretResolver } from "./secret-resolver.js";

const DEFAULT_OPENAI_COMPATIBLE_BASE_URL = "https://api.openai.com/v1";

export class LocalModelProviderConfigService implements ModelProviderConfigService {
  private readonly secretResolver: SecretResolver;

  constructor(
    private readonly config: AthenaConfig,
    options: { eventService?: EventService } = {}
  ) {
    this.secretResolver = new SecretResolver(config, { eventService: options.eventService });
  }

  async list(options: { workspaceId?: string; workspaceIds?: string[] } = {}): Promise<ModelProviderConfigListResult> {
    return this.withAppState((appState) => {
      const providers = appState.modelProviderConfigs.list(options).map((record) => this.mapRecord(record));
      return {
        providers,
        total: providers.length
      };
    });
  }

  async get(id: string): Promise<ModelProviderConfig> {
    return this.withAppState((appState) => {
      const record = appState.modelProviderConfigs.get(id);
      if (!record) {
        throw new AthenaError("PROVIDER_NOT_FOUND", `Model provider config not found: ${id}`);
      }
      return this.mapRecord(record);
    });
  }

  async create(request: ModelProviderConfigCreateRequest): Promise<ModelProviderConfig> {
    return this.withAppState((appState) => {
      const status = this.evaluateSecret(request.secret);
      try {
        const record = appState.modelProviderConfigs.create({
          id: request.id ?? `provider-${randomUUID()}`,
          name: request.name,
          providerKind: request.providerKind,
          baseUrl: request.baseUrl ?? DEFAULT_OPENAI_COMPATIBLE_BASE_URL,
          defaultModel: request.defaultModel,
          secretRef: request.secret,
          ...(request.workspaceId ? { workspaceId: request.workspaceId } : {}),
          status: status.status,
          statusMessage: status.message
        });
        return this.mapRecord(record);
      } catch (error) {
        throw normalizeProviderConfigError(error);
      }
    });
  }

  async update(id: string, request: ModelProviderConfigUpdateRequest): Promise<ModelProviderConfig> {
    return this.withAppState((appState) => {
      const existing = appState.modelProviderConfigs.get(id);
      if (!existing) {
        throw new AthenaError("PROVIDER_NOT_FOUND", `Model provider config not found: ${id}`);
      }
      const nextSecret = request.secret ?? existing.secretRef;
      const status = this.evaluateSecret(nextSecret);
      const updated = appState.modelProviderConfigs.update(id, {
        ...(request.name ? { name: request.name } : {}),
        ...(request.providerKind ? { providerKind: request.providerKind } : {}),
        ...(request.baseUrl ? { baseUrl: request.baseUrl } : {}),
        ...(request.defaultModel ? { defaultModel: request.defaultModel } : {}),
        ...(request.secret ? { secretRef: request.secret } : {}),
        status: status.status,
        statusMessage: status.message
      });
      if (!updated) {
        throw new AthenaError("PROVIDER_NOT_FOUND", `Model provider config not found: ${id}`);
      }
      return this.mapRecord(updated);
    });
  }

  async delete(id: string): Promise<ModelProviderConfigDeleteResult> {
    return this.withAppState((appState) => ({
      id,
      deleted: appState.modelProviderConfigs.delete(id)
    }));
  }

  async test(id: string): Promise<ModelProviderConnectionTestResult> {
    return this.withAppState((appState) => {
      const record = appState.modelProviderConfigs.get(id);
      if (!record) {
        throw new AthenaError("PROVIDER_NOT_FOUND", `Model provider config not found: ${id}`);
      }
      const status = this.evaluateSecret(record.secretRef, {
        purpose: "model-provider.test",
        subject: getRequestAuthContext()?.subject,
        resourceId: record.id
      });
      appState.modelProviderConfigs.update(id, {
        status: status.status,
        statusMessage: status.message
      });
      return {
        id,
        status: status.status,
        message: status.message,
        secret: secretMetadata(record.secretRef, status.status === "configured"),
        testedAt: new Date().toISOString()
      };
    });
  }

  async resolveRuntimeConfig(id: string): Promise<ModelProviderRuntimeConfig> {
    return this.withAppState((appState) => {
      const record = appState.modelProviderConfigs.get(id);
      if (!record) {
        throw new AthenaError("PROVIDER_NOT_FOUND", `Model provider config not found: ${id}`);
      }
      if (record.providerKind !== "openai-compatible") {
        throw new AthenaError("CONFIG_ERROR", `Unsupported model provider kind: ${record.providerKind}`);
      }
      const apiKey = this.secretResolver.resolve(record.secretRef, {
        purpose: "model-provider.runtime",
        subject: getRequestAuthContext()?.subject,
        resourceId: record.id
      });
      return {
        id: record.id,
        providerKind: record.providerKind,
        baseUrl: record.baseUrl,
        defaultModel: record.defaultModel,
        apiKey
      };
    });
  }

  private withAppState<T>(callback: (appState: AppStateDatabase) => T): T {
    const appState = openAppStateDatabase(this.config);
    try {
      return callback(appState);
    } finally {
      appState.close();
    }
  }

  private evaluateSecret(
    secret: ModelProviderSecretReference,
    audit?: { purpose: string; subject?: string; resourceId?: string }
  ): { status: ModelProviderSecretStatus; message: string } {
    try {
      this.secretResolver.resolve(secret, audit);
      return {
        status: "configured",
        message: `${secret.kind} secret reference is configured.`
      };
    } catch (error) {
      if (error instanceof AthenaError) {
        const status: ModelProviderSecretStatus = error.code === "CONFIG_ERROR" ? "missing" : "invalid";
        return {
          status,
          message: error.message
        };
      }
      return {
        status: "invalid",
        message: "Secret reference could not be resolved."
      };
    }
  }

  private mapRecord(record: ModelProviderConfigRecord): ModelProviderConfig {
    const configured = record.status === "configured";
    return {
      id: record.id,
      name: record.name,
      providerKind: record.providerKind,
      baseUrl: record.baseUrl,
      defaultModel: record.defaultModel,
      secret: secretMetadata(record.secretRef, configured),
      status: record.status,
      ...(record.statusMessage ? { statusMessage: record.statusMessage } : {}),
      workspaceId: record.workspaceId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }
}

function secretMetadata(secret: ModelProviderSecretReference, configured: boolean): ModelProviderSecretMetadata {
  return {
    kind: secret.kind,
    name: secret.name,
    configured
  };
}

function normalizeProviderConfigError(error: unknown): AthenaError {
  if (error instanceof AthenaError) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("UNIQUE constraint failed")) {
    return new AthenaError("CONFIG_ERROR", "Model provider config id already exists.");
  }
  return new AthenaError("PROVIDER_ERROR", message, true, error);
}
