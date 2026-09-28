import { zodResolver } from "@hookform/resolvers/zod";
import { COMMITTED_PLAN_TEMPLATES } from "@training-plan/plan-templates";
import { calculate, type PaceZones, type ValidationError } from "@training-plan/pace-zones";
import { AlertTriangle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Controller,
  type FieldErrors,
  type Path,
  useForm,
} from "react-hook-form";
import { PaceZoneTable, RECENT_RESULT_JUMP_TARGET_ID } from "@/components/PaceZoneTable";
import { GoalTimeFields } from "@/components/plan-setup/GoalTimeFields";
import { RaceDateField } from "@/components/plan-setup/RaceDateField";
import { RecentResultFields } from "@/components/plan-setup/RecentResultFields";
import { TemplatePicker } from "@/components/plan-setup/TemplatePicker";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
} from "@/lib/plan-setup-validation";

interface SummaryError {
  message: string;
  onJump?: () => void;
}

function sectionElementId(section: "recentResult" | "goalTime"): string {
  return section === "recentResult" ? "recent-result-section" : "goal-time-section";
}

/**
 * The plan-setup flow (#12): template → race date → recent result → goal
 * time → submit, one page, no wizard (design spec §3). Owns the RHF form,
 * calls `calculate()` (#11) on submit, and renders the #14 pace-zone table
 * below the form on success.
 */
export function PlanSetupPage() {
  const templates = COMMITTED_PLAN_TEMPLATES;

  const [zones, setZones] = useState<PaceZones | null>(null);
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
      recentResultDistance: "",
      recentResultHours: "",
      recentResultMinutes: "",
      recentResultSeconds: "",
      goalTimeDistance: "",
      goalTimeHours: "",
      goalTimeMinutes: "",
      goalTimeSeconds: "",
    },
  });

  const { errors } = form.formState;

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
        <form
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
                timeErrorMessage={errors.recentResultHours?.message}
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
                timeErrorMessage={errors.goalTimeHours?.message}
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
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
