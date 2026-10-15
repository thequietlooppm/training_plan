import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PLAN_CORRUPT_STORAGE_KEY,
  PLAN_STORAGE_KEY,
  createLocalStoragePlanStore,
} from "@/lib/plan-store";
import { makeStoredPlan } from "@/test-fixtures";

beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

describe("localStorage PlanInstanceStore", () => {
  it("reports empty when nothing is stored", async () => {
    const store = createLocalStoragePlanStore(window.localStorage);
    expect(await store.get()).toEqual({ status: "empty" });
  });

  it("round-trips a saved plan under tp:plan-instance", async () => {
    const store = createLocalStoragePlanStore(window.localStorage);
    const plan = makeStoredPlan("2026-12-20");
    await store.save(plan);
    expect(window.localStorage.getItem("tp:plan-instance")).not.toBeNull();
    expect(await store.get()).toEqual({ status: "ok", value: plan });
  });

  it("clear removes the plan", async () => {
    const store = createLocalStoragePlanStore(window.localStorage);
    await store.save(makeStoredPlan("2026-12-20"));
    await store.clear();
    expect(await store.get()).toEqual({ status: "empty" });
  });

  it("moves an unparseable value aside, never deletes it, and reports corrupt", async () => {
    window.localStorage.setItem(PLAN_STORAGE_KEY, "{not json");
    const store = createLocalStoragePlanStore(window.localStorage);

    expect(await store.get()).toEqual({ status: "corrupt" });
    expect(window.localStorage.getItem(PLAN_CORRUPT_STORAGE_KEY)).toBe("{not json");
    expect(window.localStorage.getItem(PLAN_STORAGE_KEY)).toBeNull();
    // Still corrupt on the next load, and the aside copy is untouched.
    expect(await store.get()).toEqual({ status: "corrupt" });
    expect(window.localStorage.getItem(PLAN_CORRUPT_STORAGE_KEY)).toBe("{not json");
  });

  it("moves aside a well-formed JSON blob with the wrong shape", async () => {
    const raw = JSON.stringify({ schemaVersion: 1, id: "nope" });
    window.localStorage.setItem(PLAN_STORAGE_KEY, raw);
    const store = createLocalStoragePlanStore(window.localStorage);
    expect(await store.get()).toEqual({ status: "corrupt" });
    expect(window.localStorage.getItem(PLAN_CORRUPT_STORAGE_KEY)).toBe(raw);
  });

  it("moves aside a blob from a newer schema version", async () => {
    const raw = JSON.stringify({ ...makeStoredPlan("2026-12-20"), schemaVersion: 99 });
    window.localStorage.setItem(PLAN_STORAGE_KEY, raw);
    const store = createLocalStoragePlanStore(window.localStorage);
    expect(await store.get()).toEqual({ status: "corrupt" });
    expect(window.localStorage.getItem(PLAN_CORRUPT_STORAGE_KEY)).toBe(raw);
  });

  it("never overwrites an earlier, different corrupt value", async () => {
    window.localStorage.setItem(PLAN_CORRUPT_STORAGE_KEY, "first");
    window.localStorage.setItem(PLAN_STORAGE_KEY, "second");
    const store = createLocalStoragePlanStore(window.localStorage);

    await store.get();
    expect(window.localStorage.getItem(PLAN_CORRUPT_STORAGE_KEY)).toBe("first");
    expect(window.localStorage.getItem(`${PLAN_CORRUPT_STORAGE_KEY}:2`)).toBe("second");
  });

  it("keeps the original in place if the aside copy cannot be written", async () => {
    window.localStorage.setItem(PLAN_STORAGE_KEY, "{bad");
    const storage = {
      getItem: (k: string) => window.localStorage.getItem(k),
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: (k: string) => window.localStorage.removeItem(k),
    };
    const store = createLocalStoragePlanStore(storage);
    expect(await store.get()).toEqual({ status: "corrupt" });
    expect(window.localStorage.getItem(PLAN_STORAGE_KEY)).toBe("{bad");
  });

  it("a valid save after a corrupt load returns ok", async () => {
    window.localStorage.setItem(PLAN_STORAGE_KEY, "{bad");
    const store = createLocalStoragePlanStore(window.localStorage);
    await store.get();
    const plan = makeStoredPlan("2026-12-20");
    await store.save(plan);
    expect(await store.get()).toEqual({ status: "ok", value: plan });
    // The set-aside copy is still there.
    expect(window.localStorage.getItem(PLAN_CORRUPT_STORAGE_KEY)).toBe("{bad");
  });
});
