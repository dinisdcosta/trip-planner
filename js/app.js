import {openDatabase} from "./db.js";
import {
  subscribe,hydrate,saveTrip,deleteTrip,saveEvent,deleteEvent,savePlace,deletePlace,
  openTrip,closeTrip,setView,currentTrip,eventsForActiveTrip,placesForActiveTrip
} from "./store.js";

const app=document.querySelector("#app");
let uiState=null;
let mapInstance=null;
let mapMarkers=[];

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
    <section class="hero">
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
  const html=shell(`
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
        ${tabs.map(tab=>`<button class="btn ${uiState.view===tab?"active":""}" data-action="view" data-view="${tab}">${tab==="timeline"?"Roteiro":tab==="reservations"?"Reservas":"Locais & mapa"}</button>`).join("")}
      </div>
      ${uiState.view==="timeline"?renderTimeline(grouped):uiState.view==="reservations"?renderReservations(events):renderPlaces()}
    </section>
    <nav class="bottom-nav">
      ${tabs.map(tab=>`<button class="${uiState.view===tab?"active":""}" data-action="view" data-view="${tab}">${tab==="timeline"?"Roteiro":tab==="reservations"?"Reservas":"Mapa"}</button>`).join("")}
    </nav>`);
  return html;
}

function eventCard(e){
  const place=uiState.places.find(p=>p.id===e.placeId);
  const loc=place?.name||e.location||"";
  return `<article class="event-card">
    <div class="event-icon">${icons[e.type]||"📌"}</div>
    <div>
      <h3>${esc(e.title)}</h3>
      <div class="event-meta">${fmtTime(e.time)}${e.endTime?" → "+e.endTime:""}${loc?" · "+esc(loc):""}</div>
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
function renderPlaces(){
  const places=placesForActiveTrip();
  return `<div class="map-layout">
    <div>
      <div class="place-search">
        <div class="search-row">
          <input id="placeSearchInput" placeholder="Hotel, restaurante, aeroporto ou morada">
          <button class="btn btn-primary" data-action="search-place">Procurar</button>
        </div>
        <div class="inline-note">A pesquisa usa OpenStreetMap e necessita de internet. Os locais guardados continuam disponíveis offline.</div>
        <div id="placeSearchResults" class="search-results"></div>
      </div>
      <div class="actions" style="margin-bottom:.7rem">
        <button class="btn" data-action="manual-place">Adicionar manualmente</button>
      </div>
      <div>
        ${places.length?places.map(place=>`<article class="place-card">
          <div>
            <h3>${esc(place.name)}</h3>
            <p>${esc(place.address||"Sem morada")}</p>
          </div>
          <div class="actions">
            <button class="btn btn-sm" data-action="focus-place" data-id="${place.id}">Ver</button>
            <button class="btn btn-danger btn-sm" data-action="delete-place" data-id="${place.id}">Apagar</button>
          </div>
        </article>`).join(""):`<div class="empty">Ainda não existem locais guardados.</div>`}
      </div>
    </div>
    <div class="map-panel">
      <div id="tripMap"></div>
      <div id="mapFallback" class="map-offline" hidden>
        <div><strong>Mapa indisponível offline</strong><p>Os nomes e moradas dos locais continuam guardados neste dispositivo.</p></div>
      </div>
    </div>
  </div>`;
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
  const places=placesForActiveTrip();
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
    <div class="field"><label>Local guardado</label><select name="placeId">
      <option value="">Sem local associado</option>
      ${places.map(p=>`<option value="${p.id}" ${event.placeId===p.id?"selected":""}>${esc(p.name)}</option>`).join("")}
    </select></div>
    <div class="field"><label>Local em texto</label><input name="location" placeholder="Opcional, caso ainda não esteja no mapa" value="${esc(event.location||"")}"></div>
    <div class="field"><label>Código de reserva</label><input name="reservationCode" value="${esc(event.reservationCode||"")}"></div>
    <div class="field full"><label>Notas</label><textarea name="notes">${esc(event.notes||"")}</textarea></div>
    <div class="actions full"><button class="btn btn-primary">Guardar</button><button type="button" class="btn" data-close>Cancelar</button></div>
  </form>`);
  document.querySelector("#eventForm").addEventListener("submit",async ev=>{
    ev.preventDefault();const data=Object.fromEntries(new FormData(ev.currentTarget));
    await saveEvent(data);closeModal();
  });
}

