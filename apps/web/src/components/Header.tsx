import { Activity } from "lucide-react";

export function Header() {
  return (
    <header className="flex items-center gap-2 border-b px-6 py-4">
      <Activity aria-hidden="true" className="size-5" />
      <span className="text-sm font-semibold">training_plan</span>
    </header>
  );
}
