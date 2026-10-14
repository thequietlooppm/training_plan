import { Activity } from "lucide-react";
import { Link } from "react-router-dom";

const NAV_LINK_CLASS = "text-sm font-medium underline-offset-4 hover:underline";

export function Header() {
  return (
    <header className="flex items-center gap-2 border-b px-6 py-4">
      <Activity aria-hidden="true" className="size-5" />
      <span className="text-sm font-semibold">training_plan</span>
      <nav aria-label="Main" className="ml-auto flex gap-4">
        <Link to="/" className={NAV_LINK_CLASS}>
          Plan
        </Link>
        <Link to="/setup" className={NAV_LINK_CLASS}>
          New plan
        </Link>
      </nav>
    </header>
  );
}
