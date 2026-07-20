// --- IndexedDB for Visual QA history runs to prevent localStorage QuotaExceededError ---
export const IDB_NAME = "VeloceVisualQAStore";
export const IDB_VERSION = 2;
export const STORE_NAME = "runs";

export const getIDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("comparisonSetups")) {
        db.createObjectStore("comparisonSetups", { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveRunToIDB = async (run: any): Promise<void> => {
  try {
    const db = await getIDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(run);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("Failed to save run to IndexedDB", err);
  }
};

export const getRunsFromIDB = async (): Promise<any[]> => {
  try {
    const db = await getIDB();
    return new Promise<any[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Failed to get runs from IndexedDB", err);
    return [];
  }
};

export const deleteRunFromIDB = async (id: string): Promise<void> => {
  try {
    const db = await getIDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("Failed to delete run from IndexedDB", err);
  }
};

export const clearIDB = async (): Promise<void> => {
  try {
    const db = await getIDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error("Failed to clear IndexedDB", err);
  }
};
