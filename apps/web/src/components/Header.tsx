import { Activity } from "lucide-react";
import { NavLink } from "react-router-dom";

const NAV_LINK_CLASS = "text-sm font-medium underline-offset-4 hover:underline";

export function Header() {
  return (
    <header className="flex items-center gap-2 border-b px-6 py-4">
      <Activity aria-hidden="true" className="size-5" />
      <span className="text-sm font-semibold">training_plan</span>
      <nav aria-label="Main" className="ml-auto flex gap-4">
        {/* `end` so "Plan" is not current on /setup or /day/:date. */}
        <NavLink to="/" end className={NAV_LINK_CLASS}>
          Plan
        </NavLink>
        <NavLink to="/paces" className={NAV_LINK_CLASS}>
          Pace zones
        </NavLink>
        <NavLink to="/setup" className={NAV_LINK_CLASS}>
          New plan
        </NavLink>
      </nav>
    </header>
  );
}
