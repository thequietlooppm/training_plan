import type { PlanTemplate, RaceDistanceType } from "@training-plan/plan-templates";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const RACE_DISTANCE_LABELS: Record<RaceDistanceType, string> = {
  marathon: "Marathon",
  ten_mile: "10 Mile",
};

/**
 * Template radio-card list (design spec §5.1/§6.2/§7.3). Built on the
 * library `RadioGroup` (keyboard/roving-tabindex behavior is the
 * primitive); the "looks like a card, shows title + distance + weeks"
 * layout inside each item is bespoke. Designed for an arbitrary-length
 * list — today it renders with exactly one option (#10, the MCR template,
 * hasn't shipped yet).
 */
export function TemplatePicker({
  templates,
  value,
  onValueChange,
}: {
  templates: PlanTemplate[];
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <RadioGroup value={value} onValueChange={onValueChange} className="gap-3">
      {templates.map((template) => {
        const inputId = `template-${template.templateId}`;
        return (
          <label
            key={template.templateId}
            htmlFor={inputId}
            className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-4 [&:has([data-state=checked])]:border-primary"
          >
            <RadioGroupItem id={inputId} value={template.templateId} className="mt-1" />
            <div className="grid gap-1">
              <span className="font-medium">{template.title}</span>
              <Badge variant="secondary" className="w-fit">
                {RACE_DISTANCE_LABELS[template.raceDistanceType]} · {template.totalWeeks} weeks
              </Badge>
            </div>
          </label>
        );
      })}
    </RadioGroup>
  );
}
