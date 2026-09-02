import { MotionConfig } from "motion/react";
import { useEffect } from "react";
import { Bench } from "../bench/Bench";
import { ProvenanceTimeline } from "../bench/ProvenanceTimeline";
import { TopRail } from "../bench/TopRail";
import { repairStore } from "../domain/repairStore";
import { useRepairStore } from "../domain/useRepairStore";
import { registerRepairTools, type ToolRegistrationHandle } from "../webmcp/registerTools";

export function App() {
  const announcement = useRepairStore((state) => state.announcement);

  useEffect(() => {
    let disposed = false;
    let handle: ToolRegistrationHandle | null = null;
    registerRepairTools(repairStore)
      .then((registration) => {
        if (disposed) return registration.dispose();
        handle = registration;
        return undefined;
      })
      .catch(() => repairStore.getState().setWebmcpAvailable(false));
    return () => {
      disposed = true;
      handle?.dispose().catch(() => repairStore.getState().setWebmcpAvailable(false));
    };
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <main className="app-shell">
        <a className="skip-link" href="#repair-context">
          Skip to repair instructions
        </a>
        <TopRail />
        <div id="repair-context">
          <Bench />
        </div>
        <ProvenanceTimeline />
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>
      </main>
    </MotionConfig>
  );
}
