import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomePage } from "@/pages/HomePage";

describe("HomePage — cold-start affordance", () => {
  let resolveFetch: (value: unknown) => void;

  beforeEach(() => {
    vi.useFakeTimers();
    // Fetch never resolves until the test calls `resolveFetch` — this lets
    // us hold the query in its loading state for a controlled amount of
    // fake time, the same shape as a real Render free-tier cold start.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function renderHomePage() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <HomePage />
      </QueryClientProvider>,
    );
  }

  it("does not show the caption while loading has been under 3s", () => {
    renderHomePage();

    expect(screen.queryByText(/still connecting/i)).toBeNull();
  });

  it("shows the caption once loading passes 3s, and clears it once the request resolves", async () => {
    renderHomePage();

    // Just under the threshold: still no caption.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2999);
    });
    expect(screen.queryByText(/still connecting/i)).toBeNull();

    // Past the threshold: caption appears, skeleton still present.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(
      screen.getByText(/still connecting — waking up the api/i),
    ).toBeDefined();

    // The request finally resolves (simulating the cold start waking up).
    resolveFetch({ ok: true, json: () => Promise.resolve({ status: "ok" }) });
    // Give the resolved fetch promise, `response.json()`, and TanStack
    // Query's internal state update a few microtask/macrotask turns to
    // settle, all still under fake timers.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText("Backend connected")).toBeDefined();
    expect(screen.queryByText(/still connecting/i)).toBeNull();
  });
});
