import { useWorkspaceStore } from "../workspace";
import { IntakePanel } from "./IntakePanel";
import { RepairWorkspace } from "./RepairWorkspace";

export function Bench() {
  const analysis = useWorkspaceStore((state) => state.analysis);

  return analysis ? <RepairWorkspace /> : <IntakePanel />;
}
