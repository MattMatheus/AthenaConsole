export type ApiClientOptions = {
  baseUrl?: string;
};

type ApiEnvelope<TData> =
  | { ok: true; data: TData }
  | { ok: false; error?: { message?: string; details?: unknown } };

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly details: unknown;

  constructor(message: string, options: { status: number; code?: string; details?: unknown }) {
    super(message);
    this.name = "ApiClientError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}

export class ApiClient {
  private readonly baseUrl: string;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? "/api";
  }

  async get<TResponse>(path: string): Promise<TResponse> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: this.authHeaders()
    });
    if (!response.ok) {
      throw await this.toApiClientError(response, `GET ${path}`);
    }

    const body = (await response.json()) as ApiEnvelope<TResponse> | TResponse;
    if (
      typeof body === "object" &&
      body !== null &&
      "ok" in body &&
      (body as { ok: boolean }).ok === true &&
      "data" in body
    ) {
      return (body as { data: TResponse }).data;
    }

    if (
      typeof body === "object" &&
      body !== null &&
      "ok" in body &&
      (body as { ok: boolean }).ok === false
    ) {
      const message =
        "error" in body &&
        typeof body.error === "object" &&
        body.error !== null &&
        "message" in body.error &&
        typeof body.error.message === "string"
          ? body.error.message
          : `GET ${path} failed`;
      throw new Error(message);
    }

    return body as TResponse;
  }

  async put<TResponse>(path: string, payload: unknown): Promise<TResponse> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        ...this.authHeaders()
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw await this.toApiClientError(response, `PUT ${path}`);
    }

    const body = (await response.json()) as ApiEnvelope<TResponse> | TResponse;
    if (
      typeof body === "object" &&
      body !== null &&
      "ok" in body &&
      (body as { ok: boolean }).ok === true &&
      "data" in body
    ) {
      return (body as { data: TResponse }).data;
    }
    return body as TResponse;
  }

  async post<TResponse>(path: string, payload?: unknown): Promise<TResponse> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...this.authHeaders()
      },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) })
    });
    if (!response.ok) {
      throw await this.toApiClientError(response, `POST ${path}`);
    }

    const body = (await response.json()) as ApiEnvelope<TResponse> | TResponse;
    if (
      typeof body === "object" &&
      body !== null &&
      "ok" in body &&
      (body as { ok: boolean }).ok === true &&
      "data" in body
    ) {
      return (body as { data: TResponse }).data;
    }
    return body as TResponse;
  }

  async getText(path: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: this.authHeaders()
    });
    if (!response.ok) {
      throw await this.toApiClientError(response, `GET ${path}`);
    }
    return response.text();
  }

  async delete<TResponse>(path: string): Promise<TResponse> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "DELETE",
      headers: this.authHeaders()
    });
    if (!response.ok) {
      throw await this.toApiClientError(response, `DELETE ${path}`);
    }
    const body = (await response.json()) as ApiEnvelope<TResponse> | TResponse;
    if (
      typeof body === "object" &&
      body !== null &&
      "ok" in body &&
      (body as { ok: boolean }).ok === true &&
      "data" in body
    ) {
      return (body as { data: TResponse }).data;
    }
    return body as TResponse;
  }

  private async toApiClientError(response: Response, fallbackContext: string): Promise<ApiClientError> {
    let message = `${fallbackContext} failed with status ${response.status}`;
    let code: string | undefined;
    let details: unknown;
    try {
      const payload = (await response.json()) as {
        error?: { message?: string; code?: string; details?: unknown };
      };
      if (payload.error?.message) {
        message = payload.error.message;
      }
      if (payload.error?.code) {
        code = payload.error.code;
      }
      if (payload.error && "details" in payload.error) {
        details = payload.error.details;
      }
    } catch {
      // Keep generic fallback message when response is not JSON.
    }
    return new ApiClientError(message, { status: response.status, ...(code ? { code } : {}), ...(details !== undefined ? { details } : {}) });
  }

  private authHeaders(): Record<string, string> {
    return {};
  }
}

export const apiClient = new ApiClient();
