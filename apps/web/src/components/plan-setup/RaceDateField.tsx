import type { UseFormRegister } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PlanSetupFormValues } from "@/lib/plan-setup-validation";

/**
 * Native `<input type="date">`, not a shadcn Calendar/Popover date-picker —
 * one single date, no range. See design spec §6.2 "Race date:
 * recommendation" for the full trade-off.
 */
export function RaceDateField({
  register,
  errorMessage,
}: {
  register: UseFormRegister<PlanSetupFormValues>;
  errorMessage?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor="race-date" className="sr-only">
        Race date
      </Label>
      <Input
        id="race-date"
        type="date"
        aria-invalid={!!errorMessage}
        aria-describedby={errorMessage ? "race-date-error" : undefined}
        className="h-11 w-fit"
        {...register("raceDate")}
      />
      {errorMessage ? (
        <p id="race-date-error" role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
