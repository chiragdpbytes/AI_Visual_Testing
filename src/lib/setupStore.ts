import { ComparisonSetup } from "../types";

export const IDB_NAME = "VeloceVisualQAStore";
export const IDB_VERSION = 2;
export const SETUPS_STORE = "comparisonSetups";
const RUNS_STORE = "runs"; // owned by PremiumDashboard history; created here too so either opener can upgrade

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RUNS_STORE)) {
        db.createObjectStore(RUNS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(SETUPS_STORE)) {
        db.createObjectStore(SETUPS_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(SETUPS_STORE, mode);
        const request = run(transaction.objectStore(SETUPS_STORE));
        transaction.oncomplete = () => resolve(request.result);
        transaction.onerror = () => reject(transaction.error);
      })
  );
}

export async function saveSetup(setup: ComparisonSetup): Promise<void> {
  await tx("readwrite", (store) => store.put(setup));
}

export async function getSetups(): Promise<ComparisonSetup[]> {
  const all = await tx<ComparisonSetup[]>("readonly", (store) => store.getAll() as IDBRequest<ComparisonSetup[]>);
  return (all || []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function markSynced(id: string, when: string): Promise<void> {
  const all = await getSetups();
  const target = all.find((s) => s.id === id);
  if (!target) return;
  await saveSetup({ ...target, lastSyncedAt: when });
}

export async function deleteSetup(id: string): Promise<void> {
  await tx("readwrite", (store) => store.delete(id));
}
