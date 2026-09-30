import { Activity } from "lucide-react";
import { Link } from "react-router-dom";

export function Header() {
  return (
    <header className="flex items-center gap-2 border-b px-6 py-4">
      <Activity aria-hidden="true" className="size-5" />
      <span className="text-sm font-semibold">training_plan</span>
      <nav className="ml-auto">
        <Link to="/setup" className="text-sm font-medium underline-offset-4 hover:underline">
          Set up a plan
        </Link>
      </nav>
    </header>
  );
}
