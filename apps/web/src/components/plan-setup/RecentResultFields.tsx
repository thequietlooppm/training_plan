import { RECENT_RESULT_DISTANCES, type RecentResultDistance } from "@training-plan/pace-zones";
import { Controller, type Control, type UseFormRegister } from "react-hook-form";
import { RECENT_RESULT_JUMP_TARGET_ID } from "@/components/PaceZoneTable";
import { TimeInputGroup } from "@/components/plan-setup/TimeInputGroup";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PlanSetupFormValues } from "@/lib/plan-setup-validation";

const DISTANCE_LABELS: Record<RecentResultDistance, string> = {
  "5k": "5K",
  "10k": "10K",
  "15k": "15K",
  "10_mile": "10 Mile",
  half: "Half",
  marathon: "Marathon",
};

/**
 * Recent race result section (design spec §5.1/§6.2). The distance
 * `Select`'s trigger id (`RECENT_RESULT_JUMP_TARGET_ID`) is exactly the DOM
 * contract `PaceZoneTable`'s blocked-equivalency-zone jump-links target —
 * see that component's header comment.
 */
export function RecentResultFields({
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
      <legend className="sr-only">Recent race result</legend>
      <div className="grid gap-2">
        <label htmlFor={RECENT_RESULT_JUMP_TARGET_ID} className="text-sm font-medium">
          Distance
        </label>
        <Controller
          control={control}
          name="recentResultDistance"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger
                id={RECENT_RESULT_JUMP_TARGET_ID}
                className="h-11 w-full"
                aria-invalid={!!distanceErrorMessage}
                aria-describedby={
                  distanceErrorMessage ? "recent-result-distance-error" : undefined
                }
              >
                <SelectValue placeholder="Select a distance" />
              </SelectTrigger>
              <SelectContent>
                {RECENT_RESULT_DISTANCES.map((distance) => (
                  <SelectItem key={distance} value={distance}>
                    {DISTANCE_LABELS[distance]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {distanceErrorMessage ? (
          <p
            id="recent-result-distance-error"
            role="alert"
            className="text-sm text-destructive"
          >
            {distanceErrorMessage}
          </p>
        ) : null}
      </div>
      <TimeInputGroup
        legend="Time"
        idPrefix="recent-result"
        hoursName="recentResultHours"
        minutesName="recentResultMinutes"
        secondsName="recentResultSeconds"
        register={register}
        errorMessage={timeErrorMessage}
      />
    </fieldset>
  );
}
