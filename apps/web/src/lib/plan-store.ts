import {
  parseStoredPlanInstance,
  serializeStoredPlanInstance,
  type StoredPlanInstance,
} from "@training-plan/plan-instance";

export const PLAN_STORAGE_KEY = "tp:plan-instance";
export const PLAN_CORRUPT_STORAGE_KEY = "tp:plan-instance:corrupt";

export type PlanLoad =
  | { status: "empty" }
  | { status: "ok"; value: StoredPlanInstance }
  /**
   * A stored plan could not be read. The raw value was moved aside to
   * `tp:plan-instance:corrupt` (never deleted); the UI treats this as "no
   * plan" plus a note.
   */
  | { status: "corrupt" };

/**
 * Where the active plan lives. Async from day one so an API-backed store
 * can replace the localStorage one without touching the UI.
 */
export interface PlanInstanceStore {
  get(): Promise<PlanLoad>;
  save(plan: StoredPlanInstance): Promise<void>;
  clear(): Promise<void>;
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * localStorage implementation. A corrupt value is copied to the corrupt key
 * BEFORE the original is removed, and an existing, different corrupt value
 * is never overwritten (a numbered key is used instead), so nothing the
 * runner made is destroyed. The raw value is never logged or returned.
 */
export function createLocalStoragePlanStore(
  storage: StorageLike = window.localStorage,
): PlanInstanceStore {
  function moveAside(raw: string): void {
    let key = PLAN_CORRUPT_STORAGE_KEY;
    const existing = storage.getItem(key);
    if (existing !== null && existing !== raw) {
      let n = 2;
      while (storage.getItem(`${PLAN_CORRUPT_STORAGE_KEY}:${n}`) !== null) n += 1;
      key = `${PLAN_CORRUPT_STORAGE_KEY}:${n}`;
    }
    storage.setItem(key, raw);
    storage.removeItem(PLAN_STORAGE_KEY);
  }

  return {
    async get() {
      const raw = storage.getItem(PLAN_STORAGE_KEY);
      if (raw === null) {
        // A previous load already moved a bad value aside; keep saying so
        // until a valid plan is saved.
        return storage.getItem(PLAN_CORRUPT_STORAGE_KEY) !== null
          ? { status: "corrupt" }
          : { status: "empty" };
      }
      const result = parseStoredPlanInstance(raw);
      if (result.status === "ok") return { status: "ok", value: result.value };
      if (result.status === "empty") return { status: "empty" };
      try {
        moveAside(raw);
      } catch {
        // Storage full or blocked: the original stays in place (still not
        // deleted) and we report corrupt anyway.
      }
      return { status: "corrupt" };
    },
    async save(plan) {
      storage.setItem(PLAN_STORAGE_KEY, serializeStoredPlanInstance(plan));
    },
    async clear() {
      storage.removeItem(PLAN_STORAGE_KEY);
    },
  };
}
