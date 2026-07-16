import { getAllRecords, putRecord, clearStore } from "./db.js";

const listeners = new Set();

const state = {
  trips: [],
  ready: false
};

function notify() {
  for (const listener of listeners) listener(structuredClone(state));
}

export function subscribe(listener) {
  listeners.add(listener);
  listener(structuredClone(state));
  return () => listeners.delete(listener);
}

export async function hydrateStore() {
  const trips = await getAllRecords("trips");
  state.trips = trips.filter(trip => !trip.deletedAt);
  state.ready = true;
  notify();
}

export async function createDemoTrip() {
  const now = new Date().toISOString();
  const trip = {
    id: crypto.randomUUID(),
    name: "Viagem de teste",
    startDate: new Date().toISOString().slice(0, 10),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    version: 1,
    syncState: "pending"
  };

  await putRecord("trips", trip);
  state.trips = [...state.trips, trip];
  notify();
  return trip;
}

export async function clearDemoData() {
  await clearStore("trips");
  await clearStore("syncQueue");
  state.trips = [];
  notify();
}
