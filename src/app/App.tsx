import { MotionConfig } from "motion/react";
import { useEffect, useState } from "react";
import { createAgentRuntime } from "../agent-runtime";
import { ActivityDock } from "../bench/ActivityDock";
import { Bench } from "../bench/Bench";
import { createWorkspaceController, useWorkspaceStore, workspaceStore } from "../workspace";

const workspaceController = createWorkspaceController(workspaceStore);

export function App() {
  const announcement = useWorkspaceStore((state) => state.announcement);
  const hasHydrated = useWorkspaceStore((state) => state.hasHydrated);
  const [runtime] = useState(() => createAgentRuntime(workspaceController));

  useEffect(() => {
    void workspaceStore.getState().hydrateWorkspace();
    void runtime.ready;
    return () => {
      void runtime.dispose();
      workspaceStore.getState().dispose();
    };
  }, [runtime]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell">
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <main id="main-content">
          {hasHydrated ? (
            <Bench />
          ) : (
            <div className="workspace-restore" role="status" aria-label="Restoring your repair">
              <span className="loading-spinner" aria-hidden="true" />
            </div>
          )}
        </main>
        <ActivityDock runtime={runtime} />
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>
      </div>
    </MotionConfig>
  );
}
