import { zodResolver } from "@hookform/resolvers/zod";
import { COMMITTED_PLAN_TEMPLATES } from "@training-plan/plan-templates";
import {
  calculate,
  type CalculatorInput,
  type PaceZones,
  type ValidationError,
} from "@training-plan/pace-zones";
import {
  createStoredPlanInstance,
  generatePlan,
  planWeekShape,
  validateRaceDate,
} from "@training-plan/plan-instance";
import { AlertTriangle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Controller,
  type FieldErrors,
  type Path,
  useForm,
  useWatch,
} from "react-hook-form";
import { PaceZoneTable, RECENT_RESULT_JUMP_TARGET_ID } from "@/components/PaceZoneTable";
import { GoalTimeFields } from "@/components/plan-setup/GoalTimeFields";
import { RaceDateField } from "@/components/plan-setup/RaceDateField";
import { RecentResultFields } from "@/components/plan-setup/RecentResultFields";
import { TemplatePicker } from "@/components/plan-setup/TemplatePicker";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import {
  buildCalculatorInput,
  mapCalculateError,
  planSetupFormSchema,
  type MappedCalculateError,
  type PlanSetupFormValues,
  PLAN_SETUP_DEFAULT_VALUES,
  todayLocalDateString,
} from "@/lib/plan-setup-validation";
import { formatDateLong, weekdayName } from "@/lib/plan-date-format";
import { usePlanLoad, useSavePlan } from "@/lib/use-plan";
import type { CalendarLocationState } from "@/pages/CalendarPage";

/**
 * What the pace table on screen was computed from. "Create my plan" uses
 * exactly this (frozen paces), and is disabled once the form drifts from
 * `valuesKey`.
 */
interface Calculated {
  zones: PaceZones;
  calculatorInput: CalculatorInput;
  valuesKey: string;
  raceDate: string;
  templateId: string;
}

const CREATE_PLAN_BUTTON_LABEL = "Create my plan";
const PLAN_SHAPE_ID = "plan-shape-line";
const STALE_HELPER_ID = "plan-stale-helper";

