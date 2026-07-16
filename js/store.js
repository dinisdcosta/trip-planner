import {getAll,put,get} from "./db.js";

const listeners=new Set();
const state={ready:false,trips:[],events:[],places:[],activeTripId:null,view:"home"};

function clone(){return structuredClone(state)}
function notify(){listeners.forEach(fn=>fn(clone()))}
export function subscribe(fn){listeners.add(fn);fn(clone());return()=>listeners.delete(fn)}

export async function hydrate(){
  const [trips,events,places]=await Promise.all([getAll("trips"),getAll("events"),getAll("places")]);
  state.trips=trips.filter(x=>!x.deletedAt);
  state.events=events.filter(x=>!x.deletedAt);
  state.places=places.filter(x=>!x.deletedAt);
  state.ready=true;
  notify();
}
function baseRecord(existing={}){
  const now=new Date().toISOString();
  return {...existing,updatedAt:now,createdAt:existing.createdAt||now,deletedAt:null,version:(existing.version||0)+1,syncState:"pending"};
}
export function setView(view){state.view=view;notify()}
export function openTrip(id){state.activeTripId=id;state.view="timeline";notify()}
export function closeTrip(){state.activeTripId=null;state.view="home";notify()}

export async function saveTrip(data){
  const rec=baseRecord({...data,id:data.id||crypto.randomUUID()});
  await put("trips",rec);
  const i=state.trips.findIndex(x=>x.id===rec.id);
  if(i>=0) state.trips[i]=rec; else state.trips.push(rec);
  notify();return rec;
}
export async function deleteTrip(id){
  const current=await get("trips",id); if(!current) return;
  const rec=baseRecord({...current,deletedAt:new Date().toISOString()});
  await put("trips",rec);
  state.trips=state.trips.filter(x=>x.id!==id);
  state.events=state.events.filter(x=>x.tripId!==id);
  if(state.activeTripId===id) closeTrip(); else notify();
}
export async function saveEvent(data){
  const rec=baseRecord({...data,id:data.id||crypto.randomUUID()});
  await put("events",rec);
  const i=state.events.findIndex(x=>x.id===rec.id);
  if(i>=0) state.events[i]=rec; else state.events.push(rec);
  notify();return rec;
}
export async function deleteEvent(id){
  const current=await get("events",id); if(!current) return;
  const rec=baseRecord({...current,deletedAt:new Date().toISOString()});
  await put("events",rec);
  state.events=state.events.filter(x=>x.id!==id);
  notify();
}
export function currentTrip(){return state.trips.find(x=>x.id===state.activeTripId)||null}
export function eventsForActiveTrip(){return state.events.filter(x=>x.tripId===state.activeTripId)}
