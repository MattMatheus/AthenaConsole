export type ModelProviderKind = "openai-compatible";
export type ModelProviderSecretReferenceKind = "env" | "local-file";
export type ModelProviderSecretStatus = "configured" | "missing" | "invalid" | "unsupported";

export interface ModelProviderSecretReference {
  kind: ModelProviderSecretReferenceKind;
  name: string;
}

export interface ModelProviderSecretMetadata {
  kind: ModelProviderSecretReferenceKind;
  name: string;
  configured: boolean;
}

export interface ModelProviderConfig {
  id: string;
  name: string;
  providerKind: ModelProviderKind;
  baseUrl: string;
  defaultModel: string;
  secret: ModelProviderSecretMetadata;
  status: ModelProviderSecretStatus;
  statusMessage?: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ModelProviderConfigListResult {
  providers: ModelProviderConfig[];
  total: number;
}

export interface ModelProviderConfigCreateRequest {
  id?: string;
  name: string;
  providerKind: ModelProviderKind;
  baseUrl?: string;
  defaultModel: string;
  secret: ModelProviderSecretReference;
  workspaceId?: string;
}

export interface ModelProviderConfigUpdateRequest {
  name?: string;
  providerKind?: ModelProviderKind;
  baseUrl?: string;
  defaultModel?: string;
  secret?: ModelProviderSecretReference;
}

export interface ModelProviderConfigDeleteResult {
  id: string;
  deleted: boolean;
}

export interface ModelProviderRuntimeConfig {
  id: string;
  providerKind: ModelProviderKind;
  baseUrl: string;
  defaultModel: string;
  apiKey: string;
}

export interface ModelProviderConnectionTestResult {
  id: string;
  status: ModelProviderSecretStatus;
  message: string;
  secret: ModelProviderSecretMetadata;
  testedAt: string;
}