function joinWords(names: string[]): string {
  return names.length <= 2
    ? names.join(" and ")
    : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

interface SummaryError {
  message: string;
  onJump?: () => void;
}

function sectionElementId(section: "recentResult" | "goalTime"): string {
  return section === "recentResult" ? "recent-result-section" : "goal-time-section";
}

/**
 * `hoursField`/`minutesField`/`secondsField` (`plan-setup-validation.ts`) are
 * three independently-validated zod fields sharing one `TimeInputGroup` —
 * an invalid Minutes or Seconds value (e.g. `60`) produces an error on
 * `errors.<prefix>Minutes`/`errors.<prefix>Seconds`, not just
 * `errors.<prefix>Hours`. `TimeInputGroup` only renders a single
 * `errorMessage`, so this picks whichever of the three actually fired
 * first (Hours, then Minutes, then Seconds) rather than assuming it's
 * always Hours — surfacing at least one real error beats silently
 * dropping a Minutes/Seconds-only failure.
 */
function firstTimeFieldError(
  errors: FieldErrors<PlanSetupFormValues>,
  prefix: "recentResult" | "goalTime",
): string | undefined {
  if (prefix === "recentResult") {
    return (
      errors.recentResultHours?.message ??
      errors.recentResultMinutes?.message ??
      errors.recentResultSeconds?.message
    );
  }
  return (
    errors.goalTimeHours?.message ??
    errors.goalTimeMinutes?.message ??
    errors.goalTimeSeconds?.message
  );
}

/**
 * The plan-setup flow (#12): template → race date → recent result → goal
 * time → submit, one page, no wizard (design spec §3). Owns the RHF form,
 * calls `calculate()` (#11) on submit, and renders the #14 pace-zone table
 * below the form on success.
 */
export function PlanSetupPage() {
  const templates = COMMITTED_PLAN_TEMPLATES;

  const navigate = useNavigate();
  const planLoad = usePlanLoad();
  const savePlan = useSavePlan();

  const [zones, setZones] = useState<PaceZones | null>(null);
  const [calculated, setCalculated] = useState<Calculated | null>(null);
  const [creating, setCreating] = useState(false);
  const [createFailed, setCreateFailed] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const [sectionAlert, setSectionAlert] = useState<
    { section: "recentResult" | "goalTime"; message: string } | null
  >(null);
  const [summaryErrors, setSummaryErrors] = useState<SummaryError[] | null>(null);

  const summaryAlertRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const form = useForm<PlanSetupFormValues>({
    resolver: zodResolver(planSetupFormSchema),
    shouldFocusError: false,
    defaultValues: {
      templateId: templates[0]?.templateId ?? "",
      raceDate: "",
      ...PLAN_SETUP_DEFAULT_VALUES,
    },
  });

  const { errors } = form.formState;

  // Re-renders on every edit so the stale rule is always current.
  const watched = useWatch({ control: form.control });
  const stale = !calculated || JSON.stringify(watched) !== calculated.valuesKey;

  // The plan-shape line comes from the generated plan, never hard-coded
  // (spec B.5). Omitted when the race date is empty.
  const planShapeLine = useMemo(() => {
    if (!calculated || !calculated.raceDate) return null;
    const template = templates.find((t) => t.templateId === calculated.templateId);
    if (!template) return null;
    try {
      const shape = planWeekShape(generatePlan({ template, raceDate: calculated.raceDate }));
      const weeks = `Your plan weeks run ${weekdayName(shape.firstWeekday)} to ${weekdayName(shape.lastWeekday)} and end on race day.`;
      const longRuns = shape.longRunWeekdays.map((d) => `${weekdayName(d)}s`);
      return longRuns.length ? `${weeks} Long runs fall on ${joinWords(longRuns)}.` : weeks;
    } catch {
      return null;
    }
  }, [calculated, templates]);

  const existing = planLoad.data?.status === "ok" ? planLoad.data.value : null;

  // Focus the summary alert (not a field) once it appears — §8: "to a
  // summary Alert with tabindex="-1" ... when there are multiple [errors]."
  useEffect(() => {
    if (summaryErrors) {
      summaryAlertRef.current?.focus();
    }
  }, [summaryErrors]);

  // Smooth-scroll a successful result into view only if it isn't already
  // fully visible; instant jump under prefers-reduced-motion (§4/§8).
  useEffect(() => {
    if (!zones || !resultsRef.current) {
      return;
    }
    const rect = resultsRef.current.getBoundingClientRect();
    const fullyVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
    if (fullyVisible) {
      return;
    }
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    resultsRef.current.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
  }, [zones]);

  function focusMappedError(mapped: MappedCalculateError) {
    if (mapped.kind === "field") {
      form.setFocus(mapped.field);
    } else if (mapped.kind === "section") {
      document.getElementById(sectionElementId(mapped.section))?.focus();
    }
  }

  function applyCalculateErrors(calculateErrors: ValidationError[]) {
    if (calculateErrors.length > 1) {
      setSummaryErrors(
        calculateErrors.map((error) => {
          const mapped = mapCalculateError(error);
          return {
            message: error.message,
            onJump: () => focusMappedError(mapped),
          };
        }),
      );
      return;
    }

    const [error] = calculateErrors;
    if (!error) {
      return;
    }

    const mapped = mapCalculateError(error);
    if (mapped.kind === "field") {
      form.setError(mapped.field, { type: "manual", message: mapped.message });
      form.setFocus(mapped.field);
    } else if (mapped.kind === "section") {
      setSectionAlert({ section: mapped.section, message: mapped.message });
      document.getElementById(sectionElementId(mapped.section))?.focus();
    } else {
      // "Anything else" (§6.4) — no single field/section to attach to;
      // route through the same summary Alert used for multiple errors.
      setSummaryErrors([{ message: mapped.message }]);
    }
  }

  function onValid(values: PlanSetupFormValues) {
    setSummaryErrors(null);
    setSectionAlert(null);
    // Clear any manually-set field errors from a previous calculate()
    // failure — this submission's schema validation already passed, but a
    // stale `calculate()`-set error on an untouched field would otherwise
    // survive into this new attempt.
    form.clearErrors([
      "recentResultHours",
      "recentResultDistance",
      "goalTimeHours",
      "goalTimeDistance",
    ]);

    const input = buildCalculatorInput(values);
    const result = calculate(input);

    if (!result.ok) {
      applyCalculateErrors(result.errors);
      return;
    }

    setZones(result.zones);
    setCreateFailed(false);
    setCalculated({
      zones: result.zones,
      calculatorInput: input,
      valuesKey: JSON.stringify(form.getValues()),
      raceDate: values.raceDate,
      templateId: values.templateId,
    });
  }

  function failRaceDate(message: string) {
    form.setError("raceDate", { type: "manual", message });
    form.setFocus("raceDate");
  }

  function handleCreate() {
    if (!calculated || stale) {
      return;
    }
    setCreateFailed(false);
    if (!calculated.raceDate) {
      failRaceDate("Enter your race date to create a plan.");
      return;
    }
    const check = validateRaceDate(calculated.raceDate, todayLocalDateString());
    if (!check.ok) {
      failRaceDate(
        check.error.code === "in_past" ? "Race date can't be in the past." : check.error.message,
      );
      return;
    }
    if (existing) {
      setConfirmOpen(true);
      return;
    }
    void createPlan();
  }

  async function createPlan() {
    if (!calculated) {
      return;
    }
    const template = templates.find((t) => t.templateId === calculated.templateId);
    setCreating(true);
    setCreateFailed(false);
    try {
      if (!template) {
        throw new Error("template_not_found");
      }
      const stored = createStoredPlanInstance({
        id: crypto.randomUUID(),
        template,
        raceDate: calculated.raceDate,
        calculatorInput: calculated.calculatorInput,
        paceZones: calculated.zones,
        createdAt: new Date().toISOString(),
      });
      await savePlan.mutateAsync(stored);
      const state: CalendarLocationState = { focusHeading: true };
      navigate("/", { state });
    } catch {
      // Nothing is logged: the stored blob holds the runner's race inputs.
      setCreateFailed(true);
      setConfirmOpen(false);
    } finally {
      setCreating(false);
    }
  }

  function onInvalid(fieldErrors: FieldErrors<PlanSetupFormValues>) {
    setSectionAlert(null);
    // `root` (§4/§6.4/§8) is the "enter a recent race result or a goal time"
    // check — not attributable to any single field, so it always routes
    // through the summary Alert, even when it's the only error, with its
    // jump-link landing on Recent-result's Distance field (§8's explicit
    // note on this case, reusing §5.9's wireframe target).
    const { root, ...fieldOnlyErrors } = fieldErrors;
    const entries = Object.entries(fieldOnlyErrors) as [
      Path<PlanSetupFormValues>,
      { message?: string },
    ][];

    if (!root && entries.length <= 1) {
      setSummaryErrors(null);
      const [name] = entries[0] ?? [];
      if (name) {
        form.setFocus(name);
      }
      return;
    }

    const summaryList: SummaryError[] = entries.map(([name, fieldError]) => ({
      message: fieldError.message ?? "",
      onJump: () => form.setFocus(name),
    }));
    if (root?.message) {
      summaryList.push({
        message: root.message,
        onJump: () => document.getElementById(RECENT_RESULT_JUMP_TARGET_ID)?.focus(),
      });
    }
    setSummaryErrors(summaryList);
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-6">
      <h1 className="text-2xl font-bold">Set up your plan</h1>

      {summaryErrors ? (
        <div ref={summaryAlertRef} tabIndex={-1} className="mt-4 outline-none">
          <Alert variant="destructive" role="alert">
            <AlertTriangle aria-hidden="true" />
            <AlertTitle>Fix the following before continuing</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {summaryErrors.map((summaryError, index) => (
                  <li key={index}>
                    {summaryError.onJump ? (
                      <button
                        type="button"
                        className="underline underline-offset-2"
                        onClick={summaryError.onJump}
                      >
                        {summaryError.message}
                      </button>
                    ) : (
                      summaryError.message
                    )}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      <Form {...form}>
        {/*
          `noValidate` (§3 fix): the Hours/Minutes/Seconds `Input type="number"`
          fields carry native `min`/`max` attributes (0-23 / 0-59) for the
          numeric keypad + spinner affordance (§6.2) — without `noValidate`,
          an out-of-range value (e.g. Minutes = 60) fails the browser's own
          HTML5 constraint validation on submit, which silently blocks the
          native `submit` event entirely before it ever reaches
          `form.handleSubmit`/RHF/zod. That left the runner with either a
          non-standard native browser tooltip (inconsistent with this app's
          own error styling) or, on the browsers/setups where that tooltip
          doesn't fire reliably, no feedback at all — `errors.*` never
          populates because `onValid`/`onInvalid` never run. `noValidate`
          defers entirely to this form's own zod schema + RHF error display,
          which is the only validation UI the design spec calls for.
        */}
        <form
          noValidate
          onSubmit={form.handleSubmit(onValid, onInvalid)}
          className="mt-6 grid gap-6"
        >
          <Card>
            <CardHeader>
              <CardTitle>Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <fieldset>
                <legend className="sr-only">Plan</legend>
                <Controller
                  control={form.control}
                  name="templateId"
                  render={({ field }) => (
                    <TemplatePicker
                      templates={templates}
                      value={field.value}
                      onValueChange={field.onChange}
                    />
                  )}
                />
              </fieldset>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Race date</CardTitle>
              <CardDescription>
                The date of the race you&apos;re training for.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <fieldset>
                <legend className="sr-only">Race date</legend>
                <RaceDateField
                  register={form.register}
                  errorMessage={errors.raceDate?.message}
                />
              </fieldset>
            </CardContent>
          </Card>

          <Card id="recent-result-section" tabIndex={-1} className="outline-none">
            <CardHeader>
              <CardTitle>
                Recent race result{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </CardTitle>
              <CardDescription>
                Have a recent race time? Use it to derive your other training paces.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {sectionAlert?.section === "recentResult" ? (
                <Alert variant="destructive" role="alert">
                  <AlertTriangle aria-hidden="true" />
                  <AlertDescription>{sectionAlert.message}</AlertDescription>
                </Alert>
              ) : null}
              <RecentResultFields
                control={form.control}
                register={form.register}
                distanceErrorMessage={errors.recentResultDistance?.message}
                timeErrorMessage={firstTimeFieldError(errors, "recentResult")}
              />
            </CardContent>
          </Card>

          <Card id="goal-time-section" tabIndex={-1} className="outline-none">
            <CardHeader>
              <CardTitle>
                Goal time{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </CardTitle>
              <CardDescription>Have a target time for this race?</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {sectionAlert?.section === "goalTime" ? (
                <Alert variant="destructive" role="alert">
                  <AlertTriangle aria-hidden="true" />
                  <AlertDescription>{sectionAlert.message}</AlertDescription>
                </Alert>
              ) : null}
              <GoalTimeFields
                control={form.control}
                register={form.register}
                distanceErrorMessage={errors.goalTimeDistance?.message}
                timeErrorMessage={firstTimeFieldError(errors, "goalTime")}
              />
            </CardContent>
          </Card>

          <Button type="submit" className="h-11 w-full">
            Calculate my pace zones
          </Button>
        </form>
      </Form>

      {zones ? (
        <Card ref={resultsRef} className="mt-6">
          <CardHeader>
            <CardTitle>Your pace zones</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <PaceZoneTable zones={zones} />
            {planLoad.isError ? (
              <Alert variant="destructive" role="alert">
                <AlertTriangle aria-hidden="true" />
                <AlertDescription>
                  <p>Couldn&apos;t check for an existing plan. Try again.</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-2"
                    onClick={() => void planLoad.refetch()}
                  >
                    Try again
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}
            {createFailed ? (
              <Alert variant="destructive" role="alert">
                <AlertTriangle aria-hidden="true" />
                <AlertDescription>
                  Couldn&apos;t create your plan. Your entries are still here — try again.
                </AlertDescription>
              </Alert>
            ) : null}
            {planShapeLine ? (
              <p id={PLAN_SHAPE_ID} className="text-sm text-muted-foreground">
                {planShapeLine}
              </p>
            ) : null}
            <Button
              ref={createButtonRef}
              type="button"
              className="h-11 w-full"
              disabled={stale || planLoad.isPending || planLoad.isError || creating}
              aria-busy={creating}
              aria-describedby={
                [planShapeLine ? PLAN_SHAPE_ID : null, stale ? STALE_HELPER_ID : null]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
              onClick={handleCreate}
            >
              {creating ? "Creating your plan…" : CREATE_PLAN_BUTTON_LABEL}
            </Button>
            {stale ? (
              <p id={STALE_HELPER_ID} className="text-sm text-muted-foreground">
                Calculate again to use your changes.
              </p>
            ) : null}
            <p className="text-sm text-muted-foreground">
              Your plan is saved on this device only. Clearing your browser data removes it, and it
              won&apos;t appear on other devices.
            </p>
            <p role="status" className="sr-only">
              {creating ? "Creating your plan." : ""}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!creating) {
            setConfirmOpen(open);
          }
        }}
      >
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            createButtonRef.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Replace your current plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This replaces your plan for the race on{" "}
              {existing ? formatDateLong(existing.raceDate, todayLocalDateString()) : ""} with a new
              plan for{" "}
              {calculated?.raceDate
                ? formatDateLong(calculated.raceDate, todayLocalDateString())
                : ""}
              . This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={creating} className="h-11">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="h-11"
              disabled={creating}
              onClick={(event) => {
                // Keep the dialog open until the save settles.
                event.preventDefault();
                void createPlan();
              }}
            >
              {creating ? "Replacing…" : "Replace plan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
