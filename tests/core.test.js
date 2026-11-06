import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {monday,weekDays,parisToday,cleanText,dishesOn,retrieveWeek,cacheKey,combineWeeks,retrieveCalendar} from '../core.js';
const fixture=JSON.parse(await readFile(new URL('./fixtures/official-week.json',import.meta.url)));
const cold=JSON.parse(await readFile(new URL('./fixtures/official-cold.json',import.meta.url)));
const options={school:'72',audience:'2',meal:'2',date:'2026-11-06'};
const memory=()=>{const map=new Map();return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)};};
test('calendar handles year boundaries, weekends and the Paris day',()=>{
  assert.equal(monday('2027-01-01'),'2026-12-28');
  assert.deepEqual(weekDays('2026-11-08'),['2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06']);
  assert.equal(parisToday(new Date('2026-11-06T23:30:00Z')),'2026-11-07');
});
test('real source dishes retain alternatives and absent days remain empty',()=>{
  assert.equal(dishesOn(fixture,'2026-11-05').length,0);
  const friday=dishesOn(fixture,'2026-11-06');
  assert.ok(friday.some(x=>x.LibFit.includes('Pilons de poulet')));
  assert.ok(friday.some(x=>x.LibFit.includes('Filet de hoki')&&x.PlaRem===1));
  assert.equal(cleanText('Salade chou rouge<BIO>emmental<BIO>et vinaigrette',fixture.Labels),'Salade chou rouge emmental et vinaigrette');
});
test('live retrieval uses selected IDs and calendar Monday without credentials',async()=>{
  const storage=memory();
  const result=await retrieveWeek({...options,storage,fetcher:async(url,init)=>{assert.ok(url.endsWith('/Semaine/72/2/2/2026-11-02'));assert.equal(init.credentials,'omit');assert.equal(init.cache,'no-store');return {ok:true,json:async()=>fixture};}});
  assert.equal(result.cached,false);
  assert.ok(JSON.parse(storage.getItem(cacheKey('72','2','2','2026-11-06'))).checkedAt);
});
test('failure restores only the exact selection and week, with original timestamp',async()=>{
  const storage=memory(), checkedAt=Date.now()-2*86400000;
  storage.setItem(cacheKey('72','2','2','2026-11-06'),JSON.stringify({data:fixture,checkedAt}));
  const fetcher=async()=>{throw Error('Offline');};
  const result=await retrieveWeek({...options,storage,fetcher});
  assert.equal(result.cached,true);assert.equal(result.checkedAt,checkedAt);assert.equal(result.error,'Offline');
  await assert.rejects(retrieveWeek({...options,meal:'17',storage,fetcher}),/Offline/);
  await assert.rejects(retrieveWeek({...options,date:'2026-11-09',storage,fetcher}),/Offline/);
  await assert.rejects(retrieveWeek({...options,school:'79',storage,fetcher}),/Offline/);
});
test('HTTP failures and changed payloads never become successful empty menus',async()=>{
  await assert.rejects(retrieveWeek({...options,fetcher:async()=>({ok:false,status:503})}),/503/);
  await assert.rejects(retrieveWeek({...options,fetcher:async()=>({ok:true,json:async()=>({})})}),/format/);
});
test('a valid empty week replaces old data and timeout may use a cached copy',async()=>{
  const storage=memory();
  storage.setItem(cacheKey('72','2','2','2026-11-06'),JSON.stringify({data:fixture,checkedAt:Date.now()-1000}));
  const empty={JoursSemaine:[],MenuSemaine:[],Labels:[]};
  const live=await retrieveWeek({...options,storage,fetcher:async()=>({ok:true,json:async()=>empty})});
  assert.equal(live.cached,false);assert.equal(live.data.MenuSemaine.length,0);
  const controller=new AbortController();controller.abort(new DOMException('Timeout','TimeoutError'));
  const cached=await retrieveWeek({...options,storage,signal:controller.signal,fetcher:async()=>{throw controller.signal.reason;}});
  assert.equal(cached.cached,true);assert.equal(cached.data.MenuSemaine.length,0);
});
test('cancelled requests do not restore another screen or stale result',async()=>{
  const controller=new AbortController();controller.abort();
  await assert.rejects(retrieveWeek({...options,signal:controller.signal,fetcher:async()=>{throw controller.signal.reason;}}),{name:'AbortError'});
});
test('the real cold Thursday and normal Friday share one calendar',()=>{
  const merged=combineWeeks([{data:fixture,name:'Déjeuner',kind:'lunch',checkedAt:1000},{data:cold,name:'Prestation simplifiée froide',kind:'cold',checkedAt:2000}]);
  assert.equal(merged.data.JoursSemaine.length,5);
  assert.equal(dishesOn(merged.data,'2026-11-05').length,5);
  assert.ok(dishesOn(merged.data,'2026-11-05').every(x=>x.SourceKind==='cold'));
  assert.ok(dishesOn(merged.data,'2026-11-06').every(x=>x.SourceKind==='lunch'));
  assert.equal(merged.checkedAt,1000);
});
test('conflicting sources are preserved rather than silently replacing a menu',()=>{
  const merged=combineWeeks([{data:fixture,name:'Déjeuner',kind:'lunch',checkedAt:1000},{data:fixture,name:'Prestation simplifiée froide',kind:'cold',checkedAt:2000}]);
  const rows=dishesOn(merged.data,'2026-11-06');
  assert.equal(rows.length,2*dishesOn(fixture,'2026-11-06').length);
  assert.equal(new Set(rows.map(x=>x.SourceKind)).size,2);
});
test('one failed type is explicitly partial, two failed types are unavailable',async()=>{
  const meals=[{Men_id:2,LibMen:'Déjeuner'},{Men_id:17,LibMen:'Prestation simplifiée froide'}];
  const result=await retrieveCalendar({...options,meals,fetcher:async url=>{if(url.includes('/17/'))throw Error('Unavailable');return {ok:true,json:async()=>fixture};}});
  assert.deepEqual(result.failures,['Prestation simplifiée froide']);
  assert.equal(result.sources.length,1);
  await assert.rejects(retrieveCalendar({...options,meals,fetcher:async()=>{throw Error('Unavailable');}}),/Aucune source/);
});
