const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error("VITE_API_BASE_URL is not set");
}

export interface HealthResponse {
  status: "ok";
}

function parseHealthResponse(value: unknown): HealthResponse {
  if (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    (value as { status: unknown }).status === "ok"
  ) {
    return { status: "ok" };
  }
  throw new Error("GET /health returned an unexpected payload");
}

/**
 * Fetches apps/api's /health endpoint. Throws on a non-2xx response, an
 * unexpected payload shape, or a network failure so TanStack Query's error
 * state picks it up.
 */
export async function fetchHealth({
  signal,
}: { signal?: AbortSignal } = {}): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`, { signal });

  if (!response.ok) {
    throw new Error(`GET /health responded with ${response.status}`);
  }

  return parseHealthResponse(await response.json());
}
