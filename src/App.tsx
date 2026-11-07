import { Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Auth from "@/pages/Auth";
import Data from "@/pages/Data";
import Home from "@/pages/Home";
import Settings from "@/pages/Settings";
import Timeline from "@/pages/Timeline";

export default function App() {
  return (
    <div className="hud-grid-bg min-h-svh bg-[#030712] text-slate-200">
      <div
        className="hud-scanlines pointer-events-none fixed inset-0 z-[60] opacity-15"
        aria-hidden="true"
      />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/dados" element={<Data />} />
        <Route path="/timeline" element={<Timeline />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
      <Toaster />
    </div>
  );
}