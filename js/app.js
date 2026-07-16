import {openDatabase} from "./db.js";
import {subscribe,hydrate,saveTrip,deleteTrip,saveEvent,deleteEvent,openTrip,closeTrip,setView,currentTrip,eventsForActiveTrip} from "./store.js";

const app=document.querySelector("#app");
let uiState=null;

const icons={flight:"✈️",hotel:"🏨",train:"🚆",bus:"🚌",restaurant:"🍴",activity:"🎫",place:"📍",note:"📝",other:"📌"};

function esc(v=""){return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function fmtDate(d){if(!d)return"Sem data";return new Intl.DateTimeFormat("pt-PT",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(d+"T12:00:00"))}
function fmtTime(t){return t||"Sem hora"}

function shell(content){
  const online=navigator.onLine;
  return `<div class="app-shell">
    <header class="topbar">
      <div class="brand"><small>Travel OS V2</small><h1>${uiState?.activeTripId?esc(currentTrip()?.name||"Viagem"):"Viagens"}</h1></div>
      <span class="status-pill">${online?"Online":"Offline — dados locais"}</span>
    </header>
    ${content}
  </div>`;
}

function renderHome(){
  const trips=uiState.trips;
  return shell(`
    <section class="card hero">
      <div><h2>Tudo o que importa, num só lugar</h2><p class="muted">Guarda reservas, transportes e locais sem transformar a viagem numa agenda rígida.</p></div>
      <button class="btn btn-primary" data-action="new-trip">Criar viagem</button>
    </section>
    <section class="card">
      <h2 style="font-family:Georgia,serif;font-weight:500">As tuas viagens</h2>
      <div class="list">
        ${trips.length?trips.map(t=>`<article class="trip-card">
          <div><h3>${esc(t.name)}</h3><p>${fmtDate(t.startDate)}${t.endDate?" — "+fmtDate(t.endDate):""}</p></div>
          <div class="actions">
            <button class="btn btn-primary btn-sm" data-action="open-trip" data-id="${t.id}">Abrir</button>
            <button class="btn btn-danger btn-sm" data-action="delete-trip" data-id="${t.id}">Apagar</button>
          </div>
        </article>`).join(""):`<div class="empty">Ainda não tens viagens. Cria a primeira.</div>`}
      </div>
    </section>`);
}

function renderTrip(){
  const trip=currentTrip();
  const events=eventsForActiveTrip().sort((a,b)=>`${a.date||"9999"} ${a.time||"99:99"}`.localeCompare(`${b.date||"9999"} ${b.time||"99:99"}`));
  const grouped={};
  for(const e of events){const key=e.date||"Sem data";(grouped[key]??=[]).push(e)}
  const tabs=["timeline","reservations","places"];
  return shell(`
    <div class="actions" style="margin-bottom:1rem">
      <button class="btn" data-action="back">← Viagens</button>
      <button class="btn btn-primary" data-action="new-event">Adicionar</button>
    </div>
    <section class="card">
      <div class="hero">
        <div><h2>${esc(trip.name)}</h2><p>${fmtDate(trip.startDate)}${trip.endDate?" — "+fmtDate(trip.endDate):""}</p></div>
        <span class="badge">${events.length} eventos</span>
      </div>
      <div class="nav">
        ${tabs.map(tab=>`<button class="btn ${uiState.view===tab?"active":""}" data-action="view" data-view="${tab}">${tab==="timeline"?"Roteiro":tab==="reservations"?"Reservas":"Locais"}</button>`).join("")}
      </div>
      ${uiState.view==="timeline"?renderTimeline(grouped):uiState.view==="reservations"?renderReservations(events):renderPlaces(events)}
    </section>
    <nav class="bottom-nav">
      ${tabs.map(tab=>`<button class="${uiState.view===tab?"active":""}" data-action="view" data-view="${tab}">${tab==="timeline"?"Hoje":tab==="reservations"?"Reservas":"Locais"}</button>`).join("")}
    </nav>`);
}

function eventCard(e){
  return `<article class="event-card">
    <div class="event-icon">${icons[e.type]||"📌"}</div>
    <div>
      <h3>${esc(e.title)}</h3>
      <div class="event-meta">${fmtTime(e.time)}${e.endTime?" → "+e.endTime:""}${e.location?" · "+esc(e.location):""}</div>
      ${e.reservationCode?`<p><span class="badge">Reserva ${esc(e.reservationCode)}</span></p>`:""}
      ${e.notes?`<p>${esc(e.notes)}</p>`:""}
    </div>
    <div class="event-actions">
      <button class="btn btn-sm" data-action="edit-event" data-id="${e.id}">Editar</button>
      <button class="btn btn-danger btn-sm" data-action="delete-event" data-id="${e.id}">Apagar</button>
    </div>
  </article>`;
}
function renderTimeline(grouped){
  const keys=Object.keys(grouped);
  if(!keys.length)return`<div class="empty">Ainda não existem eventos nesta viagem.</div>`;
  return keys.map(k=>`<section class="timeline-day"><h3>${k==="Sem data"?k:fmtDate(k)}</h3><div class="list">${grouped[k].map(eventCard).join("")}</div></section>`).join("");
}
function renderReservations(events){
  const list=events.filter(e=>e.reservationCode||["flight","hotel","train","bus"].includes(e.type));
  return list.length?`<div class="list">${list.map(eventCard).join("")}</div>`:`<div class="empty">Ainda não existem reservas.</div>`;
}
function renderPlaces(events){
  const places=events.filter(e=>e.location);
  return places.length?`<div class="list">${places.map(eventCard).join("")}</div>`:`<div class="empty">Ainda não existem locais associados.</div>`;
}

function showTripModal(trip={}){
  modal(`<div class="modal-header"><h2>${trip.id?"Editar":"Nova"} viagem</h2><button class="icon-btn" data-close>✕</button></div>
  <form id="tripForm" class="form-grid">
    <input type="hidden" name="id" value="${esc(trip.id||"")}">
    <div class="field full"><label>Nome</label><input name="name" required value="${esc(trip.name||"")}"></div>
    <div class="field"><label>Data de início</label><input type="date" name="startDate" value="${esc(trip.startDate||"")}"></div>
    <div class="field"><label>Data de fim</label><input type="date" name="endDate" value="${esc(trip.endDate||"")}"></div>
    <div class="field full"><label>Notas</label><textarea name="notes">${esc(trip.notes||"")}</textarea></div>
    <div class="actions full"><button class="btn btn-primary">Guardar</button><button type="button" class="btn" data-close>Cancelar</button></div>
  </form>`);
  document.querySelector("#tripForm").addEventListener("submit",async ev=>{
    ev.preventDefault();const data=Object.fromEntries(new FormData(ev.currentTarget));
    const saved=await saveTrip(data);closeModal();openTrip(saved.id);
  });
}

function showEventModal(event={}){
  modal(`<div class="modal-header"><h2>${event.id?"Editar":"Novo"} evento</h2><button class="icon-btn" data-close>✕</button></div>
  <form id="eventForm" class="form-grid">
    <input type="hidden" name="id" value="${esc(event.id||"")}">
    <input type="hidden" name="tripId" value="${esc(event.tripId||uiState.activeTripId)}">
    <div class="field"><label>Tipo</label><select name="type">
      ${Object.entries({flight:"Voo",hotel:"Hotel",train:"Comboio",bus:"Autocarro",restaurant:"Restaurante",activity:"Atividade",place:"Local",note:"Nota",other:"Outro"}).map(([v,l])=>`<option value="${v}" ${event.type===v?"selected":""}>${l}</option>`).join("")}
    </select></div>
    <div class="field"><label>Título</label><input name="title" required value="${esc(event.title||"")}"></div>
    <div class="field"><label>Data</label><input type="date" name="date" value="${esc(event.date||"")}"></div>
    <div class="field"><label>Hora</label><input type="time" name="time" value="${esc(event.time||"")}"></div>
    <div class="field"><label>Hora de fim</label><input type="time" name="endTime" value="${esc(event.endTime||"")}"></div>
    <div class="field"><label>Local</label><input name="location" placeholder="Hotel, aeroporto, morada..." value="${esc(event.location||"")}"></div>
    <div class="field"><label>Código de reserva</label><input name="reservationCode" value="${esc(event.reservationCode||"")}"></div>
    <div class="field full"><label>Notas</label><textarea name="notes">${esc(event.notes||"")}</textarea></div>
    <div class="actions full"><button class="btn btn-primary">Guardar</button><button type="button" class="btn" data-close>Cancelar</button></div>
  </form>`);
  document.querySelector("#eventForm").addEventListener("submit",async ev=>{
    ev.preventDefault();const data=Object.fromEntries(new FormData(ev.currentTarget));
    await saveEvent(data);closeModal();
  });
}

function modal(inner){
  const node=document.createElement("div");node.className="modal-backdrop";node.id="modal";node.innerHTML=`<div class="modal">${inner}</div>`;
  document.body.appendChild(node);
  node.addEventListener("click",e=>{if(e.target===node||e.target.closest("[data-close]"))closeModal()});
}
function closeModal(){document.querySelector("#modal")?.remove()}

function bind(){
  app.onclick=async e=>{
    const el=e.target.closest("[data-action]");if(!el)return;
    const a=el.dataset.action;
    if(a==="new-trip")showTripModal();
    if(a==="open-trip")openTrip(el.dataset.id);
    if(a==="delete-trip"&&confirm("Apagar esta viagem?"))await deleteTrip(el.dataset.id);
    if(a==="back")closeTrip();
    if(a==="new-event")showEventModal();
    if(a==="edit-event"){const ev=uiState.events.find(x=>x.id===el.dataset.id);showEventModal(ev)}
    if(a==="delete-event"&&confirm("Apagar este evento?"))await deleteEvent(el.dataset.id);
    if(a==="view")setView(el.dataset.view);
  };
}
function render(state){uiState=state;app.innerHTML=state.activeTripId?renderTrip():renderHome()}
window.addEventListener("online",()=>render(uiState));window.addEventListener("offline",()=>render(uiState));

async function init(){
  bind();subscribe(render);
  try{await openDatabase();await hydrate()}catch(err){console.error(err);app.innerHTML=shell(`<section class="card"><h2>Erro ao iniciar</h2><p>${esc(err.message)}</p></section>`)}
  if("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js").catch(console.error);
}
init();
