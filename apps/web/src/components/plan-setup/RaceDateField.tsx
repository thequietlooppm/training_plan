import { useWatch, type UseFormRegister } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatLongDate } from "@/lib/plan-setup-format";
import type { PlanSetupFormValues } from "@/lib/plan-setup-validation";

/**
 * Native `<input type="date">`, not a shadcn Calendar/Popover date-picker —
 * one single date, no range. See design spec §6.2 "Race date:
 * recommendation" for the full trade-off. A long-form line under the field
 * confirms the chosen date unambiguously (#65). It reads the live value via
 * `useWatch`, so it must render inside the form's `FormProvider`.
 */
export function RaceDateField({
  register,
  errorMessage,
}: {
  register: UseFormRegister<PlanSetupFormValues>;
  errorMessage?: string;
}) {
  const value = useWatch<PlanSetupFormValues, "raceDate">({ name: "raceDate" });
  const longDate = formatLongDate(value ?? "");

  return (
    <div className="grid gap-2">
      <Label htmlFor="race-date" className="sr-only">
        Race date
      </Label>
      <Input
        id="race-date"
        type="date"
        aria-invalid={!!errorMessage}
        aria-describedby={errorMessage ? "race-date-long race-date-error" : "race-date-long"}
        className="h-11 w-full min-w-0 max-w-[14rem]"
        {...register("raceDate")}
      />
      <p
        id="race-date-long"
        aria-live="polite"
        data-testid="race-date-long"
        className="min-h-5 text-sm text-muted-foreground"
      >
        {longDate}
      </p>
      {errorMessage ? (
        <p id="race-date-error" role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
