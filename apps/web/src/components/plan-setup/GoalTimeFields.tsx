import { GOAL_DISTANCES, type GoalDistance } from "@training-plan/pace-zones";
import { Controller, type Control, type UseFormRegister } from "react-hook-form";
import { GOAL_TIME_JUMP_TARGET_ID } from "@/components/PaceZoneTable";
import { TimeInputGroup } from "@/components/plan-setup/TimeInputGroup";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { PlanSetupFormValues } from "@/lib/plan-setup-validation";

const GOAL_DISTANCE_LABELS: Record<GoalDistance, string> = {
  half: "Half",
  marathon: "Marathon",
};

/**
 * Goal time section (design spec §5.1/§6.2). A 2-segment toggle, not a
 * `Select` — two options read better as a segmented control than a
 * dropdown; reuses the `RadioGroup` primitive with different CSS from the
 * template picker, no new dependency. The first option's ("Half") id
 * (`GOAL_TIME_JUMP_TARGET_ID`) is exactly the DOM contract
 * `PaceZoneTable`'s unset-goal-zone jump-link targets.
 */
export function GoalTimeFields({
  control,
  register,
  distanceErrorMessage,
  timeErrorMessage,
}: {
  control: Control<PlanSetupFormValues>;
  register: UseFormRegister<PlanSetupFormValues>;
  distanceErrorMessage?: string;
  timeErrorMessage?: string;
}) {
  return (
    <fieldset className="grid gap-4">
      <legend className="sr-only">Goal time</legend>
      <div className="grid gap-2">
        <span className="text-sm font-medium">Distance</span>
        <Controller
          control={control}
          name="goalTimeDistance"
          render={({ field }) => (
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              className="flex flex-row gap-2"
              aria-describedby={
                distanceErrorMessage ? "goal-time-distance-error" : undefined
              }
              aria-invalid={!!distanceErrorMessage}
            >
              {GOAL_DISTANCES.map((distance, index) => {
                const inputId =
                  index === 0 ? GOAL_TIME_JUMP_TARGET_ID : `goal-time-distance-${distance}`;
                return (
                  <label
                    key={distance}
                    htmlFor={inputId}
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 [&:has([data-state=checked])]:border-primary"
                  >
                    <RadioGroupItem id={inputId} value={distance} />
                    {GOAL_DISTANCE_LABELS[distance]}
                  </label>
                );
              })}
            </RadioGroup>
          )}
        />
        {distanceErrorMessage ? (
          <p id="goal-time-distance-error" role="alert" className="text-sm text-destructive">
            {distanceErrorMessage}
          </p>
        ) : null}
      </div>
      <TimeInputGroup
        legend="Time"
        idPrefix="goal-time"
        hoursName="goalTimeHours"
        minutesName="goalTimeMinutes"
        secondsName="goalTimeSeconds"
        register={register}
        errorMessage={timeErrorMessage}
      />
    </fieldset>
  );
}
