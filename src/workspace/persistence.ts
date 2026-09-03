import type { SelectedImage, WorkspaceState } from "./types";

const DATABASE_NAME = "repair-workspace";
const STORE_NAME = "workspace";
const RECORD_KEY = "current";

export interface PersistedWorkspaceRecord {
  version: 1;
  state: Omit<WorkspaceState, "hasHydrated" | "image" | "isBusy"> & {
    image: Omit<SelectedImage, "previewUrl"> | null;
    isBusy: false;
  };
}

export interface WorkspacePersistence {
  available: boolean;
  load(): Promise<PersistedWorkspaceRecord | null>;
  save(record: PersistedWorkspaceRecord): Promise<void>;
  clear(): Promise<void>;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function runTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    let result: T;
    request.onsuccess = () => {
      result = request.result;
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function validRecord(value: unknown): value is PersistedWorkspaceRecord {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { version?: unknown; state?: unknown };
  return candidate.version === 1 && Boolean(candidate.state) && typeof candidate.state === "object";
}

const available = typeof indexedDB !== "undefined";

export const browserWorkspacePersistence: WorkspacePersistence = {
  available,
  async load() {
    if (!available) return null;
    try {
      const record = await runTransaction("readonly", (store) => store.get(RECORD_KEY));
      return validRecord(record) ? record : null;
    } catch {
      return null;
    }
  },
  async save(record) {
    if (!available) return;
    try {
      await runTransaction("readwrite", (store) => store.put(record, RECORD_KEY));
    } catch {}
  },
  async clear() {
    if (!available) return;
    try {
      await runTransaction("readwrite", (store) => store.delete(RECORD_KEY));
    } catch {}
  },
};
