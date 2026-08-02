/* ==========================================================
   DULEZITE - patri vzdy jedne konkretni etape (jako driv v HTML verzi)
   ========================================================== */
const ImportantScreen = (function(){
  function typeIcon(type){
    if(type==='photo') return {c:'#25b7ff', svg:'<rect x="3" y="5" width="18" height="14" rx="1"/><circle cx="9" cy="11" r="2"/><path d="M21 17l-6-5-4 4-3-2-5 4"/>'};
    if(type==='pdf' || type==='doc' || type==='file') return {c:'#b34cff', svg:'<path d="M6 3h9l3 3v15H6z"/><path d="M9 10h6M9 14h6"/>'};
    if(type==='note') return {c:'#ffd35c', svg:'<path d="M4 19l4.5-1.5L20 6.5a1.7 1.7 0 0 0-2.5-2.5L6 15.5z"/><path d="M13 6l3 3"/>'};
    return {c:'#94a0bc', svg:'<path d="M6 3h9l3 3v15H6z"/>'};
  }
  function typeLabel(type){
    if(type==='photo') return 'Fotka';
    if(type==='pdf') return 'PDF';
    if(type==='doc') return 'Dokument';
    if(type==='note') return 'Poznámka';
    return 'Soubor';
  }
  function formatDateCz(iso){
    const d = new Date(iso+'T00:00:00');
    return `${d.getDate()}. ${d.getMonth()+1}. ${d.getFullYear()}`;
  }

  function render(container, params){
    const stageKey = params.stage || msGetCurrentStage();
    const stageInfo = msStageByKey(stageKey);

    container.innerHTML = `
      <div class="topbar">
        <div class="back-btn" id="backBtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></div>
        <h1>Důležité${stageInfo ? ' – '+stageInfo.name : ''}</h1>
        <div class="icon-btn" id="addBtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></div>
      </div>
      <div class="screen-scroll">
        <div id="grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px"></div>
      </div>
    `;
    container.querySelector('#backBtn').addEventListener('click', ()=> Router.back());

    function draw(){
      const grid = container.querySelector('#grid');
      const items = msImportant().filter(i=>i.stage===stageKey).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
      if(items.length===0){
        grid.innerHTML = '<p class="empty-msg" style="grid-column:1/-1">Zatím nic důležitého v této etapě. Přidej fotku, soubor nebo poznámku přes +.</p>';
        return;
      }
      grid.innerHTML = items.map((item,i)=>{
        const ic = typeIcon(item.type);
        return `<div class="imp-tile" data-i="${i}" style="border:1px solid var(--line);background:var(--card-bg-2);border-radius:var(--radius);padding:11px;display:flex;flex-direction:column;gap:8px;min-height:100px;cursor:pointer">
          <div style="width:32px;height:32px;border:1px solid ${ic.c};color:${ic.c};display:grid;place-items:center;border-radius:3px">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ic.svg}</svg>
          </div>
          <b style="font-size:11.5px;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${item.title}</b>
          <span style="font-size:9px;color:var(--muted);margin-top:auto">${formatDateCz(item.date)}</span>
        </div>`;
      }).join('');
      grid.querySelectorAll('.imp-tile').forEach(el=>{
        const item = items[Number(el.dataset.i)];
        el.addEventListener('click', ()=>{
          if(item.type==='note') alert(item.title + '\n\n' + (item.text||''));
          else alert(typeLabel(item.type) + ': ' + item.title);
        });
      });
    }

    container.querySelector('#addBtn').addEventListener('click', async ()=>{
      const choice = await addSheet();
      if(choice==='photo'){ msAddImportant({stage:stageKey, type:'photo', title:'Nová fotka'}); draw(); }
      else if(choice==='file'){
        const name = prompt('Název souboru (např. Smlouva.pdf):', 'Dokument.pdf');
        if(!name) return;
        const ext = name.toLowerCase().endsWith('.pdf') ? 'pdf' : name.toLowerCase().match(/\.docx?$/) ? 'doc' : 'file';
        msAddImportant({stage:stageKey, type:ext, title:name}); draw();
      } else if(choice==='note'){
        const text = prompt('Text poznámky:');
        if(!text) return;
        msAddImportant({stage:stageKey, type:'note', title:'Poznámka', text}); draw();
      }
    });

    function addSheet(){
      return new Promise(resolve=>{
        const overlay = document.createElement('div');
        overlay.className = 'ms-overlay'; overlay.style.cssText = 'position:fixed;inset:0;background:rgba(2,4,10,.7);z-index:60;display:flex;align-items:flex-end;justify-content:center';
        overlay.innerHTML = `
          <div style="width:100%;max-width:480px;background:var(--card-bg-2);border-top:1px solid var(--line);padding:14px 16px calc(16px + env(safe-area-inset-bottom))">
            <b style="display:block;font-size:13px;margin-bottom:10px;color:#dfe4f5">Přidat důležité</b>
            <div class="ai-opt" data-c="photo" style="display:flex;align-items:center;gap:10px;padding:11px 4px;cursor:pointer">
              <div style="width:32px;height:32px;border:1px solid #25e8ff;color:#25e8ff;display:grid;place-items:center;flex:0 0 auto"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="1"/><circle cx="12" cy="12" r="3.5"/></svg></div>
              <div><b style="display:block;font-size:12.5px">Přidat fotku</b><span style="font-size:10px;color:var(--muted)">Vyfotit nebo vybrat z galerie</span></div>
            </div>
            <div class="ai-opt" data-c="file" style="display:flex;align-items:center;gap:10px;padding:11px 4px;border-top:1px solid var(--line);cursor:pointer">
              <div style="width:32px;height:32px;border:1px solid #25e8ff;color:#25e8ff;display:grid;place-items:center;flex:0 0 auto"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h9l3 3v15H6z"/><path d="M9 10h6M9 14h6"/></svg></div>
              <div><b style="display:block;font-size:12.5px">Přidat soubor</b><span style="font-size:10px;color:var(--muted)">PDF, Word nebo cokoliv jiného</span></div>
            </div>
            <div class="ai-opt" data-c="note" style="display:flex;align-items:center;gap:10px;padding:11px 4px;border-top:1px solid var(--line);cursor:pointer">
              <div style="width:32px;height:32px;border:1px solid #25e8ff;color:#25e8ff;display:grid;place-items:center;flex:0 0 auto"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19l4.5-1.5L20 6.5a1.7 1.7 0 0 0-2.5-2.5L6 15.5z"/></svg></div>
              <div><b style="display:block;font-size:12.5px">Napsat poznámku</b><span style="font-size:10px;color:var(--muted)">Rychlá textová poznámka</span></div>
            </div>
            <button id="sheetClose" style="width:100%;margin-top:12px;border:1px solid var(--line);background:transparent;color:var(--muted);padding:9px;font-size:12px;font-weight:700;cursor:pointer;border-radius:3px">Zrušit</button>
          </div>`;
        document.body.appendChild(overlay);
        overlay.querySelector('#sheetClose').addEventListener('click', ()=>{ document.body.removeChild(overlay); resolve(null); });
        overlay.querySelectorAll('.ai-opt').forEach(el=>{
          el.addEventListener('click', ()=>{ document.body.removeChild(overlay); resolve(el.dataset.c); });
        });
      });
    }

    draw();
    return { activeTab:'', showNav:true };
  }
  return { render };
})();
Router.register('important', ImportantScreen);
