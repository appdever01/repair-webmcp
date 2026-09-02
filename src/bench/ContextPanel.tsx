import { motion } from "motion/react";
import { selectStage } from "../domain/selectors";
import { useRepairStore } from "../domain/useRepairStore";
import { CheckPanel, DiagnosePanel, InspectPanel } from "./CheckPanels";
import { IntakePanel } from "./IntakePanel";
import { ComparePanel, StagedPanel } from "./OutcomePanels";
import { RepairPanel, RestoredPanel, StoppedPanel, VerifyPanel } from "./RepairPanels";

function StageContent() {
  const stage = useRepairStore(selectStage);
  switch (stage) {
    case "intake":
      return <IntakePanel />;
    case "inspect":
      return <InspectPanel />;
    case "check":
      return <CheckPanel />;
    case "diagnose":
      return <DiagnosePanel />;
    case "compare":
      return <ComparePanel />;
    case "staged":
      return <StagedPanel />;
    case "approved":
    case "repair":
      return <RepairPanel />;
    case "verify":
      return <VerifyPanel />;
    case "restored":
      return <RestoredPanel />;
    case "stopped":
      return <StoppedPanel />;
  }
}

export function ContextPanel() {
  const stage = useRepairStore(selectStage);

  return (
    <aside className="context-panel" aria-label="Repair context">
      <motion.div
        key={stage}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <StageContent />
      </motion.div>
    </aside>
  );
}
