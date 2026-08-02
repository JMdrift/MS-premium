/* ============================================================
   MOJE STAVBA — sdílená data (fotky, deník, dokumenty, výdaje)
   Jeden zdroj pravdy pro Detail etapy, Galerii, Deník a Finance.
   Ukládá se do localStorage, takže se dá přidávat/mazat a zůstane
   to uložené i po zavření appky (funguje ale jen přes lokální
   server, ne přes dvojklik na soubor - viz README).
   ============================================================ */

// Cislo verze zobrazene na Dashboardu (screen-dashboard.js) - pri
// KAZDEM novem zipu se rucne zvysi o 1, at je na prvni pohled videt,
// jestli appka na telefonu opravdu bezi na nejnovejsim kodu (bez
// tohohle se to poznavalo jen dohadem/cachi prohlizece).
const MS_BUILD_VERSION = 82;

// kazdy projekt ma UPLNE vlastni data (jako by to byla samostatna
// instalace appky) - klice se automaticky "orazitkuji" aktivnim
// projektem, takze vsechno co jde pres msLoad/msSave je uz z podstaty
// izolovane. ms_projects_v1/ms_active_project_v1/ms_onboarded_v1 zustavaji
// zamerne globalni (jsou to udaje O projektech, ne udaje UVNITR projektu).
function msProjectKey(base){
  let pid = null;
  try{ pid = localStorage.getItem('ms_active_project_v1'); }catch(e){}
  return pid ? `${base}__${pid}` : base;
}
// jednorazova migrace: kdo uz mel data ulozena postara (neorazitkovana)
// cestou, at mu po tehle zmene nezmizi - zkopiruje se to pod aktualni
// projekt, jen kdyz tam jeste nic vlastniho neni.
function msMigrateLegacyDataToProject(){
  try{
    const pid = localStorage.getItem('ms_active_project_v1');
    if(!pid) return;
    if(localStorage.getItem('ms_migrated_to_scoped_v1')) return;
    const LEGACY_KEYS = [
      'ms_photos_v1','ms_diary_v1','ms_documents_v1','ms_expenses_v1','ms_events_v1',
      'ms_custom_stages_v1','ms_selected_stages_v1','ms_current_stage_v1','ms_closed_stages_v1',
      'ms_stage_order_v1','ms_diary_queue_v1','ms_diary_meta_v1','ms_stage_active_days_v1',
      'ms_important_v1','ms_offers_v1','ms_project_meta_v1','ms_folder_tree_v1',
    ];
    LEGACY_KEYS.forEach(base=>{
      const legacy = localStorage.getItem(base);
      const scopedKey = `${base}__${pid}`;
      if(legacy!==null && localStorage.getItem(scopedKey)===null){
        localStorage.setItem(scopedKey, legacy);
      }
    });
    localStorage.setItem('ms_migrated_to_scoped_v1', '1');
  }catch(e){}
}

const MS_STAGES = [
  {key:'pozemek',   name:'Pozemek',          color:'#4dffab'},
  {key:'projekt_povoleni', name:'Projekt a povolení', color:'#b34cff'},
  {key:'zahrada',   name:'Zahrada',          color:'#4dffab'},
  {key:'zaklady',   name:'Základy',          color:'#b34cff'},
  {key:'zemni',     name:'Zemní práce',      color:'#25e8ff'},
  {key:'demolice',  name:'Demolice / bourací práce', color:'#ff6a6a'},
  {key:'sanace_vlhkosti', name:'Sanace vlhkosti', color:'#25e8ff'},
  {key:'hruba',     name:'Hrubá stavba',     color:'#ff5e7b'},
  {key:'strecha',   name:'Střecha',          color:'#ff9b32'},
  {key:'okna',      name:'Okna a dveře',     color:'#25b7ff'},
  {key:'elektro',   name:'Elektro',          color:'#ffd35c'},
  {key:'voda',      name:'Voda/kanalizace',  color:'#25e8ff'},
  {key:'vytapeni',  name:'Vytápění',         color:'#ff5e7b'},
  {key:'zatepleni', name:'Zateplení a fasáda', color:'#25b7ff'},
  {key:'podlahy',   name:'Podlahy',          color:'#ff9b32'},
  {key:'interier',  name:'Interiér (omítky)', color:'#ffd35c'},
  {key:'malby_natery', name:'Malby a nátěry', color:'#4dffab'},
  {key:'koupelna',  name:'Koupelna',         color:'#25e8ff'},
  {key:'kuchyne',   name:'Kuchyně',          color:'#ff9b32'},
  {key:'naradi',    name:'Nářadí',           color:'#ff5e7b'},
  {key:'chytra_domacnost', name:'Chytrá domácnost', color:'#ffd35c'},
  {key:'rekuperace', name:'Rekuperace',      color:'#4dffab'},
  {key:'garaz',     name:'Garáž',            color:'#ff9b32'},
  {key:'bazen',     name:'Bazén',            color:'#25b7ff'},
  {key:'posledni_upravy', name:'Poslední úpravy', color:'#b34cff'},
  {key:'plot',      name:'Plot',             color:'#4dffab'},
];
function msStageByKey(key){ return MS_STAGES.find(s=>s.key===key) || msCustomStages().find(s=>s.key===key); }

/* ============================================================
   PRESET ETAP PODLE TYPU STAVBY - pri zalozeni projektu se podle
   zvoleneho typu rovnou predvybere smysluplna sada etap z katalogu
   (uzivatel si pak kdykoliv muze cokoliv pridat/odebrat sam).
   "Jine" zustava zamerne prazdne - nema smysl hadat.
   ============================================================ */
const MS_TYPE_STAGE_PRESETS = {
  'Rodinný dům': ['pozemek','projekt_povoleni','zemni','zaklady','hruba','strecha','okna','elektro','voda','vytapeni','zatepleni','interier','koupelna','kuchyne','naradi','rekuperace','posledni_upravy','zahrada','plot'],
  'Chata': ['pozemek','projekt_povoleni','zemni','zaklady','hruba','strecha','okna','elektro','voda','vytapeni','interier','naradi','posledni_upravy','zahrada','plot'],
  'Byt': ['projekt_povoleni','elektro','voda','podlahy','malby_natery','interier','koupelna','kuchyne','chytra_domacnost','naradi','posledni_upravy'],
  'Rekonstrukce': ['projekt_povoleni','demolice','sanace_vlhkosti','elektro','voda','vytapeni','podlahy','malby_natery','interier','koupelna','kuchyne','naradi','posledni_upravy'],
  'Komerční objekt': ['pozemek','projekt_povoleni','zemni','zaklady','hruba','strecha','okna','elektro','voda','vytapeni','zatepleni','interier','rekuperace','naradi','posledni_upravy'],
  'Jiné': [],
};

/* ============================================================
   VLASTNÍ ETAPY (uzivatel si muze vytvorit i neco mimo katalog)
   ============================================================ */
const MS_CUSTOM_STAGES_KEY = 'ms_custom_stages_v1';
function msCustomStages(){ return msLoad(MS_CUSTOM_STAGES_KEY, ()=>[]); }
function msSaveCustomStages(list){ msSave(MS_CUSTOM_STAGES_KEY, list); msTriggerCloudSnapshotSync(); }
// katalog k vyberu v "Nova etapa" = vestavenych 9 + vlastni, ktere si uzivatel jiz vytvoril
function msStageCatalog(){ return [...MS_STAGES, ...msCustomStages()]; }
function msAddCustomStage(name, color){
  const list = msCustomStages();
  const stage = {key: msUid('custom_'), name, color, custom:true};
  list.push(stage);
  msSaveCustomStages(list);
  return stage;
}

/* ============================================================
   VYBRANÉ ETAPY (MS_STAGES je jen katalog možností; uživatel si
   vybere, které z nich se skutečně týkají jeho stavby - nulový
   stav = žádná vybraná, dokud si sám nepřidá)
   ============================================================ */
const MS_SELECTED_STAGES_KEY = 'ms_selected_stages_v1';
function msSelectedStageKeys(){ return msLoad(MS_SELECTED_STAGES_KEY, ()=>[]); }
function msSetSelectedStageKeys(keys){ msSave(MS_SELECTED_STAGES_KEY, keys); msTriggerCloudSnapshotSync(); }
function msSelectedStages(){
  const keys = msSelectedStageKeys();
  return msStageCatalog().filter(s => keys.includes(s.key));
}
function msAddSelectedStage(key){
  const keys = msSelectedStageKeys();
  if(!keys.includes(key)){
    keys.push(key);
    msSetSelectedStageKeys(keys);
  }
}
function msRemoveSelectedStage(key){
  msSetSelectedStageKeys(msSelectedStageKeys().filter(k => k !== key));
}
// kontrola, jestli k etape uz neco patri (vydaje, fotky, dokumenty, denik) -
// pouzito pri mazani etapy, at uzivatel vi, ze data zustanou "osirela"
function msStageHasData(key){
  return msSumExpensesByStage(key) > 0
    || msPhotos().some(p=>p.stage===key)
    || msDocuments().some(d=>d.stage===key)
    || msDiary().some(e=>e.stage===key);
}
// smaze etapu ze seznamu vybranych (a uklidi navazany stav) - data k ni
// (vydaje/fotky/dokumenty/denik) se NEmazou, jen ta etapa zmizi ze vyberu
// OPRAVA (bod 1, 2.8.2026): mazani etapy (stejne jako "aktualni"/"uzavrit
// etapu") je vyhrazene jen vlastnikovi - jednosmerne synchronizovane, ne
// obousmerne upravitelne pozvanym, bez ohledu na jeho prava v sekci
// "etapy". Zamek primo tady, centralne pro vsechna tri mista v appce
// (kolecko, prehled, detail), misto opakovane kontroly na kazdem z nich.
function msDeleteStage(key){
  const p = (typeof msActiveProjectForRights === 'function') ? msActiveProjectForRights() : null;
  if(p && p.isShared){
    if(typeof msShowAccessDenied === 'function') msShowAccessDenied();
    return;
  }
  msRemoveSelectedStage(key);
  msSetStageClosed(key, false);
  if(msGetCurrentStage()===key){
    try{ localStorage.removeItem(msProjectKey('ms_current_stage_v1')); }catch(e){}
  }
}

const MS_KEYS = {
  photos: 'ms_photos_v1',
  diary: 'ms_diary_v1',
  documents: 'ms_documents_v1',
  expenses: 'ms_expenses_v1',
  events: 'ms_events_v1',
};

function msEvents(){ return msLoad(MS_KEYS.events, ()=>[]); }
// Ticha synchronizace na pozadi HNED po pridani/zmene, ne az pri
// pristim otevreni Nastaveni - jen pro VLASTNI projekt s aktivnim
// Premium (u FREE/sdileneho projektu by se tim omylem zalozil
// zbytecny/spatny cloudovy zaznam). Spolecna pomocna funkce, at se
// nezapomene na nejakem dalsim miste (jako se to stalo u Kalendare).
//
// OPRAVA (1.8.2026, dulezita): NEKTERE zmeny (napr. nastaveni aktualni
// etapy) uvnitr zavolaji VIC funkci, ktere KAZDA zvlast spousti tenhle
// trigger (napr. msSetCurrentStage() -> msAddSelectedStage() ->
// msSetSelectedStageKeys() uz sama posila, a pak jeste msSetCurrentStage
// posle znovu na konci). Bez debounce by tak odletely DVA prekryvajici
// se pozadavky na server zaroven - a kdyz starsi dorazi POZDEJI nez ten
// novejsi (poradi site neni zaruceno), prepise novejsi data staršimi.
// Reseni: pockat kratkou chvili a poslat jen ten UPLNE POSLEDNI pozadavek.
let _msSnapshotSyncTimer = null;
function msTriggerCloudSnapshotSync(){
  if(typeof MSCloud === 'undefined') return;
  const active = msLoadProjects().find(p=>p.id===msGetActiveProjectId());
  if(!(active && !active.isShared && msIsPremiumMock())) return;
  if(_msSnapshotSyncTimer) clearTimeout(_msSnapshotSyncTimer);
  _msSnapshotSyncTimer = setTimeout(()=>{
    _msSnapshotSyncTimer = null;
    MSCloud.uploadSnapshot().catch(e=> console.error('tichy uploadSnapshot selhal', e));
  }, 800);
}

function msAddEvent(ev){
  const list = msEvents();
  const withId = Object.assign({id: msUid('e')}, ev);
  list.push(withId);
  msSave(MS_KEYS.events, list);
  if(typeof MSCloud !== 'undefined' && MSCloud.pushEvent){
    MSCloud.pushEvent(withId).then(({error, row})=>{
      if(error){ console.error('cloud push udalosti selhal', error); return; }
      if(row && row.id){
        const cur = msEvents();
        const idx = cur.findIndex(e=>e.id===withId.id);
        if(idx>-1){ cur[idx] = Object.assign({}, cur[idx], { cloudId: row.id }); msSave(MS_KEYS.events, cur); }
      }
    }).catch(e=> console.error('cloud push udalosti selhal', e));
  }
  return withId;
}
function msDeleteEvent(id){
  const ev = msEvents().find(e=>e.id===id);
  msSave(MS_KEYS.events, msEvents().filter(e=>e.id!==id));
  if(ev && ev.cloudId && typeof MSCloud !== 'undefined' && MSCloud.deleteEventCloud){
    MSCloud.deleteEventCloud(ev.cloudId).catch(e=> console.error('cloud delete udalosti selhalo', e));
  }
}
function msUpdateEvent(id, patch){
  const list = msEvents();
  const idx = list.findIndex(e=>e.id===id);
  if(idx===-1) return null;
  list[idx] = Object.assign({}, list[idx], patch);
  msSave(MS_KEYS.events, list);
  if(list[idx].cloudId && typeof MSCloud !== 'undefined' && MSCloud.updateEventCloud){
    MSCloud.updateEventCloud(list[idx].cloudId, { title: list[idx].title, date: list[idx].date, time: list[idx].time }).catch(e=> console.error('cloud update udalosti selhal', e));
  }
  return list[idx];
}