function showPlaceModal(place={}){
  modal(`<div class="modal-header"><h2>${place.id?"Editar":"Adicionar"} local</h2><button class="icon-btn" data-close>✕</button></div>
  <form id="placeForm" class="form-grid">
    <input type="hidden" name="id" value="${esc(place.id||"")}">
    <input type="hidden" name="tripId" value="${esc(place.tripId||uiState.activeTripId)}">
    <div class="field full"><label>Nome</label><input name="name" required value="${esc(place.name||"")}"></div>
    <div class="field full"><label>Morada</label><input name="address" value="${esc(place.address||"")}"></div>
    <div class="field"><label>Latitude</label><input type="number" step="any" name="lat" value="${esc(place.lat||"")}"></div>
    <div class="field"><label>Longitude</label><input type="number" step="any" name="lon" value="${esc(place.lon||"")}"></div>
    <div class="field full"><label>Notas</label><textarea name="notes">${esc(place.notes||"")}</textarea></div>
    <div class="actions full"><button class="btn btn-primary">Guardar</button><button type="button" class="btn" data-close>Cancelar</button></div>
  </form>`);
  document.querySelector("#placeForm").addEventListener("submit",async ev=>{
    ev.preventDefault();const data=Object.fromEntries(new FormData(ev.currentTarget));
    data.lat=data.lat?Number(data.lat):null; data.lon=data.lon?Number(data.lon):null;
    await savePlace(data);closeModal();
  });
}

async function searchPlaces(){
  const input=document.querySelector("#placeSearchInput");
  const box=document.querySelector("#placeSearchResults");
  const query=input?.value.trim();
  if(!query)return;
  if(!navigator.onLine){box.innerHTML=`<div class="empty">Sem internet. Podes adicionar o local manualmente.</div>`;return;}
  box.innerHTML=`<div class="muted">A procurar…</div>`;
  try{
    const url=`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&addressdetails=1&q=${encodeURIComponent(query)}`;
    const res=await fetch(url,{headers:{"Accept":"application/json","Accept-Language":"pt"}});
    if(!res.ok)throw new Error("Pesquisa indisponível.");
    const rows=await res.json();
    box.innerHTML=rows.length?rows.map((r,i)=>`<button class="search-result" data-action="choose-search-result" data-index="${i}">
      <strong>${esc(r.name||r.display_name.split(",")[0])}</strong>
      <small>${esc(r.display_name)}</small>
    </button>`).join(""):`<div class="empty">Não foram encontrados resultados.</div>`;
    box._rows=rows;
  }catch(err){
    box.innerHTML=`<div class="empty">${esc(err.message)} Podes adicionar manualmente.</div>`;
  }
}

async function chooseSearchResult(index){
  const box=document.querySelector("#placeSearchResults");
  const row=box?._rows?.[Number(index)];
  if(!row)return;
  await savePlace({
    tripId:uiState.activeTripId,
    name:row.name||row.display_name.split(",")[0],
    address:row.display_name,
    lat:Number(row.lat),
    lon:Number(row.lon),
    source:"nominatim"
  });
}

function initMap(){
  if(uiState.view!=="places"||!uiState.activeTripId)return;
  const mapEl=document.querySelector("#tripMap");
  const fallback=document.querySelector("#mapFallback");
  if(!mapEl)return;
  if(!navigator.onLine||!window.L){
    mapEl.hidden=true;fallback.hidden=false;return;
  }
  fallback.hidden=true;mapEl.hidden=false;
  if(mapInstance){mapInstance.remove();mapInstance=null}
  mapInstance=L.map(mapEl,{zoomControl:true}).setView([38.7,-9.1],3);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
    maxZoom:19,
    attribution:'&copy; OpenStreetMap contributors'
  }).addTo(mapInstance);
  mapMarkers=[];
  const places=placesForActiveTrip().filter(p=>Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon)));
  const bounds=[];
  for(const p of places){
    const marker=L.marker([Number(p.lat),Number(p.lon)]).addTo(mapInstance).bindPopup(`<strong>${esc(p.name)}</strong><br>${esc(p.address||"")}`);
    marker._placeId=p.id;mapMarkers.push(marker);bounds.push([Number(p.lat),Number(p.lon)]);
  }
  if(bounds.length===1)mapInstance.setView(bounds[0],14);
  if(bounds.length>1)mapInstance.fitBounds(bounds,{padding:[30,30]});
  setTimeout(()=>mapInstance?.invalidateSize(),80);
}

function focusPlace(id){
  const place=uiState.places.find(p=>p.id===id);
  if(!place||!mapInstance||!place.lat||!place.lon)return;
  mapInstance.setView([Number(place.lat),Number(place.lon)],15);
  const marker=mapMarkers.find(m=>m._placeId===id);
  marker?.openPopup();
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
    if(a==="search-place")await searchPlaces();
    if(a==="choose-search-result")await chooseSearchResult(el.dataset.index);
    if(a==="manual-place")showPlaceModal();
    if(a==="delete-place"&&confirm("Apagar este local?"))await deletePlace(el.dataset.id);
    if(a==="focus-place")focusPlace(el.dataset.id);
  };
}
function render(state){
  uiState=state;
  app.innerHTML=state.activeTripId?renderTrip():renderHome();
  if(state.activeTripId&&state.view==="places")requestAnimationFrame(initMap);
}
window.addEventListener("online",()=>render(uiState));
window.addEventListener("offline",()=>render(uiState));

async function init(){
  bind();subscribe(render);
  try{await openDatabase();await hydrate()}catch(err){console.error(err);app.innerHTML=shell(`<section class="card"><h2>Erro ao iniciar</h2><p>${esc(err.message)}</p></section>`)}
  if("serviceWorker" in navigator)navigator.serviceWorker.register("./service-worker.js").catch(console.error);
}
init();
