const DB_NAME="travel-os-v2";
const DB_VERSION=2;
let dbPromise;

export function openDatabase(){
  if(!("indexedDB" in window)) return Promise.reject(new Error("IndexedDB indisponível."));
  if(!dbPromise){
    dbPromise=new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        const ensure=(name,keyPath="id")=>{
          if(!db.objectStoreNames.contains(name)) db.createObjectStore(name,{keyPath});
        };
        ensure("trips");
        ensure("events");
        ensure("places");
        ensure("settings","key");
        ensure("syncQueue");
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
      req.onblocked=()=>reject(new Error("Base de dados bloqueada."));
    });
  }
  return dbPromise;
}

function txDone(tx){return new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}

export async function put(store,record){
  const db=await openDatabase();
  const tx=db.transaction(store,"readwrite");
  tx.objectStore(store).put(record);
  await txDone(tx);
  return record;
}
export async function getAll(store){
  const db=await openDatabase();
  const tx=db.transaction(store,"readonly");
  const req=tx.objectStore(store).getAll();
  const rows=await new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  await txDone(tx);
  return rows;
}
export async function get(store,id){
  const db=await openDatabase();
  const tx=db.transaction(store,"readonly");
  const req=tx.objectStore(store).get(id);
  const row=await new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  await txDone(tx);
  return row;
}
export async function remove(store,id){
  const db=await openDatabase();
  const tx=db.transaction(store,"readwrite");
  tx.objectStore(store).delete(id);
  await txDone(tx);
}
