export type ModelProviderKind = "openai-compatible";
export type ModelProviderSecretReferenceKind = "env" | "local-file";
export type ModelProviderSecretStatus = "configured" | "missing" | "invalid" | "unsupported";

export type ModelProviderSecretReference = {
  kind: ModelProviderSecretReferenceKind;
  name: string;
};

export type ModelProviderSecretMetadata = ModelProviderSecretReference & {
  configured: boolean;
};

export type ModelProviderConfig = {
  id: string;
  name: string;
  providerKind: ModelProviderKind;
  baseUrl: string;
  defaultModel: string;
  secret: ModelProviderSecretMetadata;
  status: ModelProviderSecretStatus;
  statusMessage?: string;
  createdAt: string;
  updatedAt: string;
};

export type ModelProviderConfigListResult = {
  providers: ModelProviderConfig[];
  total: number;
};

export type ModelProviderConfigCreateRequest = {
  id?: string;
  name: string;
  providerKind: ModelProviderKind;
  baseUrl?: string;
  defaultModel: string;
  secret: ModelProviderSecretReference;
};

export type ModelProviderConfigUpdateRequest = Partial<ModelProviderConfigCreateRequest>;

export type ModelProviderConfigDeleteResult = {
  id: string;
  deleted: boolean;
};

export type ModelProviderConnectionTestResult = {
  id: string;
  status: ModelProviderSecretStatus;
  message: string;
  secret: ModelProviderSecretMetadata;
  testedAt: string;
};
