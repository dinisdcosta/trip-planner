import { openDatabase } from "./db.js";
import { subscribe, hydrateStore, createDemoTrip, clearDemoData } from "./store.js";

const ui = {
  connectionStatus: document.querySelector("#connectionStatus"),
  dbStatus: document.querySelector("#dbStatus"),
  swStatus: document.querySelector("#swStatus"),
  modeStatus: document.querySelector("#modeStatus"),
  tripList: document.querySelector("#tripList"),
  tripCount: document.querySelector("#tripCount"),
  createDemoTrip: document.querySelector("#createDemoTrip"),
  clearDemoData: document.querySelector("#clearDemoData")
};

function updateConnectionStatus() {
  const online = navigator.onLine;
  ui.connectionStatus.textContent = online ? "Online" : "Offline — dados locais ativos";
  ui.modeStatus.textContent = online ? "Online-first sync pendente" : "Offline";
}

function renderTrips(state) {
  ui.tripCount.textContent = String(state.trips.length);

  if (!state.trips.length) {
    ui.tripList.className = "empty-state";
    ui.tripList.textContent = state.ready
      ? "Ainda não existem viagens neste dispositivo."
      : "A carregar viagens locais…";
    return;
  }

  ui.tripList.className = "trip-list";
  ui.tripList.innerHTML = state.trips.map(trip => `
    <article class="trip-item">
      <div>
        <strong>${escapeHtml(trip.name)}</strong>
        <small>Início: ${escapeHtml(trip.startDate || "sem data")}</small>
      </div>
      <span class="status-pill">${trip.syncState === "pending" ? "Por sincronizar" : "Local"}</span>
    </article>
  `).join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    ui.swStatus.textContent = "Não suportado";
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register("./service-worker.js");
    ui.swStatus.textContent = registration.active ? "Ativo" : "Registado";
  } catch (error) {
    console.error(error);
    ui.swStatus.textContent = "Erro";
  }
}

async function init() {
  updateConnectionStatus();
  window.addEventListener("online", updateConnectionStatus);
  window.addEventListener("offline", updateConnectionStatus);

  subscribe(renderTrips);

  ui.createDemoTrip.addEventListener("click", async () => {
    ui.createDemoTrip.disabled = true;
    try {
      await createDemoTrip();
    } finally {
      ui.createDemoTrip.disabled = false;
    }
  });

  ui.clearDemoData.addEventListener("click", async () => {
    if (!confirm("Apagar os dados locais de teste?")) return;
    await clearDemoData();
  });

  try {
    await openDatabase();
    ui.dbStatus.textContent = "IndexedDB ativa";
    await hydrateStore();
  } catch (error) {
    console.error(error);
    ui.dbStatus.textContent = "Erro";
  }

  await registerServiceWorker();
}

init();
