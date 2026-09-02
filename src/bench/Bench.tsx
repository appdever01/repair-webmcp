import { useReducedMotion } from "motion/react";
import { Component, lazy, type ReactNode, Suspense, useState } from "react";
import { RepairIcon } from "../design/RepairIcon";
import { useRepairStore } from "../domain/useRepairStore";
import { supportsWebGL } from "../scene/quality";
import { ComponentTree } from "./ComponentTree";
import { ContextPanel } from "./ContextPanel";

const RepairScene = lazy(() =>
  import("../scene/RepairScene").then((module) => ({ default: module.RepairScene })),
);

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? <LampFallback /> : this.props.children;
  }
}

function LampFallback() {
  return (
    <div className="lamp-fallback">
      <img
        src="/fallback-lamp.webp"
        alt="Aurelia S1 lamp intact on a dark workbench. Use the component list below to inspect every assembly."
      />
      <span>Static view · Semantic controls remain available</span>
    </div>
  );
}

export function Bench() {
  const focusedComponentId = useRepairStore((state) => state.focusedComponentId);
  const resetView = useRepairStore((state) => state.resetView);
  const reducedMotion = useReducedMotion() ?? false;
  const [webgl] = useState(supportsWebGL);

  return (
    <section className="bench" aria-label="Aurelia S1 interactive repair bench">
      <div className="scene-region">
        <div className="scene-canvas">
          {webgl ? (
            <SceneBoundary>
              <Suspense fallback={<div className="scene-loading">Preparing semantic assembly</div>}>
                <RepairScene reducedMotion={reducedMotion} />
              </Suspense>
            </SceneBoundary>
          ) : (
            <LampFallback />
          )}
        </div>
        <div className="scene-controls">
          <span>Drag to orbit · Scroll to zoom</span>
          <button type="button" onClick={resetView} disabled={!focusedComponentId}>
            <RepairIcon name="reset" /> Reset view
          </button>
        </div>
        <ComponentTree />
      </div>
      <ContextPanel />
    </section>
  );
}
