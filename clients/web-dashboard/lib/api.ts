const configuredBackend = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();
const runtimeOrigin = typeof window !== "undefined" ? window.location.origin : "";

export const BACKEND_URL =
  configuredBackend ||
  runtimeOrigin ||
  // Canonical gateway endpoint fallback for this codebase state.
  "https://testpilot-64v5.onrender.com";

export type Repo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  url: string;
};

export type ServiceStatus = {
  name: string;
  url: string;
  configured: boolean;
  reachable: boolean;
  status_code?: number;
  error?: string;
};

export type GatewayStatus = {
  gateway: {
    reachable: boolean;
    mock_mode: boolean;
  };
  runtime?: {
    git?: {
      installed: boolean;
      version?: string;
      path?: string;
    };
  };
  services: ServiceStatus[];
  capabilities: string[];
};

export type MeResponse = {
  id: number;
  github_id: number;
  login: string;
  github_install: string;
  backend_url: string;
  frontend_url: string;
  mock_review_mode: boolean;
};

export async function fetchWithToken<T>(
  path: string,
  token: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

