export const API = 'https://infoconso-gpsea.salamandre.tm.fr/API/public/v1/';
export const DAY = 86400000;
export function parisToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export const dateOf = value => new Date(value + 'T12:00:00Z');
export const iso = date => date.toISOString().slice(0,10);
export function addDays(value, n) { return iso(new Date(dateOf(value).getTime() + n * DAY)); }
export function monday(value) { const d = dateOf(value); return addDays(value, -((d.getUTCDay()+6)%7)); }
export const weekDays = value => Array.from({length:5},(_,i)=>addDays(monday(value),i));
export const formatDate = (value, options) => new Intl.DateTimeFormat('fr-FR', {...options,timeZone:'Europe/Paris'}).format(dateOf(value));
export function cleanText(value, labels = []) {
  let s = String(value ?? '');
  for (const label of labels) if(label.TagLbl) s = s.split(label.TagLbl).join(' ');
  return s.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
}
export function validateWeek(data) {
  if (!data || !Array.isArray(data.JoursSemaine) || !Array.isArray(data.MenuSemaine) || !Array.isArray(data.Labels)) throw new Error('Le format de la source a changé.');
  for (const row of [...data.JoursSemaine, ...data.MenuSemaine]) if (!/^\d{4}-\d{2}-\d{2}$/.test(row.DatPlaMen)) throw new Error('Une date de la source est invalide.');
  for (const row of data.MenuSemaine) if (typeof row.LibFit !== 'string' || !row.LibCatFit) throw new Error('Un plat de la source est incomplet.');
  return data;
}
export function dishesOn(data, date) {
  return data.MenuSemaine.filter(x=>x.DatPlaMen===date).sort((a,b)=>(Number(a.SourceOrder||0)-Number(b.SourceOrder||0)) || (Number(a.OreCatFit)-Number(b.OreCatFit)) || Number(a.PlaRem)-Number(b.PlaRem));
}
export function combineWeeks(sources, failures=[]) {
  if(!sources.length) throw new Error('Aucune source de repas disponible.');
  const unique=(items,key)=>[...new Map(items.map(x=>[x[key],x])).values()];
  const data={
    JoursSemaine:unique(sources.flatMap(x=>x.data.JoursSemaine),'DatPlaMen'),
    Labels:unique(sources.flatMap(x=>x.data.Labels),'TagLbl'),
    JoursFeries:unique(sources.flatMap(x=>x.data.JoursFeries||[]),'DatPde'),
    MenuSemaine:sources.flatMap((source,i)=>source.data.MenuSemaine.map(row=>({...row,SourceOrder:i,SourceName:source.name,SourceKind:source.kind})))
  };
  return {data,sources,failures,checkedAt:Math.min(...sources.map(x=>x.checkedAt)),cached:sources.some(x=>x.cached)};
}
export async function retrieveCalendar({meals,...options}) {
  const results=await Promise.allSettled(meals.map(async meal=>({...await retrieveWeek({...options,meal:String(meal.Men_id)}),name:meal.LibMen,kind:meal.LibMen==='Prestation simplifiée froide'?'cold':'lunch'})));
  if(options.signal?.aborted && options.signal.reason?.name!=='TimeoutError')throw options.signal.reason;
  return combineWeeks(results.filter(x=>x.status==='fulfilled').map(x=>x.value),results.flatMap((x,i)=>x.status==='rejected'?[meals[i].LibMen]:[]));
}
export function cacheKey(school, audience, meal, date) {return `atable:v1:week:${school}:${audience}:${meal}:${monday(date)}`;}
export async function fetchJson(path, {signal, fetcher=fetch}={}) {
  const response = await fetcher(API+path, {signal,cache:'no-store',credentials:'omit'});
  if (!response.ok) throw new Error(`La source répond HTTP ${response.status}.`);
  return response.json();
}
export async function retrieveWeek({school,audience,meal,date,storage,signal,fetcher}) {
  const key=cacheKey(school,audience,meal,date);
  try {
    const data=validateWeek(await fetchJson(`Semaine/${school}/${audience}/${meal}/${monday(date)}`,{signal,fetcher}));
    const entry={data,checkedAt:Date.now()};
    try {storage?.setItem(key,JSON.stringify(entry));} catch {}
    return {...entry,cached:false};
  } catch(error) {
    if (signal?.aborted && signal.reason?.name !== 'TimeoutError') throw error;
    try {
      const entry=JSON.parse(storage?.getItem(key) || 'null');
      if(entry && Number.isFinite(entry.checkedAt) && entry.checkedAt<=Date.now()+60000) return {data:validateWeek(entry.data),checkedAt:entry.checkedAt,cached:true,error:error.message};
    } catch {}
    throw error;
  }
}
