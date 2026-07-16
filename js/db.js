const DB_NAME = "travel-os-v2";
const DB_VERSION = 1;

let dbPromise;

export function openDatabase() {
  if (!("indexedDB" in window)) {
    return Promise.reject(new Error("IndexedDB não está disponível neste navegador."));
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains("trips")) {
          const trips = db.createObjectStore("trips", { keyPath: "id" });
          trips.createIndex("updatedAt", "updatedAt");
          trips.createIndex("deletedAt", "deletedAt");
        }

        if (!db.objectStoreNames.contains("syncQueue")) {
          const queue = db.createObjectStore("syncQueue", { keyPath: "id" });
          queue.createIndex("createdAt", "createdAt");
        }

        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "key" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Falha ao abrir IndexedDB."));
      request.onblocked = () => reject(new Error("A base de dados está bloqueada por outro separador."));
    });
  }

  return dbPromise;
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error("Transação cancelada."));
  });
}

export async function putRecord(storeName, record) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).put(record);
  await transactionDone(tx);
  return record;
}

export async function getAllRecords(storeName) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, "readonly");
  const request = tx.objectStore(storeName).getAll();

  const result = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  await transactionDone(tx);
  return result;
}

export async function clearStore(storeName) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).clear();
  await transactionDone(tx);
}
