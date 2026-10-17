import type { FocusEvent } from "react";
import type { FieldValues, Path, UseFormRegister } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { padTwoDigits } from "@/lib/plan-setup-format";

/**
 * Three separate numeric text fields (Hours / Minutes / Seconds) --
 * `type="text" inputMode="numeric"`, not `type="number"`, because the native
 * spinner chrome clipped "MM"/"SS" inside a narrow box (#65). Separate
 * fields over a single free-text "H:MM:SS" field avoid parse ambiguity, map
 * directly to `hours*3600 + minutes*60 + seconds`, get per-field range
 * checks and a numeric keypad on mobile. See design spec §6.2 "Time entry:
 * recommendation" for the full trade-off.
 *
 * Used by both `RecentResultFields` and `GoalTimeFields`. Not a shadcn
 * primitive — a custom composite assembled from `Input` + `Label` inside a
 * `fieldset`, per design spec §6.2/§8.
 *
 * The placeholders ("H" / "MM" / "SS") vanish once digits are typed, so
 * each box also carries a small visible caption ("h" / "min" / "s"),
 * `aria-hidden` because each input already gets a real,
 * individually-announced `sr-only` `<Label>` ("Hours" / "Minutes" /
 * "Seconds") — screen-reader users get the full word, sighted users get the
 * compact cue (§8). The row wraps (`flex-wrap`) so it never clips at 320px
 * or 200% zoom.
 */
const FIELD_CLASS = "h-11 w-14 px-2 text-center tabular-nums";

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

  const fields = [
    { key: "hours", label: "Hours", caption: "h", placeholder: "H", name: hoursName, pad: false },
    {
      key: "minutes",
      label: "Minutes",
      caption: "min",
      placeholder: "MM",
      name: minutesName,
      pad: true,
    },
    {
      key: "seconds",
      label: "Seconds",
      caption: "s",
      placeholder: "SS",
      name: secondsName,
      pad: true,
    },
  ] as const;

  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap items-end gap-2">
        {fields.map((field, index) => {
          const { onBlur, ...rest } = register(field.name);
          const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
            if (field.pad) {
              event.currentTarget.value = padTwoDigits(event.currentTarget.value);
            }
            // RHF's blur handler reads the field's current value, so the
            // padded "05" reaches form state too, not just the screen.
            return onBlur(event);
          };
          return (
            <div key={field.key} className="flex items-end gap-2">
              {index > 0 ? (
                <span aria-hidden="true" className="pb-7 text-muted-foreground">
                  :
                </span>
              ) : null}
              <div className="grid gap-1">
                <Label htmlFor={`${idPrefix}-${field.key}`} className="sr-only">
                  {field.label}
                </Label>
                <Input
                  id={`${idPrefix}-${field.key}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={2}
                  autoComplete="off"
                  placeholder={field.placeholder}
                  className={FIELD_CLASS}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  onBlur={handleBlur}
                  {...rest}
                />
                <span aria-hidden="true" className="text-center text-xs text-muted-foreground">
                  {field.caption}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {errorMessage ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
    </fieldset>
  );
}
