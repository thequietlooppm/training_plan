import { useState } from "react";
import { todayLocalDateString } from "@/lib/plan-setup-validation";

/**
 * The runner's local calendar date (`YYYY-MM-DD`), read once per mount. The
 * only place the app reads the clock for plan logic; everything downstream
 * takes `today` as a plain argument so it is trivially testable.
 */
export function useToday(): string {
  const [today] = useState(() => todayLocalDateString());
  return today;
}
