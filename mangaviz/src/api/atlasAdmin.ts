export type AtlasRefreshMode = "direct" | "pr";

export type AtlasRefreshRequest = {
  mode: AtlasRefreshMode;
  ref: string;
  maxSeries: number;
  requestDelay: number;
};

export type AtlasRefreshResponse = {
  ok: boolean;
  message: string;
  workflow: string;
  eventType: string;
  mode: AtlasRefreshMode;
  ref: string;
  maxSeries: number;
  requestDelay: number;
};

export type AtlasSessionResponse = {
  authenticated: boolean;
  message?: string;
};

const readJson = async <T>(response: Response, fallbackMessage: string): Promise<T> => {
  const payload = await response.json().catch(() => ({ message: fallbackMessage }));
  if (!response.ok) {
    throw new Error((payload as { message?: string })?.message || fallbackMessage);
  }
  return payload as T;
};

const atlasAdmin = {
  async getSession(): Promise<AtlasSessionResponse> {
    const response = await fetch("/api/admin/session", {
      method: "GET",
      credentials: "same-origin",
    });
    return readJson<AtlasSessionResponse>(response, "Unable to inspect Atlas admin session.");
  },

  async login(password: string): Promise<AtlasSessionResponse> {
    const response = await fetch("/api/admin/session", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ password }),
    });
    return readJson<AtlasSessionResponse>(response, "Atlas admin login failed.");
  },

  async logout(): Promise<AtlasSessionResponse> {
    const response = await fetch("/api/admin/session", {
      method: "DELETE",
      credentials: "same-origin",
    });
    return readJson<AtlasSessionResponse>(response, "Atlas admin logout failed.");
  },

  async triggerRefresh(input: AtlasRefreshRequest): Promise<AtlasRefreshResponse> {
    const response = await fetch("/api/admin/atlas-refresh", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        mode: input.mode,
        ref: input.ref,
        maxSeries: input.maxSeries,
        requestDelay: input.requestDelay,
      }),
    });
    return readJson<AtlasRefreshResponse>(response, "Atlas refresh trigger failed.");
  },
};

export default atlasAdmin;
