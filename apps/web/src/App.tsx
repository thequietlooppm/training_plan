import { Route, Routes } from "react-router-dom";
import { Header } from "@/components/Header";
import { HomePage } from "@/pages/HomePage";
import { PlanSetupPage } from "@/pages/PlanSetupPage";

export function App() {
  return (
    <div className="flex min-h-svh flex-col">
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/setup" element={<PlanSetupPage />} />
      </Routes>
    </div>
  );
}
