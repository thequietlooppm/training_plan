import { Route, Routes } from "react-router-dom";
import { Header } from "@/components/Header";
import { CalendarRoute } from "@/pages/CalendarPage";
import { HealthPage } from "@/pages/HealthPage";
import { PlanSetupPage } from "@/pages/PlanSetupPage";

export function App() {
  return (
    <div className="flex min-h-svh flex-col">
      <Header />
      <Routes>
        <Route path="/" element={<CalendarRoute />} />
        <Route path="/day/:date" element={<CalendarRoute />} />
        <Route path="/setup" element={<PlanSetupPage />} />
        <Route path="/health" element={<HealthPage />} />
      </Routes>
    </div>
  );
}
