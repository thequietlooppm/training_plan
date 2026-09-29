import type { FieldValues, Path, UseFormRegister } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Three separate `Input type="number"` fields (Hours / Minutes / Seconds)
 * over a single free-text "H:MM:SS" field — avoids parse ambiguity, maps
 * directly to `hours*3600 + minutes*60 + seconds`, gets per-field range
 * checks and a numeric keypad on mobile. See design spec §6.2 "Time entry:
 * recommendation" for the full trade-off.
 *
 * Used by both `RecentResultFields` and `GoalTimeFields`. Not a shadcn
 * primitive — a custom composite assembled from `Input` + `Label` inside a
 * `fieldset`, per design spec §6.2/§8.
 *
 * The visible labels ("H" / "MM" / "SS") are decorative placeholders; each
 * input still gets a real, individually-announced `<Label>` ("Hours" /
 * "Minutes" / "Seconds"), kept visually condensed via `sr-only` rather than
 * removed — screen-reader users get the full word, sighted users get the
 * compact cue (§8).
 */
export function TimeInputGroup<TFieldValues extends FieldValues>({
  legend,
  idPrefix,
  hoursName,
  minutesName,
  secondsName,
  register,
  errorMessage,
}: {
  legend: string;
  idPrefix: string;
  hoursName: Path<TFieldValues>;
  minutesName: Path<TFieldValues>;
  secondsName: Path<TFieldValues>;
  register: UseFormRegister<TFieldValues>;
  errorMessage?: string;
}) {
  const errorId = `${idPrefix}-time-error`;
  const describedBy = errorMessage ? errorId : undefined;
  const invalid = Boolean(errorMessage);

  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex items-center gap-1.5">
        <div className="grid gap-1">
          <Label htmlFor={`${idPrefix}-hours`} className="sr-only">
            Hours
          </Label>
          <Input
            id={`${idPrefix}-hours`}
            type="number"
            inputMode="numeric"
            min={0}
            max={23}
            placeholder="H"
            className="h-11 w-14 text-center"
            aria-invalid={invalid}
            aria-describedby={describedBy}
            {...register(hoursName)}
          />
        </div>
        <span aria-hidden="true" className="text-muted-foreground">
          :
        </span>
        <div className="grid gap-1">
          <Label htmlFor={`${idPrefix}-minutes`} className="sr-only">
            Minutes
          </Label>
          <Input
            id={`${idPrefix}-minutes`}
            type="number"
            inputMode="numeric"
            min={0}
            max={59}
            placeholder="MM"
            className="h-11 w-14 text-center"
            aria-invalid={invalid}
            aria-describedby={describedBy}
            {...register(minutesName)}
          />
        </div>
        <span aria-hidden="true" className="text-muted-foreground">
          :
        </span>
        <div className="grid gap-1">
          <Label htmlFor={`${idPrefix}-seconds`} className="sr-only">
            Seconds
          </Label>
          <Input
            id={`${idPrefix}-seconds`}
            type="number"
            inputMode="numeric"
            min={0}
            max={59}
            placeholder="SS"
            className="h-11 w-14 text-center"
            aria-invalid={invalid}
            aria-describedby={describedBy}
            {...register(secondsName)}
          />
        </div>
      </div>
      {errorMessage ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
    </fieldset>
  );
}