// ukoly - podobne jako udalosti (maji datum, zobrazuji se v Kalendari),
// ale navic jdou odskrtnout jako hotove - to udalosti nemaji
function msTasks(){ return msLoad('ms_tasks_v1', ()=>[]); }
function msAddTask(t){
  const list = msTasks();
  const withId = Object.assign({id: msUid('task'), done:false}, t);
  list.push(withId);
  msSave('ms_tasks_v1', list);
  if(typeof MSCloud !== 'undefined' && MSCloud.pushTask){
    MSCloud.pushTask(withId).then(({error, row})=>{
      if(error){ console.error('cloud push ukolu selhal', error); return; }
      if(row && row.id){
        const cur = msTasks();
        const idx = cur.findIndex(t=>t.id===withId.id);
        if(idx>-1){ cur[idx] = Object.assign({}, cur[idx], { cloudId: row.id }); msSave('ms_tasks_v1', cur); }
      }
    }).catch(e=> console.error('cloud push ukolu selhal', e));
  }
  return withId;
}
function msUpdateTask(id, patch){
  const list = msTasks();
  const idx = list.findIndex(t=>t.id===id);
  if(idx===-1) return null;
  list[idx] = Object.assign({}, list[idx], patch);
  msSave('ms_tasks_v1', list);
  if(list[idx].cloudId && typeof MSCloud !== 'undefined' && MSCloud.updateTaskCloud){
    MSCloud.updateTaskCloud(list[idx].cloudId, { title: list[idx].title, date: list[idx].date, date_mode: list[idx].dateMode, done: !!list[idx].done, done_date: list[idx].doneDate || null }).catch(e=> console.error('cloud update ukolu selhal', e));
  }
  return list[idx];
}
function msDeleteTask(id){
  const t = msTasks().find(x=>x.id===id);
  msSave('ms_tasks_v1', msTasks().filter(t=>t.id!==id));
  if(t && t.cloudId && typeof MSCloud !== 'undefined' && MSCloud.deleteTaskCloud){
    MSCloud.deleteTaskCloud(t.cloudId).catch(e=> console.error('cloud delete ukolu selhalo', e));
  }
}

// Sloucení stažených udalosti/ukolu - stejny princip jako Denik/Finance
// (cloudId/local_id pro poznani vlastniho zaznamu, obnova jmena
// pridavatele, mazani kdyz uz v cloudu neni).
function msMergeCloudEvents(localProjectId, rows){
  const key = 'ms_events_v1__' + localProjectId;
  let list = [];
  try{ list = JSON.parse(localStorage.getItem(key) || '[]'); }catch(e){}
  const cloudIdIndex = {};
  list.forEach((e,i)=>{ if(e.cloudId) cloudIdIndex[e.cloudId] = i; });
  const localIdIndex = {};
  list.forEach((e,i)=>{ localIdIndex[e.id] = i; });
  let added = 0, patched = false;
  (rows||[]).forEach(row=>{
    if(cloudIdIndex.hasOwnProperty(row.id)){
      const idx = cloudIdIndex[row.id];
      const patch = {};
      if(list[idx].title !== row.title) patch.title = row.title;
      if(list[idx].date !== row.date) patch.date = row.date;
      if(list[idx].time !== row.time) patch.time = row.time;
      const newAuthor = row.added_by_label || 'Sdíleno';
      if(list[idx].author !== newAuthor) patch.author = newAuthor;
      if(Object.keys(patch).length){ list[idx] = Object.assign({}, list[idx], patch); patched = true; }
      return;
    }
    if(row.local_id && localIdIndex.hasOwnProperty(row.local_id)){
      const idx = localIdIndex[row.local_id];
      if(!list[idx].cloudId){ list[idx] = Object.assign({}, list[idx], { cloudId: row.id }); patched = true; }
      return;
    }
    list.push({ id: msUid('e'), cloudId: row.id, title: row.title, date: row.date, time: row.time, author: row.added_by_label || 'Sdíleno' });
    added++;
  });
  const remoteIds = new Set((rows||[]).map(r=>r.id));
  const beforeLen = list.length;
  list = list.filter(e=> !e.cloudId || remoteIds.has(e.cloudId));
  const removed = beforeLen - list.length;
  if(added || patched || removed){ try{ localStorage.setItem(key, JSON.stringify(list)); }catch(e){ console.error('msMergeCloudEvents', e); } }
  return added + removed;
}
function msMergeCloudTasks(localProjectId, rows){
  const key = 'ms_tasks_v1__' + localProjectId;
  let list = [];
  try{ list = JSON.parse(localStorage.getItem(key) || '[]'); }catch(e){}
  const cloudIdIndex = {};
  list.forEach((t,i)=>{ if(t.cloudId) cloudIdIndex[t.cloudId] = i; });
  const localIdIndex = {};
  list.forEach((t,i)=>{ localIdIndex[t.id] = i; });
  let added = 0, patched = false;
  (rows||[]).forEach(row=>{
    if(cloudIdIndex.hasOwnProperty(row.id)){
      const idx = cloudIdIndex[row.id];
      const patch = {};
      if(list[idx].title !== row.title) patch.title = row.title;
      if(list[idx].date !== row.date) patch.date = row.date;
      if(list[idx].dateMode !== row.date_mode) patch.dateMode = row.date_mode;
      if(list[idx].done !== !!row.done) patch.done = !!row.done;
      if(list[idx].doneDate !== (row.done_date||null)) patch.doneDate = row.done_date || null;
      const newAuthor = row.added_by_label || 'Sdíleno';
      if(list[idx].author !== newAuthor) patch.author = newAuthor;
      if(Object.keys(patch).length){ list[idx] = Object.assign({}, list[idx], patch); patched = true; }
      return;
    }
    if(row.local_id && localIdIndex.hasOwnProperty(row.local_id)){
      const idx = localIdIndex[row.local_id];
      if(!list[idx].cloudId){ list[idx] = Object.assign({}, list[idx], { cloudId: row.id }); patched = true; }
      return;
    }
    list.push({ id: msUid('task'), cloudId: row.id, title: row.title, date: row.date, dateMode: row.date_mode, done: !!row.done, doneDate: row.done_date || null, author: row.added_by_label || 'Sdíleno' });
    added++;
  });
  const remoteIds = new Set((rows||[]).map(r=>r.id));
  const beforeLen = list.length;
  list = list.filter(t=> !t.cloudId || remoteIds.has(t.cloudId));
  const removed = beforeLen - list.length;
  if(added || patched || removed){ try{ localStorage.setItem(key, JSON.stringify(list)); }catch(e){ console.error('msMergeCloudTasks', e); } }
  return added + removed;
}

function msUid(prefix){
  return prefix + Date.now() + Math.random().toString(36).slice(2, 8);
}

// Urcuje, jestli/jak se ma ukol zobrazit na dany den (iso) v kalendari.
// Pravidla (viz diskuze s uzivatelem):
// - "bez terminu" (none): dokud neni splneny, vidi se kazdy den pod DNESKEM.
//   Po splneni zmizi odevsad a objevi se jen v den, kdy byl splnen.
// - "konkretni den" (date): vidi se jen v ten den. Kdyz den mine a ukol
//   neni splneny, zacne se navic "vlecti" pod dneskem, zvyrazneny, dokud
//   se nesplni. Po splneni zakotvi jen v den splneni.
// - "deadline": vidi se kazdy den pod dneskem od zalozeni, po prekroceni
//   terminu zvyrazneny. Po splneni zakotvi jen v den splneni.
function msTaskVisibleOn(t, iso, todayIso){
  if(t.done){
    return { visible: t.doneDate === iso, highlighted:false };
  }
  if(t.dateMode === 'none'){
    return { visible: iso===todayIso, highlighted:false };
  }
  if(t.dateMode === 'date'){
    if(iso === t.date) return { visible:true, highlighted:false };
    if(iso === todayIso && todayIso > t.date) return { visible:true, highlighted:true };
    return { visible:false, highlighted:false };
  }
  if(t.dateMode === 'deadline'){
    if(iso === todayIso) return { visible:true, highlighted: todayIso > t.date };
    return { visible:false, highlighted:false };
  }
  return { visible:false, highlighted:false };
}

