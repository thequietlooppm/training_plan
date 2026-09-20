const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export interface HealthResponse {
  status: string;
}

/**
 * Fetches apps/api's /health endpoint. Throws on a non-2xx response or a
 * network failure so TanStack Query's error state picks it up.
 */
export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`);

  if (!response.ok) {
    throw new Error(`GET /health responded with ${response.status}`);
  }

  return (await response.json()) as HealthResponse;
}
