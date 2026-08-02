/* ==========================================================
   PROJEKT (spravce dokumentu) - 1.8.2026, prestavba na plochou
   strukturu se stalymi ID slozek (misto hledani podle jmena/cesty).
   Slozky zaklada/mate/mize jen VLASTNIK, soubory pridavaji OBA
   smery obousmerne. Tenhle system se ted pouziva i pro Nabidky a
   Dulezite (kazde zvlast pro kazdou etapu, viz params.scope).
   "Dokumenty etap" ma vlastni, oddeleny rezim (kdyz je stage bez
   scope) - nezmeneno, pouziva msDocuments()/msAddDocument(), kvuli
   propojeni na frontu do deniku a export PDF.
   ========================================================== */
const ProjectScreen = (function(){
  function render(container, params){
    const scope = (params && params.scope) || ((params && params.stage) ? 'dokumenty' : 'projekt');
    if(scope === 'dokumenty' && params.stage) return renderStageDocs(container, params);
    return renderFolders(container, params, scope);
  }

  /* -------------------- REZIM: Dokumenty konkretni etapy -------------------- */
  function renderStageDocs(container, params){
    const s = msStageByKey(params.stage);
    const activeProjectsSD = msLoadProjects();
    const activeProjectSD = activeProjectsSD.find(p=>p.id===msGetActiveProjectId());
    const isOwnerSD = !(activeProjectSD && activeProjectSD.isShared);
    const canAddHereSD = (typeof msCanAddSection === 'function') ? msCanAddSection('etapy') : true;
    container.innerHTML = `
      <div class="topbar">
        <div class="back-btn" id="backBtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></div>
        <h1>${s ? s.name : 'Dokumenty'}</h1>
        <div style="width:34px"></div>
      </div>
      <div class="screen-scroll">
        <div id="grid" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px;margin-bottom:12px"></div>
        ${canAddHereSD ? `<div>
          <p class="f-label">Přidat poznámku (uloží se jako soubor)</p>
          <div style="display:flex;gap:8px">
            <input class="f-input" id="noteInput" placeholder="Napiš poznámku…" style="flex:1"/>
            <button id="noteSaveBtn" style="flex:0 0 auto;border:1px solid var(--line);background:transparent;color:#fff;padding:0 14px;border-radius:3px;cursor:pointer;font-weight:800">Uložit</button>
          </div>
        </div>` : ''}
      </div>
      <input type="file" id="fileInput" multiple style="display:none"/>
    `;
    let clickTargets = [], deleteTargets = [], renameTargets = [];
    function tile(name, sub, mime, onClick, onDelete, author, onRename){
      const idx = clickTargets.length;
      clickTargets.push(onClick); deleteTargets.push(onDelete); renameTargets.push(onRename||null);
      const isPdf = mime === 'application/pdf';
      const color = isPdf ? 'var(--add-color)' : '#94a0bc';
      const borderColor = isPdf ? 'var(--add-color)' : 'color-mix(in srgb, var(--muted) 75%, transparent)';
      const authorBadge = (author && author!=='Stavebník') ? `<span style="display:block;margin-top:4px;border:1px solid #25b7ff;color:#25b7ff;padding:1px 6px;font-size:8.5px;font-weight:700;max-width:100%;margin-left:auto;margin-right:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;box-sizing:border-box">👤 ${author.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</span>` : '';
      return `<div class="tile-item" data-idx="${idx}" style="position:relative;border:1.5px solid ${borderColor};padding:9px 6px;text-align:center;cursor:${onClick?'pointer':'default'};min-width:0">
        <div style="position:absolute;top:4px;right:4px;display:flex;gap:3px">
          ${onRename ? `<span class="tile-ren" data-idx="${idx}" style="width:16px;height:16px;border:1px solid var(--line);border-radius:3px;display:grid;place-items:center;color:var(--add-color);cursor:pointer;background:var(--card-bg-2)">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
          </span>` : ''}
          ${onDelete ? `<span class="tile-del" data-idx="${idx}" style="width:16px;height:16px;border:1px solid var(--line);border-radius:3px;display:grid;place-items:center;color:var(--muted);cursor:pointer;background:var(--card-bg-2)">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V7"/></svg>
          </span>` : ''}
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8">${isPdf ? `<path d="M6 3h9l3 3v15H6z"/><text x="6" y="13" font-size="5.5" fill="${color}" stroke="none" font-weight="800">PDF</text>` : '<path d="M6 3h9l3 3v15H6z"/><path d="M9 10h6M9 14h6"/>'}</svg>
        <b style="display:block;margin-top:5px;font-size:10.5px;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name}</b>
        <span style="font-size:9.5px;color:var(--muted)">${sub}</span>
        ${authorBadge}
      </div>`;
    }
    function bindTileClicks(){
      container.querySelectorAll('.tile-item').forEach(el=>{
        const idx = Number(el.dataset.idx);
        el.addEventListener('click', (e)=>{ if(e.target.closest('.tile-del')) return; const fn = clickTargets[idx]; if(fn) fn(); });
      });
      container.querySelectorAll('.tile-del').forEach(el=>{
        el.addEventListener('click', async (e)=>{
          e.stopPropagation();
          const idx = Number(el.dataset.idx);
          if(!await Layout.confirmDialog('Smazat tuhle položku? Nedá se to vrátit zpět.', 'Smazat')) return;
          const fn = deleteTargets[idx]; if(fn) fn();
        });
      });
      container.querySelectorAll('.tile-ren').forEach(el=>{
        el.addEventListener('click', (e)=>{
          e.stopPropagation();
          const idx = Number(el.dataset.idx);
          const fn = renameTargets[idx]; if(fn) fn();
        });
      });
    }
    function draw(){
      clickTargets = []; deleteTargets = [];
      const grid = container.querySelector('#grid');
      const docs = msDocuments().filter(d=>d.stage===params.stage);
      grid.innerHTML = '';
      docs.forEach(d=>{
        grid.innerHTML += tile(d.name, d.isNote?'poznámka':(d.date||''), d.mime, d.isNote ? ()=>editNote(d) : ()=>openDocContent(d), isOwnerSD ? ()=>{ msDeleteDocument(d.id); draw(); } : null, d.author, (isOwnerSD && !d.isNote) ? ()=>renameDoc(d) : null);
      });
      // Velka "+" dlazdice misto male ikonky nahore - stejny vzhled jako
      // "Projekt"/"Nabídky"/"Důležité". Jen pokud ma uzivatel pravo
      // pridavat do sekce Etapy.
      if(canAddHereSD){
        const addIdx = clickTargets.length;
        clickTargets.push(()=> container.querySelector('#fileInput').click());
        deleteTargets.push(null);
        grid.innerHTML += `<div class="tile-item" data-idx="${addIdx}" style="border:1.5px dashed var(--add-color);padding:9px 6px;text-align:center;cursor:pointer;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--add-color)" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          <b style="display:block;margin-top:6px;font-size:10.5px;color:var(--add-color)">Přidat</b>
        </div>`;
      }
      bindTileClicks();
    }
    function editNote(d){
      const text = prompt('Upravit poznámku:', d.name.replace(/^Poznámka: /,''));
      if(text===null) return;
      msUpdateDocument(d.id, { name:'Poznámka: '+text.trim() });
      draw();
    }
    function renameDoc(d){
      const name = prompt('Přejmenovat dokument:', d.name);
      if(!name || !name.trim()) return;
      msUpdateDocument(d.id, { name: name.trim() });
      draw();
    }
    async function openDocContent(d){
      const key = msBlobKey('doc', d.id);
      let dataUrl = MS_BLOB_CACHE.get(key);
      if(!dataUrl){ try{ dataUrl = await msIdbGet(key); if(dataUrl) MS_BLOB_CACHE.set(key, dataUrl); }catch(e){} }
      if(!dataUrl){ alert('Obsah souboru se nepodařilo najít - zkus appku načíst znovu.'); return; }
      if(d.mime && d.mime.startsWith('image/')){
        const overlay = document.createElement('div');
        overlay.className = 'ms-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:80;display:flex;align-items:center;justify-content:center';
        overlay.innerHTML = `<img src="${dataUrl}" style="max-width:94%;max-height:90%;object-fit:contain"/>`;
        overlay.addEventListener('click', ()=> document.body.removeChild(overlay));
        document.body.appendChild(overlay);
        return;
      }
      try{
        const [meta, b64] = dataUrl.split(',');
        const mime = (meta.match(/data:(.*);base64/)||[])[1] || d.mime || 'application/octet-stream';
        const bytes = atob(b64);
        const arr = new Uint8Array(bytes.length);
        for(let i=0;i<bytes.length;i++) arr[i] = bytes.charCodeAt(i);
        const blob = new Blob([arr], {type: mime});
        window.open(URL.createObjectURL(blob), '_blank');
      }catch(e){ alert('Tenhle typ souboru appka zatím neumí otevřít přímo.'); }
    }
    function readAsDataURL(file){
      return new Promise(resolve=>{
        const reader = new FileReader();
        if(!file.type.startsWith('image/')){
          reader.onload = ()=> resolve(reader.result);
          reader.onerror = ()=> resolve(null);
          reader.readAsDataURL(file);
          return;
        }
        reader.onload = ()=>{
          const img = new Image();
          img.onload = ()=>{
            const maxDim = 1400;
            let {width,height} = img;
            if(width>height && width>maxDim){ height=height*maxDim/width; width=maxDim; }
            else if(height>maxDim){ width=width*maxDim/height; height=maxDim; }
            const canvas = document.createElement('canvas');
            canvas.width=width; canvas.height=height;
            canvas.getContext('2d').drawImage(img,0,0,width,height);
            resolve(canvas.toDataURL('image/jpeg',0.75));
          };
          img.onerror = ()=> resolve(null);
          img.src = reader.result;
        };
        reader.onerror = ()=> resolve(null);
        reader.readAsDataURL(file);
      });
    }
    container.querySelector('#backBtn').addEventListener('click', ()=> Router.back());
    container.querySelector('#fileInput').addEventListener('change', async (e)=>{
      const files = [...e.target.files];
      const items = await Promise.all(files.map(async f=> ({ name:f.name, mime:f.type||null, content: await readAsDataURL(f) })));
      const saved = await Promise.all(items.map(it=> msAddDocument({ name: it.name, stage: params.stage, content: it.content||null })));
      const savedIds = saved.filter(Boolean).map(x=>x.id);
      draw();
      e.target.value = '';
      if(params.stage !== 'naradi' && savedIds.length){
        const wants = await Layout.confirmDialog(
          (savedIds.length>1 ? `Chceš těchto ${savedIds.length} souborů` : 'Chceš tento soubor') +
          ' nabídnout jako dlaždici u příštího zápisu do deníku? (Objeví se tam k výběru, nic se tím rovnou nezapisuje.)',
          'Přidat', 'Nepřidávat'
        );
        if(wants) savedIds.forEach(id=> msQueueForDiary('document', id));
      }
    });
    const noteSaveBtnSD = container.querySelector('#noteSaveBtn');
    if(noteSaveBtnSD){
      noteSaveBtnSD.addEventListener('click', ()=>{
        const input = container.querySelector('#noteInput');
        const text = input.value.trim();
        if(!text) return;
        msAddDocument({ name:'Poznámka: '+text, stage: params.stage, isNote:true });
        input.value = '';
        draw();
      });
    }
    draw();
    return { activeTab:'project' };
  }

  /* -------------------- REZIM: Obecne slozky "Projekt" -------------------- */
  function renderFolders(container, params, scope){
    scope = scope || 'projekt';
    const stageKey = (scope !== 'projekt') ? (params.stage || null) : null;
    const stageInfo = stageKey ? msStageByKey(stageKey) : null;
    const scopeTitles = { projekt:'Projekt', nabidky:'Nabídky', dulezite:'Důležité' };
    const screenTitle = scopeTitles[scope] || 'Projekt';

    const activeProjects = msLoadProjects();
    const activeProject = activeProjects.find(p=>p.id===msGetActiveProjectId());
    const isOwner = !(activeProject && activeProject.isShared);
    // Prava (1.8.2026): "muze zakladat slozky" zustava vzdy jen vlastnik
    // (nemenime), ale "muze pridavat soubory/poznamky" uz zavisi na
    // prideleni prava pro danou sekci (Projekt/Etapy).
    const sectionForRights = scope==='projekt' ? 'projekt' : 'etapy';
    const canAddHere = (typeof msCanAddSection === 'function') ? msCanAddSection(sectionForRights) : true;

    // Jednorazovy bootstrap: vlastnik bez jedine slozky v "Projekt"
    // (scope korenu, ne pri kazde etape) dostane pripravenou uvodni
    // slozku "Projekt", at nezacina na uplne prazdno. Nabidky/Dulezite
    // pro konkretni etapu uz kontext maji (nazev etapy v nadpisu),
    // zadnou dalsi wrapper slozku navic nepotrebuji. Pozvany zadnou
    // slozku sam nezaklada - pockaji, az mu to prijde sdilenim.
    if(scope==='projekt' && isOwner && msLoadProjectFolders().filter(f=>f.scope==='projekt').length===0){
      msAddProjectFolder('Projekt', null, 'projekt', null);
    }

    let pathStack = []; // pole {id, name} od korene dolu

    container.innerHTML = `
      <div class="topbar">
        <div class="back-btn" id="backBtn" style="visibility:${scope==='projekt'?'hidden':'visible'}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></div>
        <h1 id="pathTitle">${screenTitle}${stageInfo ? ' – '+stageInfo.name : ''}</h1>
        <div style="width:34px"></div>
      </div>
      <div class="screen-scroll">
        <div id="statsRow" style="display:${scope==='projekt'?'grid':'none'};grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
          <div class="proj-stat" data-field="landArea" style="border:1px solid var(--line);background:var(--card-bg);border-radius:var(--radius);padding:9px 6px;text-align:center;cursor:pointer">
            <span style="display:block;font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">Pozemek</span>
            <b id="statLand" style="display:block;font-size:12.5px;color:#fff;margin-top:3px">Doplnit</b>
          </div>
          <div class="proj-stat" data-field="type" style="border:1px solid var(--line);background:var(--card-bg);border-radius:var(--radius);padding:9px 6px;text-align:center;cursor:pointer">
            <span style="display:block;font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">Typ domu</span>
            <b id="statType" style="display:block;font-size:12.5px;color:#fff;margin-top:3px">Doplnit</b>
          </div>
          <div class="proj-stat" data-field="builtArea" style="border:1px solid var(--line);background:var(--card-bg);border-radius:var(--radius);padding:9px 6px;text-align:center;cursor:pointer">
            <span style="display:block;font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">Užitná pl.</span>
            <b id="statBuilt" style="display:block;font-size:12.5px;color:#fff;margin-top:3px">Doplnit</b>
          </div>
        </div>
        <div id="grid" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px;margin-bottom:12px"></div>
      </div>
      <input type="file" id="fileInput" multiple style="display:none"/>
    `;

    const meta = msProjectMeta ? msProjectMeta() : {};
    container.querySelector('#statLand').textContent = meta.landArea ? meta.landArea+' m²' : 'Doplnit';
    container.querySelector('#statType').textContent = meta.type || 'Doplnit';
    container.querySelector('#statBuilt').textContent = meta.builtArea ? meta.builtArea+' m²' : 'Doplnit';
    container.querySelectorAll('.proj-stat').forEach(el=>{
      el.addEventListener('click', ()=>{
        const field = el.dataset.field;
        const label = field==='type' ? 'Typ domu' : (field==='landArea' ? 'Plocha pozemku (m²)' : 'Užitná plocha (m²)');
        const cur = meta[field] || '';
        const val = prompt(label+':', cur);
        if(val===null) return;
        const patch = {};
        patch[field] = field==='type' ? val.trim() : (Number(val)||null);
        msSetProjectMeta(patch);
        render(container, params);
      });
    });

    let clickTargets = [], deleteTargets = [], renameTargets = [];
    function fileIconSvg(mime, color){
      if(mime === 'application/pdf'){
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8"><path d="M6 3h9l3 3v15H6z"/><text x="6" y="13" font-size="5.5" fill="${color}" stroke="none" font-weight="800">PDF</text></svg>`;
      }
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8"><path d="M6 3h9l3 3v15H6z"/><path d="M9 10h6M9 14h6"/></svg>`;
    }
    function tile(opts){
      const { name, sub, isFolder, mime, thumbUrl, onClick, onDelete, onRename } = opts;
      const idx = clickTargets.length;
      clickTargets.push(onClick); deleteTargets.push(onDelete||null); renameTargets.push(onRename||null);
      const color = isFolder ? 'var(--folder-color)' : '#94a0bc';
      // Silnejsi, viditelny barevny ramecek s jemnou zari - stejny
      // "vahovy" pocit jako karta aktualni etapy v Etapach (schvaleno
      // na nahledu 1.8.2026), misto puvodniho jemneho nadechu pozadi.
      const bg = 'var(--card-bg)';
      const isPdf = mime === 'application/pdf';
      const borderColor = isFolder ? 'var(--folder-color)' : (isPdf ? 'var(--add-color)' : 'color-mix(in srgb, var(--muted) 75%, transparent)');
      const glow = isFolder ? `box-shadow:0 0 14px -4px color-mix(in srgb, var(--folder-color) 60%, transparent);` : '';
      const visual = thumbUrl
        ? `<div style="width:100%;aspect-ratio:1;border-radius:3px;background:url(${thumbUrl}) center/cover;margin:0 auto"></div>`
        : `<div style="height:20px;display:flex;align-items:center;justify-content:center">${isFolder ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8"><rect x="3" y="7" width="18" height="13" rx="1"/><path d="M3 7l2-3h6l2 3"/></svg>` : fileIconSvg(mime, color)}</div>`;
      return `<div class="tile-item" data-idx="${idx}" style="position:relative;border:1.5px solid ${borderColor};background:${bg};${glow}padding:9px 6px;text-align:center;cursor:${onClick?'pointer':'default'};min-width:0">
        ${(onDelete||onRename) ? `<div style="position:absolute;top:3px;right:3px;display:flex;gap:3px">
          ${onRename ? `<span class="tile-ren" data-idx="${idx}" style="width:16px;height:16px;border:1px solid var(--line);border-radius:3px;display:grid;place-items:center;color:var(--add-color);cursor:pointer;background:var(--card-bg-2)">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </span>` : ''}
          ${onDelete ? `<span class="tile-del" data-idx="${idx}" style="width:16px;height:16px;border:1px solid var(--line);border-radius:3px;display:grid;place-items:center;color:var(--muted);cursor:pointer;background:var(--card-bg-2)">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V7"/></svg>
          </span>` : ''}
        </div>` : ''}
        ${visual}
        <b style="display:block;margin-top:5px;font-size:10.5px;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name}</b>
        <span style="font-size:9.5px;color:var(--muted)">${sub}</span>
      </div>`;
    }
    function addTile(){
      const idx = clickTargets.length;
      clickTargets.push(onAddClick); deleteTargets.push(null); renameTargets.push(null);
      return `<div class="tile-item" data-idx="${idx}" style="border:1.5px dashed var(--add-color);padding:9px 6px;text-align:center;cursor:pointer;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--add-color)" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
        <b style="display:block;margin-top:6px;font-size:10.5px;color:var(--add-color)">Přidat</b>
      </div>`;
    }
    function bindTileClicks(){
      container.querySelectorAll('.tile-item').forEach(el=>{
        const idx = Number(el.dataset.idx);
        el.addEventListener('click', (e)=>{ if(e.target.closest('.tile-del') || e.target.closest('.tile-ren')) return; const fn = clickTargets[idx]; if(fn) fn(); });
      });
      container.querySelectorAll('.tile-del').forEach(el=>{
        el.addEventListener('click', async (e)=>{
          e.stopPropagation();
          const idx = Number(el.dataset.idx);
          if(!await Layout.confirmDialog('Smazat tuhle položku? Nedá se to vrátit zpět.', 'Smazat')) return;
          const fn = deleteTargets[idx]; if(fn) fn();
        });
      });
      container.querySelectorAll('.tile-ren').forEach(el=>{
        el.addEventListener('click', (e)=>{
          e.stopPropagation();
          const idx = Number(el.dataset.idx);
          const fn = renameTargets[idx]; if(fn) fn();
        });
      });
    }

    function currentFolderId(){ return pathStack.length ? pathStack[pathStack.length-1].id : null; }

    function draw(){
      clickTargets = []; deleteTargets = []; renameTargets = [];
      const isRoot = pathStack.length===0;
      container.querySelector('.screen-scroll').classList.toggle('no-scroll', isRoot && scope==='projekt');
      container.querySelector('#backBtn').style.visibility = (isRoot && scope==='projekt') ? 'hidden' : 'visible';
      container.querySelector('#pathTitle').textContent = isRoot ? (screenTitle + (stageInfo ? ' – '+stageInfo.name : '')) : pathStack[pathStack.length-1].name;
      container.querySelector('#statsRow').style.display = (isRoot && scope==='projekt') ? 'grid' : 'none';

      const folders = msLoadProjectFolders().filter(f=> f.parentId===currentFolderId() && f.scope===scope && (f.stageKey||null)===(stageKey||null));
      const items = msLoadProjectItems().filter(it=> it.folderId===currentFolderId() && it.scope===scope && (it.stageKey||null)===(stageKey||null));
      const grid = container.querySelector('#grid');
      grid.innerHTML = '';

      // Prazdny stav - jen kdyz v teto slozce fakt nic neni (i uvodni
      // "Projekt" pri prvnim otevreni pusobilo prilis prazdne a strohe).
      // Navrhove "chipy" na zalozeni bezne slozky se objevi JEN v
      // korenu vlastniho "Projekt" - u Nabidek/Dulezite pro konkretni
      // etapu uz kontext dava nadpis, dalsi navrhy by byly matouci.
      if(folders.length===0 && items.length===0){
        const suggestions = scope==='projekt' ? ['Smlouvy', 'Povolení', 'Projektová dokumentace', 'Faktury'] : [];
        grid.innerHTML = `<div style="grid-column:1/-1;margin:6px 0 6px;padding:26px 20px 20px;text-align:center;border:1px dashed var(--line);cursor:pointer" id="emptyProjectCard">
          <div style="width:44px;height:44px;border:1px solid var(--add-color);color:var(--add-color);margin:0 auto 12px;display:grid;place-items:center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          </div>
          <b style="display:block;font-size:15px;margin-bottom:6px">${canAddHere ? 'Zatím prázdno' : 'Zatím tu nic není'}</b>
          <span style="font-size:11.5px;color:var(--muted);line-height:1.5">${canAddHere ? 'Nahraj soubory, fotky, poznámky, nebo si založ další složku.' : 'Vlastník sem ještě nic nepřidal.'}</span>
        </div>
        ${isOwner ? `<div style="grid-column:1/-1;display:flex;flex-wrap:wrap;gap:7px;justify-content:center;margin-bottom:14px">
          ${suggestions.map(name=> `<span class="folder-suggest-chip" data-name="${name}" style="border:1px solid var(--line);color:var(--muted);padding:6px 12px;font-size:11px;cursor:pointer;border-radius:20px">+ ${name}</span>`).join('')}
        </div>` : ''}`;
      }

      folders.forEach(f=>{
        const childCount = msLoadProjectFolders().filter(x=>x.parentId===f.id).length + msLoadProjectItems().filter(x=>x.folderId===f.id).length;
        grid.innerHTML += tile({
          name: f.name, sub: childCount+' položek', isFolder: true,
          onClick: ()=>{ pathStack.push({id:f.id, name:f.name}); draw(); },
          onDelete: isOwner ? ()=>{ msDeleteProjectFolder(f.id); draw(); } : null,
          onRename: isOwner ? ()=>{
            const name = prompt('Nový název složky:', f.name);
            if(!name || !name.trim()) return;
            msRenameProjectFolder(f.id, name.trim());
            draw();
          } : null,
        });
      });
      items.forEach(it=>{
        const thumbKey = msBlobKey('pitem', it.id);
        const isImage = it.mime && it.mime.startsWith('image/');
        const thumbUrl = isImage ? MS_BLOB_CACHE.get(thumbKey) : null;
        grid.innerHTML += tile({
          name: it.name, mime: it.mime,
          sub: it.isNote ? 'poznámka' : (it.author && it.author!=='Stavebník' ? '👤 '+it.author : (isImage?'fotka':'soubor')),
          thumbUrl,
          onClick: it.isNote ? ()=>editNote(it) : ()=>openItemContent(it),
          onDelete: isOwner ? ()=>{ msDeleteProjectItem(it.id); draw(); } : null,
          onRename: isOwner ? ()=>{
            const name = prompt('Nový název:', it.name);
            if(!name || !name.trim()) return;
            msRenameProjectItem(it.id, name.trim());
            draw();
          } : null,
        });
      });
      if(canAddHere) grid.innerHTML += addTile();
      bindTileClicks();
      const emptyCard = container.querySelector('#emptyProjectCard');
      if(emptyCard && isOwner && canAddHere) emptyCard.addEventListener('click', onAddClick);
      container.querySelectorAll('.folder-suggest-chip').forEach(chip=>{
        chip.addEventListener('click', (e)=>{
          e.stopPropagation();
          msAddProjectFolder(chip.dataset.name, currentFolderId(), scope, stageKey);
          draw();
        });
      });
    }

    function editNote(it){
      if(!isOwner){ openItemContent(it); return; }
      const text = prompt('Upravit poznámku:', it.name.replace(/^Poznámka: /,''));
      if(text===null) return;
      const list = msLoadProjectItems();
      const idx = list.findIndex(x=>x.id===it.id);
      if(idx>-1){ list[idx] = Object.assign({}, list[idx], { name:'Poznámka: '+text.trim() }); msSaveProjectItems(list); }
      draw();
    }

    async function openItemContent(it){
      const key = msBlobKey('pitem', it.id);
      let dataUrl = MS_BLOB_CACHE.get(key);
      if(!dataUrl){ try{ dataUrl = await msIdbGet(key); if(dataUrl) MS_BLOB_CACHE.set(key, dataUrl); }catch(e){} }
      if(!dataUrl){
        if(it.isNote){ alert(it.name); return; }
        alert('Obsah souboru se nepodařilo najít - zkus appku načíst znovu.');
        return;
      }
      if(it.mime && it.mime.startsWith('image/')){
        const overlay = document.createElement('div');
        overlay.className = 'ms-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:80;display:flex;align-items:center;justify-content:center';
        overlay.innerHTML = `<img src="${dataUrl}" style="max-width:94%;max-height:90%;object-fit:contain"/>`;
        overlay.addEventListener('click', ()=> document.body.removeChild(overlay));
        document.body.appendChild(overlay);
        return;
      }
      try{
        const [meta, b64] = dataUrl.split(',');
        const mime = (meta.match(/data:(.*);base64/)||[])[1] || it.mime || 'application/octet-stream';
        const bytes = atob(b64);
        const arr = new Uint8Array(bytes.length);
        for(let i=0;i<bytes.length;i++) arr[i] = bytes.charCodeAt(i);
        const blob = new Blob([arr], {type: mime});
        window.open(URL.createObjectURL(blob), '_blank');
      }catch(e){ alert('Tenhle typ souboru appka zatím neumí otevřít přímo.'); }
    }

    function readAsDataURL(file){
      return new Promise(resolve=>{
        const reader = new FileReader();
        if(!file.type.startsWith('image/')){
          reader.onload = ()=> resolve(reader.result);
          reader.onerror = ()=> resolve(null);
          reader.readAsDataURL(file);
          return;
        }
        reader.onload = ()=>{
          const img = new Image();
          img.onload = ()=>{
            const maxDim = 1400;
            let {width,height} = img;
            if(width>height && width>maxDim){ height=height*maxDim/width; width=maxDim; }
            else if(height>maxDim){ width=width*maxDim/height; height=maxDim; }
            const canvas = document.createElement('canvas');
            canvas.width=width; canvas.height=height;
            canvas.getContext('2d').drawImage(img,0,0,width,height);
            resolve(canvas.toDataURL('image/jpeg',0.75));
          };
          img.onerror = ()=> resolve(null);
          img.src = reader.result;
        };
        reader.onerror = ()=> resolve(null);
        reader.readAsDataURL(file);
      });
    }

    async function onAddClick(){
      const choice = await addSheet();
      if(choice==='files') container.querySelector('#fileInput').click();
      else if(choice==='note'){
        const text = prompt('Text poznámky:');
        if(!text || !text.trim()) return;
        await msAddProjectItem({ name:'Poznámka: '+text.trim(), isNote:true, folderId: currentFolderId(), scope, stageKey });
        draw();
      }
      else if(choice==='newFolder'){
        const name = prompt('Název nové složky:');
        if(!name || !name.trim()) return;
        msAddProjectFolder(name.trim(), currentFolderId(), scope, stageKey);
        draw();
      }
    }
    function addSheet(){
      return new Promise(resolve=>{
        const overlay = document.createElement('div');
        overlay.className = 'ms-overlay'; overlay.style.cssText = 'position:fixed;inset:0;background:rgba(2,4,10,.7);z-index:60;display:flex;align-items:flex-end;justify-content:center';
        overlay.innerHTML = `
          <div style="width:100%;max-width:480px;background:var(--card-bg-2);border-top:1px solid var(--line);padding:14px 16px calc(16px + env(safe-area-inset-bottom))">
            <div class="mi" data-c="files" style="display:flex;align-items:center;gap:10px;padding:11px 4px;cursor:pointer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h9l3 3v15H6z"/><path d="M9 10h6M9 14h6"/></svg>
              <b style="font-size:12.5px">Nahrát soubory / fotky</b><span style="font-size:9.5px;color:var(--muted);margin-left:auto">jde vybrat víc najednou</span>
            </div>
            <div class="mi" data-c="note" style="display:flex;align-items:center;gap:10px;padding:11px 4px;border-top:1px solid var(--line);cursor:pointer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
              <b style="font-size:12.5px">Přidat poznámku</b>
            </div>
            ${isOwner ? `<div class="mi" data-c="newFolder" style="display:flex;align-items:center;gap:10px;padding:11px 4px;border-top:1px solid var(--line);cursor:pointer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
              <b style="font-size:12.5px">Založit složku</b>
            </div>` : ''}
            <button id="sheetClose" style="width:100%;margin-top:10px;border:1px solid var(--line);background:transparent;color:var(--muted);padding:9px;font-size:12px;font-weight:700;cursor:pointer;border-radius:3px">Zrušit</button>
          </div>`;
        document.body.appendChild(overlay);
        overlay.querySelector('#sheetClose').addEventListener('click', ()=>{ document.body.removeChild(overlay); resolve(null); });
        overlay.querySelectorAll('.mi').forEach(el=>{
          el.addEventListener('click', ()=>{ document.body.removeChild(overlay); resolve(el.dataset.c); });
        });
      });
    }

    container.querySelector('#fileInput').addEventListener('change', async (e)=>{
      const files = [...e.target.files];
      const parsed = await Promise.all(files.map(async f=> ({ name:f.name, mime:f.type||null, content: await readAsDataURL(f) })));
      for(const it of parsed){
        await msAddProjectItem({ name: it.name, mime: it.mime, folderId: currentFolderId(), content: it.content, scope, stageKey });
      }
      draw();
      e.target.value = '';
    });

    container.querySelector('#backBtn').addEventListener('click', ()=>{
      if(pathStack.length>0){ pathStack.pop(); draw(); }
      else { Router.back(); }
    });

    draw();
    return { activeTab:'project' };
  }

  return { render };
})();
Router.register('project', ProjectScreen);