// gesto "zpet": tazeni prstem od leveho okraje displeje doprava (jako na iOS)
// - v HTML/webovem rozhrani to neni tak spolehlive jako v opravdove nativni
//   appce (prohlizec si to muze brat pro sve vlastni gesto), ale jako doplnek
//   k historii appky to funguje. Volá Router.back() - vlastni historie appky,
//   ne historii prohlizece (uz nejde o skutecne stranky).
(function swipeBack(){
  let startX = null, startY = null, startT = 0;
  const EDGE = 24; // px od leveho okraje, kde gesto muze zacit
  document.addEventListener('touchstart', (e)=>{
    if(e.touches.length !== 1) return;
    const t = e.touches[0];
    if(t.clientX <= EDGE){
      startX = t.clientX; startY = t.clientY; startT = Date.now();
    } else {
      startX = null;
    }
  }, {passive:true});
  document.addEventListener('touchend', (e)=>{
    if(startX === null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = Math.abs(t.clientY - startY);
    const dt = Date.now() - startT;
    if(dx > 70 && dy < 60 && dt < 600 && window.Router){
      Router.back();
    }
    startX = null;
  }, {passive:true});
})();

/* ============================================================
   ULOZISTE FOTEK/DOKUMENTU (IndexedDB) - localStorage ma pevny
   strop ~5-10 MB sdileny pro celou appku, coz na fotky/dokumenty
   ve slusne kvalite nestaci. Samotny obsah (velky base64 obrazek)
   ted zije v IndexedDB (radove stovky MB az GB, podle mista v
   telefonu), localStorage drzi jen male metadata (kdo, kdy, kam).
   Zbytek appky pozna zmenu jen minimalne - .thumb/.content pole
   zustavaji stejne pojmenovana, jen se doplni z pametove keše misto
   primo z ulozeneho zaznamu.
   ============================================================ */
const MS_BLOB_CACHE = new Map();
let msIdbPromise = null;
function msIdbOpen(){
  if(msIdbPromise) return msIdbPromise;
  msIdbPromise = new Promise((resolve)=>{
    if(!window.indexedDB){ resolve(null); return; }
    const req = indexedDB.open('moje-stavba-media', 1);
    req.onupgradeneeded = ()=>{ req.result.createObjectStore('blobs'); };
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> resolve(null);
  });
  return msIdbPromise;
}
// OPRAVA (31.7.2026): na nekterych telefonech (hlavne iPhone/WebKit)
// IndexedDB transakce obcas "zamrzne" navzdy - nikdy nezavola ani
// oncomplete/onsuccess, ani onerror. Bez casoveho limitu by na to appka
// cekala donekonecna (a spolu s ni cokoli, co na dokonceni ulozeni ceka -
// napr. cely zapis do Deniku s prilozenou fotkou, ktery pak vypadal, ze
// se "nikdy neulozi", i kdyz fotka mezitim v Galerii byla). Po peti
// vterinach appka operaci vzda a pokracuje dal. Tohle NENI specificke
// pro sdileni/Premium - tyka se to appky uplne obecne (FREE i Premium).
function msIdbWithTimeout(promise, key, label){
  const timeout = new Promise(resolve=> setTimeout(()=>{
    console.error('msIdb' + label + ': časový limit vypršel, IndexedDB transakce zamrzla', key);
    resolve(label === 'Get' ? null : false);
  }, 12000));
  return Promise.race([promise, timeout]);
}
// OPRAVA (1.8.2026, dulezita): appka ted na sdilenem zarizeni bezi
// vic soubeznych ulozny operaci najednou (vlastni pridana fotka +
// stahovani fotek od druhe strany na pozadi) - souběžné IndexedDB
// transakce jsou na iOS znamy zdroj tichych selhani (appka si mysli,
// ze ulozila, ale neulozila). Reseni: fronta - vsechny zapisy/cteni
// do IndexedDB bezi VZDY jeden po druhem, nikdy soubezne, bez ohledu
// na to, kolik ruznych mist appky si o to zaroven rekne.
let _msIdbChain = Promise.resolve();
function msIdbEnqueue(taskFn){
  const run = () => taskFn();
  const next = _msIdbChain.then(run, run); // i po predchozim selhani fronta pokracuje dal
  _msIdbChain = next.catch(()=>{});
  return next;
}
function msIdbSet(key, value){
  return msIdbEnqueue(()=>{
    const attempt = msIdbOpen().then(db=> new Promise(resolve=>{
      if(!db){ resolve(false); return; }
      try{
        const tx = db.transaction('blobs','readwrite');
        tx.objectStore('blobs').put(value, key);
        tx.oncomplete = ()=> resolve(true);
        tx.onerror = ()=> resolve(false);
      }catch(e){ resolve(false); }
    }));
    return msIdbWithTimeout(attempt, key, 'Set');
  });
}
function msIdbGet(key){
  return msIdbEnqueue(()=>{
    const attempt = msIdbOpen().then(db=> new Promise(resolve=>{
      if(!db){ resolve(null); return; }
      try{
        const tx = db.transaction('blobs','readonly');
        const req = tx.objectStore('blobs').get(key);
        req.onsuccess = ()=> resolve(req.result || null);
        req.onerror = ()=> resolve(null);
      }catch(e){ resolve(null); }
    }));
    return msIdbWithTimeout(attempt, key, 'Get');
  });
}
function msIdbDelete(key){
  return msIdbEnqueue(()=>{
    const attempt = msIdbOpen().then(db=> new Promise(resolve=>{
      if(!db){ resolve(false); return; }
      try{
        const tx = db.transaction('blobs','readwrite');
        tx.objectStore('blobs').delete(key);
        tx.oncomplete = ()=> resolve(true);
        tx.onerror = ()=> resolve(false);
      }catch(e){ resolve(false); }
    }));
    return msIdbWithTimeout(attempt, key, 'Delete');
  });
}
function msIdbAllKeys(){
  return msIdbOpen().then(db=> new Promise(resolve=>{
    if(!db){ resolve([]); return; }
    try{
      const tx = db.transaction('blobs','readonly');
      const req = tx.objectStore('blobs').getAllKeys();
      req.onsuccess = ()=> resolve(req.result || []);
      req.onerror = ()=> resolve([]);
    }catch(e){ resolve([]); }
  }));
}
// blob klice se orazitkuji aktivnim projektem stejne jako localStorage klice
function msBlobKey(type, id){ return msProjectKey(`${type}_${id}`); }
// nacte VSECHNY fotky/dokumenty aktualniho projektu do pametove keše -
// zavola se jednou pri startu appky, pred prvnim vykreslenim
async function msHydrateBlobCache(){
  const photoIds = msPhotos().map(p=>p.id);
  const docIds = msDocuments().map(d=>d.id);
  const receiptIds = msLoad(MS_KEYS.expenses, msSeedExpenses).filter(t=>t.hasReceipt).map(t=>t.id);
  const projectItemIds = (typeof msLoadProjectItems === 'function') ? msLoadProjectItems().map(it=>it.id) : [];
  await Promise.all([
    ...photoIds.map(async id=>{ const v = await msIdbGet(msBlobKey('photo', id)); if(v) MS_BLOB_CACHE.set(msBlobKey('photo', id), v); }),
    ...docIds.map(async id=>{ const v = await msIdbGet(msBlobKey('doc', id)); if(v) MS_BLOB_CACHE.set(msBlobKey('doc', id), v); }),
    ...receiptIds.map(async id=>{ const v = await msIdbGet(msBlobKey('receipt', id)); if(v) MS_BLOB_CACHE.set(msBlobKey('receipt', id), v); }),
    ...projectItemIds.map(async id=>{ const v = await msIdbGet(msBlobKey('pitem', id)); if(v) MS_BLOB_CACHE.set(msBlobKey('pitem', id), v); }),
  ]);
}
// jednorazova migrace: kdo uz mel fotky/dokumenty ulozene primo v
// localStorage (stary zpusob), presune se obsah do IndexedDB a z
// localStorage zaznamu se smaze - tim se hned uvolni misto
async function msMigratePhotosDocsToIdb(){
  try{
    if(localStorage.getItem(msProjectKey('ms_migrated_to_idb_v1'))) return;
    const photos = msPhotos();
    let changed = false;
    for(const p of photos){
      if(p.thumb){ await msIdbSet(msBlobKey('photo', p.id), p.thumb); MS_BLOB_CACHE.set(msBlobKey('photo', p.id), p.thumb); delete p.thumb; changed = true; }
    }
    if(changed) msSave(MS_KEYS.photos, photos);
    const docs = msDocuments();
    let changed2 = false;
    for(const d of docs){
      if(d.content){ await msIdbSet(msBlobKey('doc', d.id), d.content); MS_BLOB_CACHE.set(msBlobKey('doc', d.id), d.content); delete d.content; changed2 = true; }
    }
    if(changed2) msSave(MS_KEYS.documents, docs);
    localStorage.setItem(msProjectKey('ms_migrated_to_idb_v1'), '1');
  }catch(e){}
}

function msLoad(storageKey, seedFn){
  const key = msProjectKey(storageKey);
  try{
    const raw = localStorage.getItem(key);
    if(raw) return JSON.parse(raw);
  }catch(e){}
  const seed = seedFn();
  try{ localStorage.setItem(key, JSON.stringify(seed)); }catch(e){}
  return seed;
}

/* ============================================================
   DIAGNOSTIKA A UKLID ULOZISTE - localStorage ma pevny strop
   (~5-10 MB) SDILENY pro CELOU appku napric vsemi projekty, ne
   zvlast pro kazdy. Komprese u NOVYCH fotek/dokumentu pomuze jen
   do budoucna - tohle umi zmensit i to, co uz je ulozene.
   ============================================================ */
function msStorageUsageBytes(){
  let total = 0;
  try{
    for(let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i);
      const v = localStorage.getItem(k);
      total += (k?k.length:0) + (v?v.length:0);
    }
  }catch(e){}
  return total; // priblizne - 1 znak v JS retezci ~ 2 bajty, ale radove staci
}
function msStorageBreakdown(){
  const sizeOf = (v)=> v ? JSON.stringify(v).length : 0;
  return {
    fotky: msPhotos().reduce((a,p)=>a+sizeOf(p.thumb),0),
    dokumenty: msDocuments().reduce((a,d)=>a+sizeOf(d.content),0),
    denik: sizeOf(msDiary()),
    ostatni: 0, // dopocita se jako zbytek v UI
  };
}
function msResizeDataUrl(dataUrl, maxDim, quality){
  const attempt = new Promise(resolve=>{
    if(!dataUrl || !dataUrl.startsWith('data:image')){ resolve(dataUrl); return; }
    const img = new Image();
    img.onload = ()=>{
      let {width,height} = img;
      if(Math.max(width,height) <= maxDim){ resolve(dataUrl); return; } // uz dost male, netreba prepocitavat
      if(width>height){ height = height*maxDim/width; width = maxDim; }
      else { width = width*maxDim/height; height = maxDim; }
      const canvas = document.createElement('canvas');
      canvas.width=width; canvas.height=height;
      canvas.getContext('2d').drawImage(img,0,0,width,height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = ()=> resolve(dataUrl);
    img.src = dataUrl;
  });
  // OPRAVA (31.7.2026): stejna pojistka jako u IndexedDB (msIdbWithTimeout) -
  // na nekterych telefonech se i zmensovani obrazku pres canvas muze vzacne
  // zaseknout (ani onload, ani onerror se nezavola). Bez limitu by na to
  // cekal donekonecna cely zapis do Deniku, ktery na tenhle vysledek ceka.
  // Po peti vterinach appka pouzije PUVODNI (nezmensenou) fotku misto
  // vecneho cekani - horsi nez male zmenseni, ale rozhodne lepsi nez
  // ztraceny zapis.
  const timeout = new Promise(resolve=> setTimeout(()=>{
    console.error('msResizeDataUrl: časový limit vypršel, zmenšení obrázku zamrzlo');
    resolve(dataUrl);
  }, 12000));
  return Promise.race([attempt, timeout]);
}
// projde uz ulozene fotky a dokumenty teto etapy/projektu a znovu je
// zmensi na stejny strop, jaky uz plati pro nove nahravane veci - vraci
// kolik bajtu se uvolnilo, at je to videt v Nastaveni
async function msCompressExistingMedia(onProgress){
  let savedBytes = 0;
  const photos = msPhotos();
  for(let i=0;i<photos.length;i++){
    const key = msBlobKey('photo', photos[i].id);
    const before = JSON.stringify(photos[i].thumb||'').length;
    const resized = await msResizeDataUrl(photos[i].thumb, 480, 0.7);
    const after = JSON.stringify(resized||'').length;
    if(resized && after < before){ MS_BLOB_CACHE.set(key, resized); await msIdbSet(key, resized); savedBytes += (before-after); }
    if(onProgress) onProgress('fotky', i+1, photos.length);
  }
  const docs = msDocuments();
  for(let i=0;i<docs.length;i++){
    const key = msBlobKey('doc', docs[i].id);
    const before = JSON.stringify(docs[i].content||'').length;
    const resized = await msResizeDataUrl(docs[i].content, 1400, 0.75);
    const after = JSON.stringify(resized||'').length;
    if(resized && after < before){ MS_BLOB_CACHE.set(key, resized); await msIdbSet(key, resized); savedBytes += (before-after); }
    if(onProgress) onProgress('dokumenty', i+1, docs.length);
  }
  return savedBytes;
}
function msSave(storageKey, list){
  try{ localStorage.setItem(msProjectKey(storageKey), JSON.stringify(list)); return true; }
  catch(e){ return false; }
}

/* --- výchozí ukázková data --- */
function msSeedPhotos(){
  return [];
}
function msSeedDiary(){
  return [];
}
/* ============================================================
   FRONTA "PRIPRAVENO PRO DALSI ZAPIS" - kdyz uzivatel prida fotku,
   dokument nebo udalost (nebo dokonci etapu), muze/automaticky se to
   zarad do fronty. Pri dalsim zapisu do deniku se fronta nabidne jako
   dlaždice k vyrazeni/potvrzeni, a po ulozeni zapisu se cela vyprazdni -
   dalsi zapis pak sbira jen NOVE veci pridane od tohoto okamziku.
   ============================================================ */
const MS_DIARY_QUEUE_KEY = 'ms_diary_queue_v1';
function msDiaryQueue(){ return msLoad(MS_DIARY_QUEUE_KEY, ()=>[]); }
function msQueueForDiary(type, refId){
  const q = msDiaryQueue();
  if(q.some(it=>it.type===type && it.refId===refId)) return;
  q.push({ type, refId, addedAt: Date.now() });
  msSave(MS_DIARY_QUEUE_KEY, q);
}
function msUnqueueFromDiary(type, refId){
  msSave(MS_DIARY_QUEUE_KEY, msDiaryQueue().filter(it=>!(it.type===type && it.refId===refId)));
}
function msClearDiaryQueue(){ msSave(MS_DIARY_QUEUE_KEY, []); }
// fronta prevedena na zobrazitelne objekty (s nahledem/popiskem) - polozky,
// jejichz zdroj uz neexistuje (napr. smazana fotka), se tise vynechaji
function msDiaryQueueResolved(){
  const out = [];
  msDiaryQueue().forEach(it=>{
    if(it.type==='photo'){
      const p = msPhotos().find(x=>x.id===it.refId);
      if(p) out.push(Object.assign({}, it, {label: p.caption || 'Fotka', preview: p.thumb, stage: p.stage}));
    } else if(it.type==='document'){
      const d = msDocuments().find(x=>x.id===it.refId);
      if(d) out.push(Object.assign({}, it, {label: d.name, preview: null, stage: d.stage}));
    } else if(it.type==='event'){
      const e = msEvents().find(x=>x.id===it.refId);
      if(e) out.push(Object.assign({}, it, {label: e.title, preview: null, stage: null}));
    } else if(it.type==='stage_complete'){
      const s = msStageByKey(it.refId);
      if(s) out.push(Object.assign({}, it, {label: 'Dokončena etapa: '+s.name, preview: null, stage: it.refId}));
    }
  });
  return out.sort((a,b)=>a.addedAt-b.addedAt);
}
// datum posledniho zapisu do deniku (pro pripominku "uz tyden nic")
function msLastDiaryEntryDate(){
  const list = msDiary();
  if(!list.length) return null;
  return list.map(e=>e.date).sort().pop();
}
function msDayCount(startISO){
  const start = new Date(startISO+'T00:00:00');
  const now = new Date();
  return Math.max(1, Math.floor((now-start)/86400000)+1);
}
function msAddDiaryEntry(entry){
  const list = msDiary();
  const withId = Object.assign({id:msUid('d'), date: msTodayISO(), time: new Date().toTimeString().slice(0,5), author:'Stavebník'}, entry);
  list.push(withId);
  msSave(MS_KEYS.diary, list);
  // Obousmerne sdileni (1.8.2026): funguje stejne pro vlastnika i pro
  // pozvaneho s pravem pridavat do deniku - MSCloud.pushDiaryEntry() si
  // sam poradi s tim, kam presne patri (vlastni projekt vs sdileny).
  if(typeof MSCloud !== 'undefined' && MSCloud.pushDiaryEntry){
    MSCloud.pushDiaryEntry(withId).then(({error, row})=>{
      if(error){ console.error('cloud push zapisu do deniku selhal', error); return; }
      if(row && row.id){
        // dopln cloudId zpetne na lokalni zaznam - bez tohohle by pozdejsi
        // slouceni (msMergeCloudDiaryEntries) nepoznalo, ze uz tenhle
        // konkretni zapis mame, a zduplikovalo by ho
        const cur = msDiary();
        const idx = cur.findIndex(e=>e.id===withId.id);
        if(idx>-1){ cur[idx] = Object.assign({}, cur[idx], { cloudId: row.id }); msSave(MS_KEYS.diary, cur); }
      }
    }).catch(e=> console.error('cloud push zapisu do deniku selhal', e));
  }
  return withId;
}
// Sloucí (ne prepise) radky stazene z project_diary_entries podle
// cloudId - pouziva se z MSCloud pri periodicke kontrole. Vraci pocet
// skutecne pridanych novych zaznamu (0 = nic noveho, appka se pak
// nemusi zbytecne prekreslovat).
//
// OPRAVA (1.8.2026, kriticka): puvodni verze poznavala "uz to mam" JEN
// podle cloudId - ale cloudId se na lokalni zaznam dopisuje AZ po
// potvrzeni ze serveru (asynchronne, s malym zpozdenim). Pokud v tomhle
// kratkem okne prosel dalsi kontrolni cyklus, appka nepoznala vlastni
// prave odeslany zapis, "stahla" ho znovu jako by byl cizi - a protoze
// se to opakovalo pri kazdem cyklu (dokud se cloudId nakonec nedopsalo,
// coz u nekterych zaznamu vubec nenastalo), vznikaly duplicity znovu a
// znovu. Reseni: poznat vlastni zaznam i podle local_id (stabilni od
// prvniho okamziku, zadne cekani na server) - kdyz cloudId chybi, appka
// ho teď rovnou dopise na spravny existujici zaznam, misto aby
// vytvorila novy.
function msMergeCloudDiaryEntries(localProjectId, rows){
  const key = 'ms_diary_v1__' + localProjectId;
  let list = [];
  try{ list = JSON.parse(localStorage.getItem(key) || '[]'); }catch(e){}
  const cloudIdIndex = {};
  list.forEach((e,i)=>{ if(e.cloudId) cloudIdIndex[e.cloudId] = i; });
  const localIdIndex = {};
  list.forEach((e,i)=>{ localIdIndex[e.id] = i; });
  let added = 0, patched = false;
  (rows||[]).forEach(row=>{
    if(cloudIdIndex.hasOwnProperty(row.id)){
      // OPRAVA (1.8.2026): drive appka takovy zaznam jen preskocila -
      // kdyz si vlastnik pozdeji zmenil jmeno pozvaneho v "Spravovat
      // sdileni", uz drive stazene zapisy si to jmeno nikdy nedotahly.
      // Ted se jmeno obnovi pri kazdem sloučení, ne jen napoprve.
      const idx = cloudIdIndex[row.id];
      const newAuthor = row.added_by_label || 'Sdíleno';
      if(list[idx].author !== newAuthor){ list[idx] = Object.assign({}, list[idx], { author: newAuthor }); patched = true; }
      return;
    }
    if(row.local_id && localIdIndex.hasOwnProperty(row.local_id)){
      // Tohle je MUJ VLASTNI zapis, jen jeste (docasne) bez dopsaneho
      // cloudId - dopsat ho na existujici zaznam, NE vytvaret duplicitu.
      const idx = localIdIndex[row.local_id];
      if(!list[idx].cloudId){ list[idx] = Object.assign({}, list[idx], { cloudId: row.id }); patched = true; }
      return;
    }
    list.push({
      id: msUid('d'), cloudId: row.id,
      date: row.date, time: row.time, author: row.added_by_label || 'Sdíleno',
      stage: row.stage, text: row.content, worker: row.worker, material: row.material,
      issue: row.issue, important: row.important, photos: row.photos || [], items: row.items || [],
    });
    added++;
  });
  // Mazani (1.8.2026): jen vlastnik smi mazat, takze kdyz mam lokalne
  // zaznam s cloudId, ktere uz v aktualnim seznamu z cloudu neni, byl
  // smazan vlastnikem - smazat ho i tady.
  const remoteIds = new Set((rows||[]).map(r=>r.id));
  const beforeLen = list.length;
  list = list.filter(e=> !e.cloudId || remoteIds.has(e.cloudId));
  const removed = beforeLen - list.length;
  if(added || patched || removed){ try{ localStorage.setItem(key, JSON.stringify(list)); }catch(e){ console.error('msMergeCloudDiaryEntries', e); } }
  return added + removed;
}
function msDiaryEntryById(id){ return msDiary().find(e=>e.id===id); }
function msUpdateDiaryEntry(id, patch){
  const list = msDiary();
  const idx = list.findIndex(e=>e.id===id);
  if(idx===-1) return null;
  list[idx] = Object.assign({}, list[idx], patch);
  msSave(MS_KEYS.diary, list);
  return list[idx];
}
function msDeleteDiaryEntry(id){
  const entry = msDiary().find(e=>e.id===id);
  msSave(MS_KEYS.diary, msDiary().filter(e=>e.id!==id));
  if(entry && entry.cloudId && typeof MSCloud !== 'undefined' && MSCloud.deleteDiaryEntryCloud){
    MSCloud.deleteDiaryEntryCloud(entry.cloudId).catch(e=> console.error('cloud delete zapisu selhalo', e));
  }
}
// vsechny zapisy serazene chronologicky (od nejstarsiho) s prirazenym poradovym cislem - napric etapami, jak to ma skutecny stavebni denik
function msDiaryNumbered(){
  const sorted = msDiary().slice().sort((a,b)=>{
    const da = a.date + ' ' + (a.time||'00:00');
    const db = b.date + ' ' + (b.time||'00:00');
    return da.localeCompare(db);
  });
  return sorted.map((e,i)=> Object.assign({}, e, {number: i+1}));
}

/* ============================================================
   METADATA PRO GENEROVANI STAVEBNIHO DENIKU (titulni strana)
   ============================================================ */
function msDiaryMeta(){
  return msLoad('ms_diary_meta_v1', ()=>({
    nazev:null, misto:null, stavebnik:null, projektant:null,
    dozor:null, parcela:null, katastr:null, povoleni:null
  }));
}
function msSetDiaryMeta(patch){
  const next = Object.assign({}, msDiaryMeta(), patch);
  msSave('ms_diary_meta_v1', next);
  return next;
}
function msSeedDocuments(){
  return [];
}
function msSeedExpenses(){
  return [];
}

function msDiary(){ return msLoad(MS_KEYS.diary, msSeedDiary); }
function msDocuments(){
  const list = msLoad(MS_KEYS.documents, msSeedDocuments);
  return list.map(d=> Object.assign({}, d, { content: d.content || MS_BLOB_CACHE.get(msBlobKey('doc', d.id)) || null }));
}
async function msAddDocument(doc){
  const list = msLoad(MS_KEYS.documents, msSeedDocuments);
  const withId = Object.assign({id:msUid('doc'), date: msTodayISO()}, doc);
  const content = withId.content;
  delete withId.content;
  list.push(withId);
  const ok = msSave(MS_KEYS.documents, list);
  if(!ok) return null;
  if(content){
    MS_BLOB_CACHE.set(msBlobKey('doc', withId.id), content);
    try{
      await msIdbSet(msBlobKey('doc', withId.id), content); // pockat na dokonceni zapisu
    }catch(e){
      console.error('msAddDocument: zapis do IndexedDB selhal', e); // viz stejna oprava u msAddPhoto
    }
    // Krok 13: ticha synchronizace do cloudu na pozadi
    if(typeof MSCloud !== 'undefined'){
      MSCloud.uploadFile('documents', withId.id, content).catch(e=> console.error('cloud upload dokumentu selhal', e));
    }
  }
  // Obousmerne sdileni (1.8.2026) - "Dokumenty etap" zustavaji na svem
  // puvodnim lokalnim systemu (kvuli fronte do deniku a exportu PDF),
  // jen ted navic posilaji popisek obousmerne, stejny princip jako
  // Fotky/Projekt.
  if(typeof MSCloud !== 'undefined' && MSCloud.pushStageDocument){
    MSCloud.pushStageDocument(withId).then(({error, row})=>{
      if(error){ console.error('cloud push dokumentu etapy selhal', error); return; }
      if(row && row.id){
        const cur = msLoad(MS_KEYS.documents, msSeedDocuments);
        const idx = cur.findIndex(d=>d.id===withId.id);
        if(idx>-1){ cur[idx] = Object.assign({}, cur[idx], { cloudId: row.id }); msSave(MS_KEYS.documents, cur); }
      }
    }).catch(e=> console.error('cloud push dokumentu etapy selhal', e));
  }
  return Object.assign({}, withId, { content: content||null });
}
function msDeleteDocument(id){
  const doc = msDocuments().find(d=>d.id===id);
  msSave(MS_KEYS.documents, msDocuments().filter(d=>d.id!==id).map(d=>{ const c={...d}; delete c.content; return c; }));
  MS_BLOB_CACHE.delete(msBlobKey('doc', id));
  msIdbDelete(msBlobKey('doc', id));
  if(typeof MSCloud !== 'undefined'){
    MSCloud.deleteFile('documents', id).catch(()=>{});
    if(doc && doc.cloudId && MSCloud.deleteStageDocumentCloud){
      MSCloud.deleteStageDocumentCloud(doc.cloudId).catch(e=> console.error('cloud delete dokumentu etapy selhalo', e));
    }
  }
}
function msUpdateDocument(id, patch){
  const list = msLoad(MS_KEYS.documents, msSeedDocuments);
  const idx = list.findIndex(d=>d.id===id);
  if(idx===-1) return null;
  list[idx] = Object.assign({}, list[idx], patch);
  delete list[idx].content;
  msSave(MS_KEYS.documents, list);
  if(list[idx].cloudId && typeof MSCloud !== 'undefined' && MSCloud.updateStageDocumentCloud){
    MSCloud.updateStageDocumentCloud(list[idx].cloudId, { name: list[idx].name }).catch(e=> console.error('cloud update dokumentu etapy selhal', e));
  }
  return msDocuments().find(d=>d.id===id);
}
// Sloucení stažených dokumentu etap - stejny princip jako Fotky/Projekt
// (cloudId/local_id, obnova jmena/autora, mazani kdyz uz v cloudu neni).
function msMergeCloudStageDocuments(localProjectId, rows){
  const key = 'ms_documents_v1__' + localProjectId;
  let list = [];
  try{ list = JSON.parse(localStorage.getItem(key) || '[]'); }catch(e){}
  const cloudIdIndex = {};
  list.forEach((d,i)=>{ if(d.cloudId) cloudIdIndex[d.cloudId] = i; });
  const localIdIndex = {};
  list.forEach((d,i)=>{ localIdIndex[d.id] = i; });
  const newlyAdded = [];
  let patched = false;
  (rows||[]).forEach(row=>{
    if(cloudIdIndex.hasOwnProperty(row.id)){
      const idx = cloudIdIndex[row.id];
      const patch = {};
      if(list[idx].name !== row.name) patch.name = row.name;
      const newAuthor = row.added_by_label || 'Sdíleno';
      if(list[idx].author !== newAuthor) patch.author = newAuthor;
      if(Object.keys(patch).length){ list[idx] = Object.assign({}, list[idx], patch); patched = true; }
      return;
    }
    if(row.local_id && localIdIndex.hasOwnProperty(row.local_id)){
      const idx = localIdIndex[row.local_id];
      if(!list[idx].cloudId){ list[idx] = Object.assign({}, list[idx], { cloudId: row.id }); patched = true; }
      return;
    }
    const entry = {
      id: msUid('doc'), cloudId: row.id, name: row.name, stage: row.stage_key,
      mime: row.mime||null, isNote: !!row.is_note, date: (row.created_at||'').slice(0,10) || msTodayISO(),
      author: row.added_by_label || 'Sdíleno', sourceLocalId: row.local_id||null,
    };
    list.push(entry);
    newlyAdded.push(entry);
  });
  const remoteIds = new Set((rows||[]).map(r=>r.id));
  const toRemove = list.filter(d=> d.cloudId && !remoteIds.has(d.cloudId));
  if(toRemove.length){
    toRemove.forEach(d=>{
      const blobKey = msBlobKey('doc', d.id);
      MS_BLOB_CACHE.delete(blobKey);
      msIdbDelete(blobKey).catch(()=>{});
    });
    list = list.filter(d=> !(d.cloudId && !remoteIds.has(d.cloudId)));
  }
  if(newlyAdded.length || patched || toRemove.length){ try{ localStorage.setItem(key, JSON.stringify(list)); }catch(e){ console.error('msMergeCloudStageDocuments', e); } }
  return { newEntries: newlyAdded, removed: toRemove.length };
}
function msExpenses(){
  const list = msLoad(MS_KEYS.expenses, msSeedExpenses);
  return list.map(t=> t.hasReceipt ? Object.assign({}, t, { receipt: MS_BLOB_CACHE.get(msBlobKey('receipt', t.id)) || null }) : t);
}

/* --- pomocne funkce pro pocty a soucty podle etapy --- */
function msCountByStage(list, stageKey){ return list.filter(i=>i.stage===stageKey).length; }
function msSumExpensesByStage(stageKey){
  return msExpenses().filter(e=>e.stage===stageKey && e.type==='expense').reduce((sum,e)=>sum+Number(e.amount||0), 0);
}
function msTotalExpenses(){
  return msExpenses().filter(e=>e.type==='expense').reduce((s,e)=>s+Number(e.amount||0),0);
}
function msTotalIncome(){
  return msExpenses().filter(e=>e.type==='income').reduce((s,e)=>s+Number(e.amount||0),0);
}
function msBalance(){ return msTotalIncome() - msTotalExpenses(); }
// budouci (planovane) vydaje - nepocitaji se do skutecneho zustatku (jeste
// se nestaly), ale da se z nich spocitat, kolik by zbylo, kdyby se zaplatily
function msTotalPlanned(){
  return msExpenses().filter(e=>e.type==='planned').reduce((s,e)=>s+Number(e.amount||0),0);
}
function msBalanceAfterPlanned(){ return msBalance() - msTotalPlanned(); }
// prevede planovany vydaj na skutecny (kdyz uz je fakt zaplaceny)
function msMarkPlannedAsPaid(id, paidDateISO){
  return msUpdateTransaction(id, { type:'expense', date: paidDateISO || msTodayISO() });
}
// zaplati planovany vydaj - cely, nebo jen cast. Pri castecne platbe se
// zaplacena cast zauctuje jako skutecny vydaj a zbytek zustane planovany
// (se snizenou castkou).
function msPayPlanned(id, paidAmount){
  const list = msExpenses();
  const idx = list.findIndex(t=>t.id===id);
  if(idx===-1) return null;
  const planned = list[idx];
  const plannedAmount = Number(planned.amount||0);
  paidAmount = Number(paidAmount||0);
  if(paidAmount<=0) return null;
  if(paidAmount>=plannedAmount) return msMarkPlannedAsPaid(id);
  msAddTransaction({
    type:'expense', title: planned.title, amount: paidAmount,
    date: msTodayISO(), stage: planned.stage, category: planned.category,
  });
  return msUpdateTransaction(id, { amount: plannedAmount - paidAmount });
}
function msMonthExpenses(){
  const now = new Date();
  const ym = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  return msExpenses().filter(e=>e.type==='expense' && (e.date||'').startsWith(ym)).reduce((s,e)=>s+Number(e.amount||0),0);
}
function msAddTransaction(tx){
  const list = msExpenses();
  const withId = Object.assign({id:msUid('tx'), date: msTodayISO()}, tx);
  list.push(withId);
  msSave(MS_KEYS.expenses, list);
  // Obousmerne sdileni (1.8.2026): stejny vzor jako Denik - funguje
  // pro vlastnika i pro pozvaneho s pravem pridavat do Financi.
  if(typeof MSCloud !== 'undefined' && MSCloud.pushExpense){
    MSCloud.pushExpense(withId).then(({error, row})=>{
      if(error){ console.error('cloud push vydaje selhal', error); return; }
      if(row && row.id){
        const cur = msExpenses();
        const idx = cur.findIndex(x=>x.id===withId.id);
        if(idx>-1){ cur[idx] = Object.assign({}, cur[idx], { cloudId: row.id }); msSave(MS_KEYS.expenses, cur); }
      }
    }).catch(e=> console.error('cloud push vydaje selhal', e));
  }
  return withId;
}
// Sloucí (ne prepise) radky stazene z project_expenses podle cloudId
// NEBO local_id (viz stejna oprava u Deniku - local_id pozna vlastni
// zaznam i predtim, nez se stihne dopsat cloudId, a zabrani duplicitam
// pri souběhu s pravidelnou kontrolou). Vraci pocet novych zaznamu.
function msMergeCloudExpenses(localProjectId, rows){
  const key = 'ms_expenses_v1__' + localProjectId;
  let list = [];
  try{ list = JSON.parse(localStorage.getItem(key) || '[]'); }catch(e){}
  const cloudIdIndex = {};
  list.forEach((e,i)=>{ if(e.cloudId) cloudIdIndex[e.cloudId] = i; });
  const localIdIndex = {};
  list.forEach((e,i)=>{ localIdIndex[e.id] = i; });
  let added = 0, patched = false;
  (rows||[]).forEach(row=>{
    if(cloudIdIndex.hasOwnProperty(row.id)){
      const idx = cloudIdIndex[row.id];
      const newAuthor = row.added_by_label || 'Sdíleno';
      if(list[idx].author !== newAuthor){ list[idx] = Object.assign({}, list[idx], { author: newAuthor }); patched = true; }
      return;
    }
    if(row.local_id && localIdIndex.hasOwnProperty(row.local_id)){
      const idx = localIdIndex[row.local_id];
      if(!list[idx].cloudId){ list[idx] = Object.assign({}, list[idx], { cloudId: row.id }); patched = true; }
      return;
    }
    list.push({
      id: msUid('tx'), cloudId: row.id,
      type: row.type, title: row.title, amount: row.amount, date: row.date,
      stage: row.stage, category: row.category, author: row.added_by_label || 'Sdíleno',
    });
    added++;
  });
  // Mazani (1.8.2026) - viz stejny princip v msMergeCloudDiaryEntries.
  const remoteIds = new Set((rows||[]).map(r=>r.id));
  const beforeLen = list.length;
  list = list.filter(e=> !e.cloudId || remoteIds.has(e.cloudId));
  const removed = beforeLen - list.length;
  if(added || patched || removed){ try{ localStorage.setItem(key, JSON.stringify(list)); }catch(e){ console.error('msMergeCloudExpenses', e); } }
  return added + removed;
}
function msUpdateTransaction(id, patch){
  const list = msExpenses();
  const idx = list.findIndex(t=>t.id===id);
  if(idx===-1) return null;
  list[idx] = Object.assign({}, list[idx], patch);
  msSave(MS_KEYS.expenses, list);
  return list[idx];
}
function msDeleteTransaction(id){
  const tx = msExpenses().find(t=>t.id===id);
  msSave(MS_KEYS.expenses, msExpenses().filter(t=>t.id!==id));
  MS_BLOB_CACHE.delete(msBlobKey('receipt', id));
  msIdbDelete(msBlobKey('receipt', id));
  if(tx && tx.cloudId && typeof MSCloud !== 'undefined' && MSCloud.deleteExpenseCloud){
    MSCloud.deleteExpenseCloud(tx.cloudId).catch(e=> console.error('cloud delete vydaje selhalo', e));
  }
}
function msTransactionById(id){
  return msExpenses().find(t=>t.id===id);
}
// ucteka - jedna fotka pripojena primo k jednomu konkretnimu vydaji.
// Obsah jde do IndexedDB stejne jako fotky/dokumenty, v localStorage
// zustane jen priznak hasReceipt.
async function msSetTransactionReceipt(id, dataUrl){
  const list = msLoad(MS_KEYS.expenses, msSeedExpenses);
  const idx = list.findIndex(t=>t.id===id);
  if(idx===-1) return false;
  const resized = await msResizeDataUrl(dataUrl, 1400, 0.75);
  const key = msBlobKey('receipt', id);
  MS_BLOB_CACHE.set(key, resized);
  try{
    await msIdbSet(key, resized);
  }catch(e){
    console.error('msSetTransactionReceipt: zapis do IndexedDB selhal', e); // viz stejna oprava u msAddPhoto
  }
  // Krok 13: ticha synchronizace do cloudu na pozadi
  if(typeof MSCloud !== 'undefined'){
    MSCloud.uploadFile('receipts', id, resized).catch(e=> console.error('cloud upload uctenky selhal', e));
  }
  list[idx] = Object.assign({}, list[idx], { hasReceipt: true });
  msSave(MS_KEYS.expenses, list);
  return true;
}
function msRemoveTransactionReceipt(id){
  const list = msLoad(MS_KEYS.expenses, msSeedExpenses);
  const idx = list.findIndex(t=>t.id===id);
  if(idx===-1) return;
  list[idx] = Object.assign({}, list[idx], { hasReceipt: false });
  msSave(MS_KEYS.expenses, list);
  MS_BLOB_CACHE.delete(msBlobKey('receipt', id));
  msIdbDelete(msBlobKey('receipt', id));
  if(typeof MSCloud !== 'undefined'){ MSCloud.deleteFile('receipts', id).catch(()=>{}); }
}
function msStageStats(stageKey){
  return {
    photos: msCountByStage(msPhotos(), stageKey),
    documents: msCountByStage(msDocuments(), stageKey),
    diary: msCountByStage(msDiary(), stageKey),
    expensesCount: msExpenses().filter(e=>e.stage===stageKey && e.type==='expense').length,
    spent: msSumExpensesByStage(stageKey),
    important: msCountByStage(msImportant(), stageKey),
  };
}

/* ============================================================
   AKTUÁLNÍ ETAPA V ČASE
   - ktera etapa je prave "aktualni" (jen jedna v ramci projektu)
   - pro kazdou etapu si pamatujeme MNOZINU dnu, kdy byla aktualni
     (den se pocita, i kdyz byla aktualni treba jen minutu - proto
     mnozina dat, ne casovy rozsah)
   - "Zahajeno" = nejstarsi den v teto mnozine
   - "Den etapy" = pocet dnu v teto mnozine (ne rozdil dat!)
   ============================================================ */
const MS_CURRENT_STAGE_KEY = 'ms_current_stage_v1';
const MS_ACTIVE_DAYS_KEY = 'ms_stage_active_days_v1';

function msTodayISO(){
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function msAddDays(n){
  const d = new Date(); d.setDate(d.getDate()+n);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

function msSeedActiveDays(){
  return {};
}
function msLoadActiveDaysMap(){
  return msLoad(MS_ACTIVE_DAYS_KEY, msSeedActiveDays);
}
function msSaveActiveDaysMap(map){ msSave(MS_ACTIVE_DAYS_KEY, map); }

function msGetCurrentStage(){
  const v = msLoad(MS_CURRENT_STAGE_KEY, ()=>null);
  if(v) return v;
  const selected = msSelectedStageKeys();
  return selected.length ? selected[0] : null;
}

// pripocita dnesni den do mnoziny aktivnich dnu dane etapy (bez ohledu na
// to, kolikrat/jak kratce se to za den stane - den se pocita jen jednou)
function msRecordActiveDay(key){
  if(!key) return;
  const map = msLoadActiveDaysMap();
  const today = msTodayISO();
  if(!map[key]) map[key] = [];
  if(!map[key].includes(today)) map[key].push(today);
  msSaveActiveDaysMap(map);
}

// nastavi etapu jako aktualni a pripocita dnesni den do jeji mnoziny aktivnich dnu
function msSetCurrentStage(key){
  msSave(MS_CURRENT_STAGE_KEY, key);
  msAddSelectedStage(key);
  msRecordActiveDay(key);
  msTriggerCloudSnapshotSync();
}

// zavola se pri kazdem startu appky: pokud uz nejaka etapa aktualni je,
// pripocita se ji dnesni den (bez tohohle by se "Den etapy" po prvnim
// oznaceni uz nikdy nehnul - viz historie: drive se den pripsal jen v
// momente kliknuti na "nastavit jako aktualni", ne kazdy dalsi den, kdy
// etapa aktualni zustavala)
function msEnsureCurrentStageDayRecorded(){
  const key = msGetCurrentStage();
  if(key) msRecordActiveDay(key);
}

function msStageActiveDays(key){
  const map = msLoadActiveDaysMap();
  return (map[key] || []).slice().sort();
}
function msStageZahajeno(key){
  const days = msStageActiveDays(key);
  return days.length ? days[0] : null;
}
function msStageDenEtapy(key){
  return msStageActiveDays(key).length;
}
// 'aktualni' | 'probiha' | 'nezahajeno'
const MS_CLOSED_STAGES_KEY = 'ms_closed_stages_v1';
function msClosedStageKeys(){ return msLoad(MS_CLOSED_STAGES_KEY, ()=>[]); }
function msIsStageClosed(key){ return msClosedStageKeys().includes(key); }
function msSetStageClosed(key, closed){
  const keys = msClosedStageKeys();
  const has = keys.includes(key);
  if(closed && !has){ keys.push(key); if(key!=='naradi') msQueueForDiary('stage_complete', key); }
  if(!closed && has) keys.splice(keys.indexOf(key), 1);
  msSave(MS_CLOSED_STAGES_KEY, keys);
  msTriggerCloudSnapshotSync();
}
// 'uzavrena' ma prednost pred vsim ostatnim - je to jen status, dal se do etapy da cokoliv pridavat
function msStageStatus(key){
  if(msIsStageClosed(key)) return 'uzavrena';
  if(msGetCurrentStage() === key) return 'aktualni';
  return msStageActiveDays(key).length > 0 ? 'probiha' : 'nezahajeno';
}
function msStageStatusLabel(key){
  const s = msStageStatus(key);
  if(s==='uzavrena') return 'Dokončeno';
  if(s==='aktualni') return 'Aktuální';
  if(s==='probiha') return 'Probíhá';
  return 'Nezahájeno';
}

/* ============================================================
   NABÍDKY A DŮLEŽITÉ (zakladni model, plna obrazovka prijde pozdeji)
   ============================================================ */
function msSeedOffers(){
  return [];
}
function msSeedImportant(){
  return [];
}
function msAddImportant(item){
  const list = msImportant();
  const withId = Object.assign({id:msUid('imp'), date: msTodayISO()}, item);
  list.push(withId);
  msSave('ms_important_v1', list);
  return withId;
}

/* ============================================================
   VLASTNÍ POŘADÍ ETAP (tažením za "..." v přehledu etap)
   - aktuální etapa se pri vykresleni vzdy da navrch zvlast,
     tohle uchovava jen poradi TĚCH OSTATNÍCH
   ============================================================ */
const MS_STAGE_ORDER_KEY = 'ms_stage_order_v1';
function msStageOrder(){ return msLoad(MS_STAGE_ORDER_KEY, ()=>MS_STAGES.map(s=>s.key)); }
function msSetStageOrder(orderKeys){ msSave(MS_STAGE_ORDER_KEY, orderKeys); msTriggerCloudSnapshotSync(); }
// vrati kompletni serazeny seznam klicu etap: aktualni prvni, pak zbytek podle ulozeneho poradi
function msOrderedStageKeys(){
  const selected = msSelectedStageKeys();
  if(selected.length===0) return [];
  const cur = msGetCurrentStage();
  const order = msStageOrder().filter(k => k !== cur && selected.includes(k));
  selected.forEach(k=>{ if(k!==cur && !order.includes(k)) order.push(k); });
  return selected.includes(cur) ? [cur, ...order] : order;
}
function msOffers(){ return msLoad('ms_offers_v1', msSeedOffers); }
function msImportant(){ return msLoad('ms_important_v1', msSeedImportant); }

/* --- poslednich N zaznamu dane etapy, serazeno od nejnovejsiho --- */
function msLastN(list, stageKey, n){
  return list.filter(i=>i.stage===stageKey).sort((a,b)=> (b.date||'').localeCompare(a.date||'')).slice(0,n);
}
function msLastPhotos(key,n){ return msLastN(msPhotos(), key, n); }
function msLastDiary(key,n){ return msLastN(msDiary(), key, n); }
function msLastExpenses(key,n){ return msLastN(msExpenses(), key, n); }
function msLastDocuments(key,n){ return msLastN(msDocuments(), key, n); }
// Nabidky a Dulezite (1.8.2026) - presunuty na stejny system slozek/
// souboru jako "Projekt" (scope 'nabidky'/'dulezite' na dane etape),
// misto puvodnich samostatnych, jednodussich seznamu.
function msProjectItemsForScope(scope, stageKey){
  return msLoadProjectItems().filter(it=> it.scope===scope && (it.stageKey||null)===(stageKey||null));
}
function msProjectFoldersForScope(scope, stageKey){
  return msLoadProjectFolders().filter(f=> f.scope===scope && (f.stageKey||null)===(stageKey||null));
}
function msLastOffers(key,n){ return msProjectItemsForScope('nabidky', key).slice(-n).reverse(); }
function msLastImportant(key,n){ return msProjectItemsForScope('dulezite', key).slice(-n).reverse(); }
function msPhotos(){
  const list = msLoad(MS_KEYS.photos, msSeedPhotos);
  return list.map(p=> Object.assign({}, p, { thumb: p.thumb || MS_BLOB_CACHE.get(msBlobKey('photo', p.id)) || null }));
}
async function msAddPhoto(photo){
  const list = msLoad(MS_KEYS.photos, msSeedPhotos);
  const withId = Object.assign({id:msUid('ph'), date: msTodayISO()}, photo);
  const thumb = withId.thumb;
  delete withId.thumb; // obrazek samotny jde do IndexedDB, ne do localStorage
  list.push(withId);
  const ok = msSave(MS_KEYS.photos, list);
  if(!ok) return null;
  if(thumb){
    MS_BLOB_CACHE.set(msBlobKey('photo', withId.id), thumb);
    try{
      await msIdbSet(msBlobKey('photo', withId.id), thumb); // POCKAT na dokonceni zapisu, ne fire-and-forget
    }catch(e){
      // OPRAVA (31.7.2026): zapis do IndexedDB obcas selze (znamy problem
      // hlavne na iOS pri vytizeni pameti) - fotka zustava aspon v pametove
      // kesi pro tuhle relaci appky, ale hlavne tahle chyba NESMI shodit
      // cokoli, co na msAddPhoto() navazuje (napr. cely formular zapisu do
      // Deniku ceka pres Promise.all na VSECHNY fotky - jedna nepovedena
      // fotka by jinak potichu zastavila i samotne ulozeni zapisu).
      console.error('msAddPhoto: zapis do IndexedDB selhal', e);
    }
    // Krok 13: ticha synchronizace do cloudu na pozadi (nic neblokuje,
    // nikdy appku nezastavi - vypadek site na stavbe je bezny stav)
    if(typeof MSCloud !== 'undefined'){
      MSCloud.uploadFile('photos', withId.id, thumb).catch(e=> console.error('cloud upload fotky selhal', e));
    }
  }
  // Obousmerne sdileni popisku (1.8.2026) - stejny princip jako
  // Denik/Finance, funguje pro vlastnika i pro pozvaneho s pravem
  // pridavat fotky.
  if(typeof MSCloud !== 'undefined' && MSCloud.pushPhotoMeta){
    MSCloud.pushPhotoMeta(withId).then(({error, row})=>{
      if(error){ console.error('cloud push popisku fotky selhal', error); return; }
      if(row && row.id){
        const cur = msLoad(MS_KEYS.photos, msSeedPhotos);
        const idx = cur.findIndex(p=>p.id===withId.id);
        if(idx>-1){ cur[idx] = Object.assign({}, cur[idx], { cloudId: row.id }); msSave(MS_KEYS.photos, cur); }
      }
    }).catch(e=> console.error('cloud push popisku fotky selhal', e));
  }
  return Object.assign({}, withId, { thumb: thumb||null });
}
// Sloucí (ne prepise) popisky fotek stazene z project_photos_meta,
// stejny princip jako u Deniku/Financi (cloudId nebo local_id pro
// poznani vlastniho zaznamu). Vraci seznam NOVE pridanych zaznamu
// (ne jen pocet) - volajici pak podle nich vi, ktere fotky jeste
// potrebuji stahnout i se samotnym obrazkem.
function msMergeCloudPhotosMeta(localProjectId, rows){
  const key = 'ms_photos_v1__' + localProjectId;
  let list = [];
  try{ list = JSON.parse(localStorage.getItem(key) || '[]'); }catch(e){}
  const existingCloudIds = new Set(list.filter(p=>p.cloudId).map(p=>p.cloudId));
  const localIdIndex = {};
  list.forEach((p,i)=>{ localIdIndex[p.id] = i; });
  const newlyAdded = [];
  let patched = false;
  (rows||[]).forEach(row=>{
    if(existingCloudIds.has(row.id)) return;
    if(row.local_id && localIdIndex.hasOwnProperty(row.local_id)){
      const idx = localIdIndex[row.local_id];
      if(!list[idx].cloudId){ list[idx] = Object.assign({}, list[idx], { cloudId: row.id }); patched = true; }
      return;
    }
    const entry = {
      id: msUid('ph'), cloudId: row.id, date: row.date,
      stage: row.stage, caption: row.caption || null,
      // DULEZITE: soubor v cloudovem uloziste je ulozeny pod PUVODNIM
      // local_id (to, co uzivatel mel na svem telefonu v okamziku
      // nahrani - viz MSCloud.uploadFile), NE pod cloudId (to je jen
      // ID radku v databazi, uplne jiny identifikator). Bez tohohle
      // by appka hledala soubor na spatne "adrese" a nikdy ho nenasla.
      sourceLocalId: row.local_id || null,
    };
    list.push(entry);
    newlyAdded.push(entry);
  });
  // Mazani (1.8.2026) - viz stejny princip v msMergeCloudDiaryEntries.
  // U fotek navic uklidime i stazeny obrazek (kes + IndexedDB), at po
  // sobe appka nenechava osirele soubory.
  const remoteIds = new Set((rows||[]).map(r=>r.id));
  const toRemove = list.filter(p=> p.cloudId && !remoteIds.has(p.cloudId));
  if(toRemove.length){
    toRemove.forEach(p=>{
      const blobKey = 'photo_' + p.id + '__' + localProjectId;
      MS_BLOB_CACHE.delete(blobKey);
      msIdbDelete(blobKey).catch(()=>{});
    });
    list = list.filter(p=> !(p.cloudId && !remoteIds.has(p.cloudId)));
  }
  if(newlyAdded.length || patched || toRemove.length){ try{ localStorage.setItem(key, JSON.stringify(list)); }catch(e){ console.error('msMergeCloudPhotosMeta', e); } }
  return { newEntries: newlyAdded, removed: toRemove.length };
}
function msUpdatePhoto(id, patch){
  const list = msLoad(MS_KEYS.photos, msSeedPhotos);
  const idx = list.findIndex(p=>p.id===id);
  if(idx===-1) return null;
  list[idx] = Object.assign({}, list[idx], patch);
  delete list[idx].thumb;
  msSave(MS_KEYS.photos, list);
  return msPhotos().find(p=>p.id===id);
}
function msDeletePhoto(id){
  const photo = msLoad(MS_KEYS.photos, msSeedPhotos).find(p=>p.id===id);
  msSave(MS_KEYS.photos, msLoad(MS_KEYS.photos, msSeedPhotos).filter(p=>p.id!==id));
  MS_BLOB_CACHE.delete(msBlobKey('photo', id));
  msIdbDelete(msBlobKey('photo', id));
  if(typeof MSCloud !== 'undefined'){
    MSCloud.deleteFile('photos', id).catch(()=>{});
    if(photo && photo.cloudId && MSCloud.deletePhotoMetaCloud){
      MSCloud.deletePhotoMetaCloud(photo.cloudId).catch(e=> console.error('cloud delete popisku fotky selhalo', e));
    }
  }
}

/* ============================================================
   ZAKLADNI METADATA PROJEKTU (plocha pozemku, zastavena plocha, typ)
   ============================================================ */
function msProjectMeta(){
  return msLoad('ms_project_meta_v1', ()=>({landArea:null, builtArea:null, type:null}));
}
function msSetProjectMeta(patch){
  const next = Object.assign({}, msProjectMeta(), patch);
  msSave('ms_project_meta_v1', next);
  return next;
}

/* ============================================================
   PROJEKT - SLOZKY A SOUBORY (1.8.2026, prestavba)
   Puvodni verze hledala slozky podle "cesty jmen" (napr. ["Smlouvy"]) -
   nespolehlive pri sdileni (jmena se musela presne shodovat na obou
   zarizenich). Nova verze: slozky maji STALE ID, stejne jako uz davno
   maji fotky a soubory - appka se pta "kam patri tohle ID", ne "jak se
   jmenuje ta slozka". Slozky zaklada/mate/prejmenovava JEN vlastnik
   (stejne pravidlo jako u etap - pozvany vybira z existujicich).
   Soubory uvnitr pridavaji OBA smery, obousmerne (stejny princip jako
   Denik/Finance/Fotky).
   ============================================================ */
function msLoadProjectFolders(){ return msLoad('ms_project_folders_v1', () => ([])); }
function msSaveProjectFolders(list){ msSave('ms_project_folders_v1', list); }
function msLoadProjectItems(){ return msLoad('ms_project_items_v1', () => ([])); }
function msSaveProjectItems(list){ msSave('ms_project_items_v1', list); }

function msAddProjectFolder(name, parentId, scope, stageKey){
  const list = msLoadProjectFolders();
  const withId = { id: msUid('pf'), parentId: parentId||null, name, cloudId: null, scope: scope||'projekt', stageKey: stageKey||null };
  list.push(withId);
  msSaveProjectFolders(list);
  if(typeof MSCloud !== 'undefined' && MSCloud.pushProjectFolder){
    MSCloud.pushProjectFolder(withId).then(({error, row})=>{
      if(error){ console.error('cloud push slozky selhal', error); return; }
      if(row && row.id){
        const cur = msLoadProjectFolders();
        const idx = cur.findIndex(f=>f.id===withId.id);
        if(idx>-1){ cur[idx] = Object.assign({}, cur[idx], { cloudId: row.id }); msSaveProjectFolders(cur); }
      }
    }).catch(e=> console.error('cloud push slozky selhal', e));
  }
  return withId;
}
function msRenameProjectFolder(id, name){
  const list = msLoadProjectFolders();
  const idx = list.findIndex(f=>f.id===id);
  if(idx===-1) return;
  list[idx] = Object.assign({}, list[idx], { name });
  msSaveProjectFolders(list);
  if(list[idx].cloudId && typeof MSCloud !== 'undefined' && MSCloud.updateProjectFolderCloud){
    MSCloud.updateProjectFolderCloud(list[idx].cloudId, name).catch(e=> console.error('cloud rename slozky selhalo', e));
  }
}
function msRenameProjectItem(id, name){
  const list = msLoadProjectItems();
  const idx = list.findIndex(it=>it.id===id);
  if(idx===-1) return;
  list[idx] = Object.assign({}, list[idx], { name });
  msSaveProjectItems(list);
  if(list[idx].cloudId && typeof MSCloud !== 'undefined' && MSCloud.updateProjectItemCloud){
    MSCloud.updateProjectItemCloud(list[idx].cloudId, name).catch(e=> console.error('cloud rename souboru selhalo', e));
  }
}

function msDeleteProjectFolder(id){
  // Smaze slozku a VSECHNY jeji potomky (vnorene slozky i soubory v nich) -
  // stejne jako kaskadove mazani v databazi (on delete cascade).
  const folders = msLoadProjectFolders();
  const items = msLoadProjectItems();
  const toDeleteFolderIds = new Set([id]);
  let grew = true;
  while(grew){
    grew = false;
    folders.forEach(f=>{ if(f.parentId && toDeleteFolderIds.has(f.parentId) && !toDeleteFolderIds.has(f.id)){ toDeleteFolderIds.add(f.id); grew = true; } });
  }
  const deletedFolder = folders.find(f=>f.id===id);
  const remainingFolders = folders.filter(f=> !toDeleteFolderIds.has(f.id));
  const deletedItems = items.filter(it=> toDeleteFolderIds.has(it.folderId));
  const remainingItems = items.filter(it=> !toDeleteFolderIds.has(it.folderId));
  msSaveProjectFolders(remainingFolders);
  msSaveProjectItems(remainingItems);
  deletedItems.forEach(it=>{
    const key = msBlobKey('pitem', it.id);
    MS_BLOB_CACHE.delete(key);
    msIdbDelete(key).catch(()=>{});
  });
  if(typeof MSCloud !== 'undefined' && deletedFolder && deletedFolder.cloudId && MSCloud.deleteProjectFolderCloud){
    // Kaskadove smazani v databazi (on delete cascade) se postara i o
    // vsechny vnorene slozky/soubory na serveru - staci smazat jen tu
    // hlavni.
    MSCloud.deleteProjectFolderCloud(deletedFolder.cloudId).catch(e=> console.error('cloud delete slozky selhalo', e));
  }
}

async function msAddProjectItem({ name, mime, isNote, folderId, content, scope, stageKey }){
  const list = msLoadProjectItems();
  const id = msUid('pitem');
  const withId = { id, folderId, name, mime: mime||null, isNote: !!isNote, cloudId: null, author: null, scope: scope||'projekt', stageKey: stageKey||null };
  if(content){
    const key = msBlobKey('pitem', id);
    MS_BLOB_CACHE.set(key, content);
    await msIdbSet(key, content);
    if(typeof MSCloud !== 'undefined'){
      MSCloud.uploadFile('projectitems', id, content).catch(e=> console.error('cloud upload souboru z Projekt selhal', e));
    }
  }
  list.push(withId);
  msSaveProjectItems(list);
  if(typeof MSCloud !== 'undefined' && MSCloud.pushProjectItem){
    MSCloud.pushProjectItem(withId).then(({error, row})=>{
      if(error){ console.error('cloud push souboru z Projekt selhal', error); return; }
      if(row && row.id){
        const cur = msLoadProjectItems();
        const idx = cur.findIndex(it=>it.id===id);
        if(idx>-1){ cur[idx] = Object.assign({}, cur[idx], { cloudId: row.id }); msSaveProjectItems(cur); }
      }
    }).catch(e=> console.error('cloud push souboru z Projekt selhal', e));
  }
  return withId;
}
function msDeleteProjectItem(id){
  const items = msLoadProjectItems();
  const item = items.find(it=>it.id===id);
  msSaveProjectItems(items.filter(it=>it.id!==id));
  const key = msBlobKey('pitem', id);
  MS_BLOB_CACHE.delete(key);
  msIdbDelete(key).catch(()=>{});
  if(typeof MSCloud !== 'undefined'){
    MSCloud.deleteFile('projectitems', id).catch(()=>{});
    if(item && item.cloudId && MSCloud.deleteProjectItemCloud){
      MSCloud.deleteProjectItemCloud(item.cloudId).catch(e=> console.error('cloud delete souboru z Projekt selhalo', e));
    }
  }
}

// Sloucení stažených řádků (slozky i soubory) - stejny princip jako u
// Deniku/Financi/Fotek: cloudId nebo local_id pro poznani vlastniho
// zaznamu, a mazani kdyz uz zaznam v cloudu neni (jen vlastnik maze).
function msMergeCloudProjectFolders(localProjectId, rows){
  const key = 'ms_project_folders_v1__' + localProjectId;
  let list = [];
  try{ list = JSON.parse(localStorage.getItem(key) || '[]'); }catch(e){}
  const cloudIdIndex = {};
  list.forEach((f,i)=>{ if(f.cloudId) cloudIdIndex[f.cloudId] = i; });
  const localIdIndex = {};
  list.forEach((f,i)=>{ localIdIndex[f.id] = i; });
  // Cloud ID -> lokalni ID (pro spravne namapovani parentId po sloucení)
  const cloudToLocal = {};
  list.forEach(f=>{ if(f.cloudId) cloudToLocal[f.cloudId] = f.id; });
  let added = 0, patched = false;
  const newFolders = [];
  (rows||[]).forEach(row=>{
    if(cloudIdIndex.hasOwnProperty(row.id)){
      // Prejmenovani z jineho zarizeni se ted taky propise, ne jen prvni nazev.
      const idx = cloudIdIndex[row.id];
      if(list[idx].name !== row.name){ list[idx] = Object.assign({}, list[idx], { name: row.name }); patched = true; }
      return;
    }
    if(row.local_id && localIdIndex.hasOwnProperty(row.local_id)){
      const idx = localIdIndex[row.local_id];
      if(!list[idx].cloudId){ list[idx] = Object.assign({}, list[idx], { cloudId: row.id }); patched = true; cloudToLocal[row.id] = list[idx].id; }
      return;
    }
    const entry = { id: msUid('pf'), cloudId: row.id, parentId: null, name: row.name, scope: row.scope||'projekt', stageKey: row.stage_key||null, sourceParentCloudId: row.parent_id||null };
    list.push(entry);
    newFolders.push(entry);
    cloudToLocal[row.id] = entry.id;
    added++;
  });
  // Druhy pruchod: namapovat parentId z cloud-parent-id na lokalni id
  // (rodicovska slozka uz musi byt bud existujici, nebo prave pridana vyse)
  newFolders.forEach(entry=>{
    if(entry.sourceParentCloudId && cloudToLocal[entry.sourceParentCloudId]){
      entry.parentId = cloudToLocal[entry.sourceParentCloudId];
    }
    delete entry.sourceParentCloudId;
  });
  const remoteIds = new Set((rows||[]).map(r=>r.id));
  const beforeLen = list.length;
  list = list.filter(f=> !f.cloudId || remoteIds.has(f.cloudId));
  const removed = beforeLen - list.length;
  if(added || patched || removed){ try{ localStorage.setItem(key, JSON.stringify(list)); }catch(e){ console.error('msMergeCloudProjectFolders', e); } }
  return added + removed;
}
function msMergeCloudProjectItems(localProjectId, rows){
  const folderKey = 'ms_project_folders_v1__' + localProjectId;
  let folders = [];
  try{ folders = JSON.parse(localStorage.getItem(folderKey) || '[]'); }catch(e){}
  const cloudFolderToLocal = {};
  folders.forEach(f=>{ if(f.cloudId) cloudFolderToLocal[f.cloudId] = f.id; });

  const key = 'ms_project_items_v1__' + localProjectId;
  let list = [];
  try{ list = JSON.parse(localStorage.getItem(key) || '[]'); }catch(e){}
  const cloudIdIndex = {};
  list.forEach((it,i)=>{ if(it.cloudId) cloudIdIndex[it.cloudId] = i; });
  const localIdIndex = {};
  list.forEach((it,i)=>{ localIdIndex[it.id] = i; });
  const newlyAdded = [];
  let patched = false;
  (rows||[]).forEach(row=>{
    if(cloudIdIndex.hasOwnProperty(row.id)){
      // OPRAVA (1.8.2026): drive appka takovy zaznam jen preskocila -
      // kdyz si vlastnik pozdeji zmenil jmeno pozvaneho, uz stazene
      // polozky si to jmeno nikdy nedotahly. Ted se obnovi vzdy.
      const idx = cloudIdIndex[row.id];
      const newAuthor = row.added_by_label || 'Sdíleno';
      if(list[idx].author !== newAuthor){ list[idx] = Object.assign({}, list[idx], { author: newAuthor }); patched = true; }
      return;
    }
    if(row.local_id && localIdIndex.hasOwnProperty(row.local_id)){
      const idx = localIdIndex[row.local_id];
      if(!list[idx].cloudId){ list[idx] = Object.assign({}, list[idx], { cloudId: row.id }); patched = true; }
      return;
    }
    const localFolderId = row.folder_id ? cloudFolderToLocal[row.folder_id] : null;
    if(row.folder_id && !localFolderId) return; // slozka jeste nedorazila - preskocit, priste to dozeneme
    const entry = {
      id: msUid('pitem'), cloudId: row.id, folderId: localFolderId||null,
      name: row.name, mime: row.mime||null, isNote: !!row.is_note,
      author: row.added_by_label || 'Sdíleno', sourceLocalId: row.local_id||null,
      scope: row.scope||'projekt', stageKey: row.stage_key||null,
    };
    list.push(entry);
    newlyAdded.push(entry);
  });
  const remoteIds = new Set((rows||[]).map(r=>r.id));
  const toRemove = list.filter(it=> it.cloudId && !remoteIds.has(it.cloudId));
  if(toRemove.length){
    toRemove.forEach(it=>{
      const blobKey = msBlobKey('pitem', it.id);
      MS_BLOB_CACHE.delete(blobKey);
      msIdbDelete(blobKey).catch(()=>{});
    });
    list = list.filter(it=> !(it.cloudId && !remoteIds.has(it.cloudId)));
  }
  if(newlyAdded.length || patched || toRemove.length){ try{ localStorage.setItem(key, JSON.stringify(list)); }catch(e){ console.error('msMergeCloudProjectItems', e); } }
  return { newEntries: newlyAdded, removed: toRemove.length };
}

/* ============================================================
   PROJEKTY (spravovano centralne - pouziva Dashboard, Onboarding i Nastaveni)
   ============================================================ */
const MS_PROJECTS_KEY = 'ms_projects_v1';
const MS_ACTIVE_PROJECT_KEY = 'ms_active_project_v1';
const MS_ONBOARDED_KEY = 'ms_onboarded_v1';

function msDefaultProjects(){ return []; } // bez onboardingu zadny projekt neexistuje
function msLoadProjects(){
  try{
    const raw = localStorage.getItem(MS_PROJECTS_KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){}
  return msDefaultProjects();
}
function msSaveProjects(list){ try{ localStorage.setItem(MS_PROJECTS_KEY, JSON.stringify(list)); }catch(e){} }
function msGetActiveProjectId(){
  try{ return localStorage.getItem(MS_ACTIVE_PROJECT_KEY) || null; }catch(e){ return null; }
}
function msSetActiveProjectId(id){ try{ localStorage.setItem(MS_ACTIVE_PROJECT_KEY, id); }catch(e){} }

/* ============================================================
   PRAVA PODLE SEKCE (1.8.2026) - vlastnik vidi/prida vzdy vsechno.
   Pozvany: "vidi sektor X" = ma X zaskrtnuty v sections (bez ohledu
   na can_add). "muze pridavat v sektoru X" = navic ma can_add=true.
   Klice sektoru: finance, denik, etapy, projekt, kalendar, fotky -
   "etapy" pokryva konkretne Nabidky/Dulezite/Dokumenty etap, samotny
   detail etapy (nazev, foto, aktualni/dokoncit) zustava vzdy viditelny.
   ============================================================ */
function msActiveProjectForRights(){
  return msLoadProjects().find(p=>p.id===msGetActiveProjectId());
}
function msCanViewSection(sectionKey){
  const p = msActiveProjectForRights();
  if(!p) return true;
  if(!p.isShared) return true; // vlastni projekt - vzdy vse
  if(!p.mySections) return true; // jeste nestazeno / stary zaznam - radeji neomezovat, nez omylem schovat vse
  return !!p.mySections[sectionKey];
}
function msCanAddSection(sectionKey){
  const p = msActiveProjectForRights();
  if(!p) return true;
  if(!p.isShared) return true;
  if(!p.myCanAdd) return false;
  return msCanViewSection(sectionKey);
}

/* ============================================================
   ZAMEK MISTO MIZENI (2.8.2026) - misto aby appka casti UI, do
   kterych pozvany nema pristup, uplne schovala, appka je necha na
   miste jako zamcene (velky zamek, obsah pod nim skryty). Kliknuti
   na cokoli zamceneho appka nikam neposle a jen ukaze hlasku.
   ============================================================ */
function msShowAccessDenied(){
  alert('Nemáš do téhle části přístup. Obrať se na správce stavby.');
}
// SVG zamku pouzity vsude stejne, at je to appce vizualne konzistentni.
function msLockIconSvg(size){
  size = size || 20;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="10" rx="1"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>`;
}

function msHasOnboarded(){
  try{ return localStorage.getItem(MS_ONBOARDED_KEY) === '1'; }catch(e){ return false; }
}
function msSetOnboarded(){ try{ localStorage.setItem(MS_ONBOARDED_KEY, '1'); }catch(e){} }

// Zamek appky (Face ID / bez zamku). Skutecne biometricke overovani jde
// spolehlive napojit az v nativne zabalene appce (viz diskuze o formatu) -
// zatim se jen uklada volba uzivatele, at je na to UI uz pripravene.
const MS_APP_LOCK_KEY = 'ms_app_lock_v1';
function msGetAppLock(){
  try{ return localStorage.getItem(MS_APP_LOCK_KEY) || null; }catch(e){ return null; }
}
function msSetAppLock(mode){ try{ localStorage.setItem(MS_APP_LOCK_KEY, mode); }catch(e){} }

// Posledni pouzity e-mail pro prihlaseni (Premium/sdileni) - zarizeni-uroven,
// NENI projektove-scoped (clovek se prihlasuje jednou pro cely telefon, ne
// zvlast pro kazdy projekt). Viz Premium-sdileni-specifikace.md bod 2.2.
const MS_LAST_LOGIN_EMAIL_KEY = 'ms_last_login_email_v1';
function msGetLastLoginEmail(){
  try{ return localStorage.getItem(MS_LAST_LOGIN_EMAIL_KEY) || ''; }catch(e){ return ''; }
}
function msSetLastLoginEmail(email){ try{ localStorage.setItem(MS_LAST_LOGIN_EMAIL_KEY, email); }catch(e){} }

/* ============================================================
   PREMIUM STAV - MOCK
   ZMENA 29.7.2026: Premium plati NA KONKRETNI STAVBU (projekt),
   ne na cely ucet/telefon. Kazdy projekt ma svuj vlastni stav -
   proto jde pres msProjectKey (stejny mechanismus jako u ostatnich
   projektovych dat), NE pres plochy localStorage klic jako drive.
   Skutecny zdroj pravdy bude az server (Supabase tabulka
   subscriptions, vazana na projekt), viz Premium-sdileni-specifikace.md
   bod 2.5 a 11.
   ============================================================ */
const MS_PREMIUM_MOCK_KEY = 'ms_premium_mock_v1';
const MS_PREMIUM_PLAN_KEY = 'ms_premium_plan_v1'; // 'monthly' | 'yearly' | 'lifetime'

function msIsPremiumMock(){
  try{ return localStorage.getItem(msProjectKey(MS_PREMIUM_MOCK_KEY)) === '1'; }catch(e){ return false; }
}
function msSetPremiumMock(on){ try{ localStorage.setItem(msProjectKey(MS_PREMIUM_MOCK_KEY), on ? '1' : '0'); }catch(e){} }

function msGetPremiumPlanType(){
  try{ return localStorage.getItem(msProjectKey(MS_PREMIUM_PLAN_KEY)) || null; }catch(e){ return null; }
}
function msSetPremiumPlanType(type){ try{ localStorage.setItem(msProjectKey(MS_PREMIUM_PLAN_KEY), type); }catch(e){} }

// Pro seznam VSECH projektu v Nastaveni (bez prepnuti na ne) - potrebuje
// zjistit stav LIBOVOLNEHO projektu, ne jen toho prave aktivniho.
function msIsPremiumMockForProject(projectId){
  try{ return localStorage.getItem(MS_PREMIUM_MOCK_KEY + '__' + projectId) === '1'; }catch(e){ return false; }
}

/* ============================================================
   SDILENI - MOCK SEZNAM POZVANYCH LIDI
   Projektove-scoped (kazdy projekt ma svuj vlastni seznam sdilenych
   lidi) - jde pres msLoad/msSave jako ostatni projektova data.
   Zatim jen lokalni UI mock, zadny skutecny backend/pozvanky.
   Tvar zaznamu: { id, name, email, role: 'rodina'|'dozor'|'projektant'|'vlastni',
   status: 'pending'|'active'|'denied', canAdd: bool,
   sections: {finance,denik,etapy,projekt,kalendar,fotky} (jen pro 'vlastni') }
   ============================================================ */
function msLoadSharedPeople(){
  return msLoad('ms_shared_people', ()=>[]);
}
function msSaveSharedPeople(list){ msSave('ms_shared_people', list); }

/* Rozliseni DUVODU odepreni pristupu - viz Premium-sdileni-specifikace.md
   sekce 18.1. "manual" = vlastnik odepral schvalne, "expired" = udelala to
   appka sama kvuli vyprsenemu predplatnemu. Pri obnoveni predplatneho se
   maji automaticky vratit prava JEN lidem s duvodem "expired" - rucne
   odepreni zustavaji zamceni dal, dokud je vlastnik neodemkne sam. */
function msExpireSharedPeople(){
  const people = msLoadSharedPeople();
  let changed = false;
  people.forEach(p=>{
    if(p.status === 'active'){ p.status = 'denied'; p.deniedReason = 'expired'; changed = true; }
  });
  if(changed) msSaveSharedPeople(people);
}
function msRestoreExpiredSharedPeople(){
  const people = msLoadSharedPeople();
  let changed = false;
  people.forEach(p=>{
    if(p.status === 'denied' && p.deniedReason === 'expired'){ p.status = 'active'; p.deniedReason = null; changed = true; }
  });
  if(changed) msSaveSharedPeople(people);
}

function msHasChosenAppLock(){ return msGetAppLock() !== null; }

// vytvori novy projekt (pouziva se pri onboardingu i pri "Pridat projekt" v Nastaveni/Dashboardu)
function msCreateProject({name, type, location}){
  const list = msLoadProjects();
  const id = msUid('p');
  const project = {
    id, name, type: type || null, location: location || '',
    started:false, startDate:null, finished:false, finishDate:null, lastMilestoneMonths:0,
    currentStage:{name:'Bez etapy', color:'#94a0bc'},
    totalExpenses:0, monthExpenses:0, balance:0, photoCount:0
  };
  list.push(project);
  msSaveProjects(list);
  msSetActiveProjectId(id);
  if(type) msSetProjectMeta({type});
  return project;
}
function msUpdateProject(id, patch){
  const list = msLoadProjects();
  const idx = list.findIndex(p=>p.id===id);
  if(idx===-1) return null;
  list[idx] = Object.assign({}, list[idx], patch);
  msSaveProjects(list);
  return list[idx];
}
// OPRAVA (2.8.2026): drive msDeleteProject smazalo jen zaznam projektu ze
// seznamu - vsechna jeho data (denik, vydaje, fotky, dokumenty, slozky...)
// zustala osirele v localStorage/IndexedDB. Ted appka pri smazani projektu
// uklidi VSECHNO, co k nemu patri - kazdy klic (localStorage i IndexedDB
// blob) je orazitkovany "__<projectId>" na konci (viz msProjectKey/
// msBlobKey), takze staci najit a smazat vse, co timhle vzorem konci.
async function msDeleteProject(id){
  let list = msLoadProjects();
  list = list.filter(p=>p.id!==id);
  msSaveProjects(list);
  if(msGetActiveProjectId()===id){
    msSetActiveProjectId(list.length ? list[0].id : null);
  }
  const suffix = '__' + id;
  try{
    const lsKeys = [];
    for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k && k.endsWith(suffix)) lsKeys.push(k); }
    lsKeys.forEach(k=> localStorage.removeItem(k));
  }catch(e){ console.error('msDeleteProject uklid localStorage selhal', e); }
  try{
    const idbKeys = await msIdbAllKeys();
    const toDelete = idbKeys.filter(k=> typeof k === 'string' && k.endsWith(suffix));
    await Promise.all(toDelete.map(k=> msIdbDelete(k).catch(()=>{})));
    if(typeof MS_BLOB_CACHE !== 'undefined'){
      [...MS_BLOB_CACHE.keys()].forEach(k=>{ if(typeof k==='string' && k.endsWith(suffix)) MS_BLOB_CACHE.delete(k); });
    }
  }catch(e){ console.error('msDeleteProject uklid IndexedDB selhal', e); }
}

/* ============================================================
   SDILENE PROJEKTY (Krok 11 - zobrazeni sdileneho projektu)
   Lokalni "zastupny" projekt, ktery reprezentuje stavbu VLASTNENOU
   NEKYM JINYM, ke ktere mam pristup pres prijatou pozvanku. Ma
   vlastni lokalni "id" (jako kazdy jiny projekt v appce), ale navic
   "remoteProjectId" (Supabase projects.id), podle ktereho appka
   pozna, ze jde o tenhle konkretni sdileny projekt (aby ho pri
   opakovanem prijeti/otevreni appky nezalozila dvakrat).
   ============================================================ */
function msFindLocalProjectByRemoteId(remoteId){
  return msLoadProjects().find(p=> p.remoteProjectId === remoteId) || null;
}
function msCreateSharedProjectLocal({ remoteProjectId, name, location, role }){
  const existing = msFindLocalProjectByRemoteId(remoteProjectId);
  if(existing) return existing;
  const list = msLoadProjects();
  const id = msUid('p');
  const project = {
    id, name: name || 'Sdílená stavba', type: null, location: location || '',
    started:false, startDate:null, finished:false, finishDate:null, lastMilestoneMonths:0,
    currentStage:{name:'Bez etapy', color:'#94a0bc'},
    totalExpenses:0, monthExpenses:0, balance:0, photoCount:0,
    isShared: true, remoteProjectId, sharedRole: role || null
  };
  list.push(project);
  msSaveProjects(list);
  return project;
}

/* ============================================================
   KROK 12 - obsah snimku (etapy/finance/denik/kalendar/ukoly...).
   Zamerne JEN textova data bez vlozenych souboru/fotek - fotky
   (ms_photos_v1), dokumenty etap (ms_documents_v1) a obecny strom
   slozek (ms_folder_tree_v1 - soubory tam maji obsah vlozeny PRIMO
   v datech, ne v IndexedDB jako fotky) by snimek zbytecne nafoukly.
   Synchronizace souboru je samostatna, vetsi budouci prace.
   ============================================================ */
const MS_SNAPSHOT_TEXT_KEYS = [
  'ms_custom_stages_v1', 'ms_selected_stages_v1', 'ms_current_stage_v1',
  'ms_closed_stages_v1', 'ms_stage_order_v1', 'ms_stage_active_days_v1',
  'ms_diary_meta_v1', 'ms_important_v1', 'ms_offers_v1', 'ms_project_meta_v1',
  // POZOR (1.8.2026): 'ms_events_v1'/'ms_tasks_v1' TADY ZAMERNE NEJSOU -
  // Kalendar i Ukoly maji od tohoto bodu svuj vlastni OBOUSMERNY system
  // (project_calendar_events, project_task_items), stejny princip jako
  // Denik/Finance/Fotky.
  // POZOR (1.8.2026): 'ms_documents_v1' ("Dokumenty etap") TADY ZAMERNE
  // NENI - ma od tohoto bodu svuj vlastni OBOUSMERNY system
  // (project_stage_documents).
  // POZOR (1.8.2026): 'ms_photos_v1' TADY ZAMERNE NENI - Fotky maji od
  // tohoto bodu svuj vlastni OBOUSMERNY system (project_photos_meta,
  // stejny princip jako Denik/Finance) - kdyby byl i tady, hromadny
  // snimek by prepsal zive slouceni (presne chyba z bodu 21.27).
  // POZOR (1.8.2026): 'ms_diary_v1' TADY ZAMERNE NENI - Denik ma od
  // tohoto bodu svuj vlastni OBOUSMERNY system (project_diary_entries,
  // MSCloud.pushDiaryEntry/fetchAllDiaryEntries, msMergeCloudDiaryEntries)
  // - kdyby byl i tady, hromadny snimek by prepsal zive slouceni
  // (presne chyba z bodu 21.27 v historii specifikace, nesmi se opakovat).
  // VRACENO ZPET (1.8.2026, na zadost): "Projekt" slozky se vratily na
  // JEDNOSMERNE sdileni (vlastnik -> pozvany) pres tenhle snimek, presne
  // jak fungovaly od Kroku 15 do teto zmeny. Obousmerny pokus
  // (project_folder_files) se ukazal jako prilis rozhazeny/nespolehlivy
  // v praxi a byl vyjmut.
  'ms_folder_tree_v1',
];

// Posbira textova data AKTIVNIHO projektu do jednoducheho objektu
// {base_klic: syrovy JSON retezec} - presne to, co uz je v localStorage
// (msSave tam uklada uz jako JSON.stringify), takze se to jen kopiruje.
function msCollectSnapshotData(){
  const data = {};
  MS_SNAPSHOT_TEXT_KEYS.forEach(base=>{
    try{
      const raw = localStorage.getItem(msProjectKey(base));
      if(raw !== null) data[base] = raw;
    }catch(e){}
  });
  return data;
}

// Zapise stazena data snimku do localStorage POD KONKRETNIM lokalnim
// projektem (jeho vlastni "id", ne nutne aktivni projekt appky) -
// pouziva se pri prijeti/obnoveni sdileneho projektu.
function msHydrateSharedProjectData(localProjectId, snapshotData){
  if(!snapshotData || !localProjectId) return;
  Object.keys(snapshotData).forEach(base=>{
    try{
      localStorage.setItem(base + '__' + localProjectId, snapshotData[base]);
    }catch(e){ console.error('msHydrateSharedProjectData', base, e); }
  });
}
