import { createRepairStore } from "./store";

export const repairStore = createRepairStore(
  import.meta.env.MODE === "test" ? { storage: null } : {},
);
