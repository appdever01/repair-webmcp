import { useSyncExternalStore } from "react";
import type { ModelContextEntryPoint } from "./modelContext";
import type {
  AgentActivityEvent,
  AgentActivityStore,
  AgentActivityStoreSnapshot,
  AgentConnectionState,
  ToolManifestItem,
} from "./types";

interface MutableAgentActivityStore extends AgentActivityStore {
  appendEvent(event: AgentActivityEvent): void;
  setRegistration(
    connectionState: AgentConnectionState,
    toolManifest: readonly ToolManifestItem[],
    lastRegistrationError: string | null,
  ): void;
  setEntryPoint(entryPoint: ModelContextEntryPoint | null): void;
}

const initialSnapshot: AgentActivityStoreSnapshot = {
  connectionState: "unsupported",
  entryPoint: null,
  registeredToolCount: 0,
  toolManifest: [],
  lastRegistrationError: null,
  events: [],
};

export function createAgentActivityStore(): AgentActivityStore {
  let snapshot = initialSnapshot;
  const listeners = new Set<() => void>();
  const publish = (next: AgentActivityStoreSnapshot) => {
    snapshot = next;
    for (const listener of listeners) {
      try {
        listener();
      } catch {}
    }
  };

  const store: MutableAgentActivityStore = {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    clearEvents() {
      if (snapshot.events.length === 0) return;
      publish({ ...snapshot, events: [] });
    },
    appendEvent(event) {
      publish({ ...snapshot, events: [...snapshot.events, event] });
    },
    setRegistration(connectionState, toolManifest, lastRegistrationError) {
      publish({
        ...snapshot,
        connectionState,
        registeredToolCount: toolManifest.length,
        toolManifest: [...toolManifest],
        lastRegistrationError,
      });
    },
    setEntryPoint(entryPoint) {
      if (snapshot.entryPoint === entryPoint) return;
      publish({ ...snapshot, entryPoint });
    },
  };
  return store;
}

export function useAgentActivityStore(store: AgentActivityStore): AgentActivityStoreSnapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}

export type { MutableAgentActivityStore };
