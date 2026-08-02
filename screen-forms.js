/* ==========================================================
   FORMULARE (cile rychleho pridani + editace)
   ========================================================== */

/* ---------- Vydaj / Vklad ---------- */
const ExpenseAddScreen = (function(){
  function render(container, params){
    const editingTx = params.edit ? msTransactionById(params.edit) : null;
    let txType = editingTx ? editingTx.type : 'expense';
    let stageKey = (editingTx && editingTx.stage) || msGetCurrentStage();
    let dateVal = editingTx ? editingTx.date : (new Date().toISOString().slice(0,10));

    container.innerHTML = `
      <div class="topbar">
        <div class="back-btn" id="backBtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></div>
        <h1 id="formTitle">Nový výdaj</h1>
      </div>
      <div class="screen-scroll">
        <div id="typeToggle" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:12px">
          <button data-t="expense" style="height:38px;border:1px solid #ff7a86;color:#ff9aa3;background:rgba(255,122,134,.08);font-weight:800;cursor:pointer;font-size:11.5px">Výdaj</button>
          <button data-t="income" style="height:38px;border:1px solid var(--line);color:var(--muted);background:transparent;font-weight:800;cursor:pointer;font-size:11.5px">Vklad</button>
          <button data-t="planned" style="height:38px;border:1px solid var(--line);color:var(--muted);background:transparent;font-weight:800;cursor:pointer;font-size:11.5px">Plánovaný</button>
        </div>
        <p class="f-label">Částka</p>
        <div style="display:flex;align-items:baseline;gap:8px;border:1px solid #ff7a86;padding:9px 12px;margin-bottom:12px" id="amountBox">
          <input id="fAmount" value="${editingTx?editingTx.amount:''}" inputmode="numeric" placeholder="0" style="border:0;background:transparent;color:#ff9aa3;font-size:22px;font-weight:800;width:100%;font:inherit;outline:none"/><span style="color:#ff9aa3;font-weight:800">Kč</span>
        </div>
        <p class="f-label">Popis</p>
        <input class="f-input" id="fTitle" value="${editingTx?editingTx.title:''}" placeholder="Např. Beton C20/25" style="margin-bottom:12px"/>
        <div id="stageBlock">
          <p class="f-label">Etapa</p>
          <div class="dropdown" id="stageDropdown" style="margin-bottom:12px">
            <button class="dd-btn" id="stageDdBtn"><span class="left"><i id="stageDdDot"></i><span id="stageDdLabel">—</span></span></button>
            <div class="dd-panel" id="stageDdPanel"></div>
          </div>
        </div>
        <p class="f-label">Datum</p>
        <div style="display:flex;gap:8px;margin-bottom:0">
          <input class="f-input" id="fDate" value="" style="flex:1"/>
          <div class="icon-btn" id="calToggleBtn" style="flex:0 0 auto"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="1"/><path d="M8 3v4M16 3v4M3 10h18"/></svg></div>
        </div>
        <div id="miniCal" style="max-height:0;overflow:hidden;transition:max-height .2s ease">
          <div style="border:1px solid var(--line);background:var(--card-bg-2);border-radius:var(--radius);padding:10px;margin-top:8px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
              <b id="mcLabel" style="font-size:12px"></b>
              <div style="display:flex;gap:6px">
                <button id="mcPrev" style="width:24px;height:24px;border:1px solid var(--line);background:transparent;color:#fff;cursor:pointer">‹</button>
                <button id="mcNext" style="width:24px;height:24px;border:1px solid var(--line);background:transparent;color:#fff;cursor:pointer">›</button>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(7,1fr);margin-bottom:4px">
              ${['Po','Út','St','Čt','Pá','So','Ne'].map(d=>`<span style="text-align:center;font-size:8.5px;color:var(--muted);font-weight:800">${d}</span>`).join('')}
            </div>
            <div id="mcGrid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px"></div>
          </div>
        </div>
        <div id="receiptBlock" style="margin-top:12px">
          <p class="f-label">Účtenka</p>
          <div id="receiptArea"></div>
          <input type="file" accept="image/*" id="receiptInput" style="display:none"/>
        </div>
      </div>
      <div style="padding:12px 16px calc(20px + env(safe-area-inset-bottom));border-top:1px solid var(--line)">
        <button class="btn-primary" id="saveBtn" style="border-color:#ff7a86;color:#fff">${editingTx?'Uložit změny':'Uložit výdaj'}</button>
        ${editingTx?'<button class="btn-ghost" id="deleteBtn" style="margin-top:8px;color:#ff7a86">Smazat</button>':''}
      </div>
    `;
    container.querySelector('#backBtn').addEventListener('click', ()=> Router.go(params.back||'dashboard'));

    // --- uctenka: jedna fotka pripojena k tomuto konkretnimu vydaji ---
    let receiptDataUrl = (editingTx && editingTx.receipt) || null;
    let receiptChanged = false;
    function renderReceiptArea(){
      const area = container.querySelector('#receiptArea');
      if(receiptDataUrl){
        area.innerHTML = `
          <div style="display:flex;align-items:center;gap:10px">
            <div id="receiptThumb" style="width:52px;height:52px;border:1px solid var(--line);border-radius:4px;background-image:url(${receiptDataUrl});background-size:cover;background-position:center;cursor:pointer;flex:0 0 auto"></div>
            <div style="flex:1;font-size:11px;color:var(--muted)">Účtenka přiložena</div>
            <span id="receiptRemove" style="color:#ff7a86;cursor:pointer;font-size:11px">Odebrat</span>
          </div>`;
        area.querySelector('#receiptThumb').addEventListener('click', ()=>{
          const overlay = document.createElement('div');
          overlay.className = 'ms-overlay';
          overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:80;display:flex;align-items:center;justify-content:center';
          overlay.innerHTML = `<img src="${receiptDataUrl}" style="max-width:94%;max-height:90%;object-fit:contain"/>`;
          overlay.addEventListener('click', ()=> document.body.removeChild(overlay));
          document.body.appendChild(overlay);
        });
        area.querySelector('#receiptRemove').addEventListener('click', ()=>{
          receiptDataUrl = null; receiptChanged = true; renderReceiptArea();
        });
      } else {
        area.innerHTML = `<div id="receiptAddBtn" style="border:1px dashed var(--line);padding:11px;text-align:center;font-size:11.5px;color:var(--muted);cursor:pointer">+ Přiložit účtenku</div>`;
        area.querySelector('#receiptAddBtn').addEventListener('click', ()=> container.querySelector('#receiptInput').click());
      }
    }
    container.querySelector('#receiptInput').addEventListener('change', async (e)=>{
      const file = e.target.files[0];
      if(!file || !file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = ()=>{ receiptDataUrl = reader.result; receiptChanged = true; renderReceiptArea(); };
      reader.readAsDataURL(file);
      e.target.value = '';
    });
    renderReceiptArea();

    function applyType(){
      const isExpense = txType==='expense';
      const isPlanned = txType==='planned';
      const showStageEtc = isExpense || isPlanned;
      container.querySelector('#stageBlock').style.display = showStageEtc?'block':'none';
      container.querySelector('#receiptBlock').style.display = isExpense?'block':'none'; // uctenka dava smysl az kdyz je fakt zaplaceno
      const typeLabel = isExpense?'výdaj':(isPlanned?'plánovaný výdaj':'vklad');
      container.querySelector('#formTitle').textContent = editingTx ? `Upravit ${typeLabel}` : `Nový ${typeLabel}`;
      container.querySelector('#saveBtn').textContent = editingTx ? 'Uložit změny' : `Uložit ${typeLabel}`;
      const color = isExpense ? '#ff7a86' : (isPlanned ? '#ff9b32' : '#4dffab');
      const textColor = isExpense ? '#ff9aa3' : color;
      container.querySelector('#amountBox').style.borderColor = color;
      container.querySelectorAll('#amountBox input,#amountBox span').forEach(el=>el.style.color = textColor);
      container.querySelector('#saveBtn').style.borderColor = color;
      container.querySelectorAll('#typeToggle button').forEach(b=>{
        const active = b.dataset.t===txType;
        const bColor = b.dataset.t==='expense' ? '#ff7a86' : (b.dataset.t==='planned' ? '#ff9b32' : '#4dffab');
        b.style.borderColor = active ? bColor : 'var(--line)';
        b.style.color = active ? (b.dataset.t==='expense'?'#ff9aa3':bColor) : 'var(--muted)';
        b.style.background = active ? `color-mix(in srgb, ${bColor} 8%, transparent)` : 'transparent';
      });
    }
    container.querySelector('#typeToggle').addEventListener('click', (e)=>{
      const btn = e.target.closest('button'); if(!btn) return;
      txType = btn.dataset.t; applyType();
    });
    applyType();


    // --- datum: primy prepis nebo mini kalendar (misto jen type=date) ---
    const MONTHS = ['Leden','Únor','Březen','Duben','Květen','Červen','Červenec','Srpen','Září','Říjen','Listopad','Prosinec'];
    function formatDateCz(d){ return `${d.getDate()}. ${d.getMonth()+1}. ${d.getFullYear()}`; }
    let selectedDate = editingTx ? new Date(editingTx.date+'T00:00:00') : new Date();
    container.querySelector('#fDate').value = formatDateCz(selectedDate);
    const miniCal = container.querySelector('#miniCal');
    let mcYear = selectedDate.getFullYear(), mcMonth = selectedDate.getMonth();
    function renderMiniCal(){
      container.querySelector('#mcLabel').textContent = MONTHS[mcMonth] + ' ' + mcYear;
      const grid = container.querySelector('#mcGrid');
      grid.innerHTML = '';
      const firstDay = new Date(mcYear, mcMonth, 1);
      let startWeekday = firstDay.getDay(); startWeekday = startWeekday===0?6:startWeekday-1;
      const daysInMonth = new Date(mcYear, mcMonth+1, 0).getDate();
      for(let i=0;i<startWeekday;i++) grid.appendChild(document.createElement('div'));
      for(let d=1; d<=daysInMonth; d++){
        const isSel = selectedDate.getFullYear()===mcYear && selectedDate.getMonth()===mcMonth && selectedDate.getDate()===d;
        const cell = document.createElement('div');
        cell.style.cssText = `height:26px;display:flex;align-items:center;justify-content:center;font-size:10px;cursor:pointer;border-radius:3px;background:${isSel?'#b34cff':'transparent'};color:${isSel?'#fff':'#c7cee6'}`;
        cell.textContent = d;
        cell.addEventListener('click', ()=>{
          selectedDate = new Date(mcYear, mcMonth, d);
          container.querySelector('#fDate').value = formatDateCz(selectedDate);
          renderMiniCal();
          miniCal.style.maxHeight = '0';
        });
        grid.appendChild(cell);
      }
    }
    container.querySelector('#mcPrev').addEventListener('click', ()=>{ mcMonth--; if(mcMonth<0){mcMonth=11;mcYear--;} renderMiniCal(); });
    container.querySelector('#mcNext').addEventListener('click', ()=>{ mcMonth++; if(mcMonth>11){mcMonth=0;mcYear++;} renderMiniCal(); });
    container.querySelector('#calToggleBtn').addEventListener('click', ()=>{
      const isOpen = miniCal.style.maxHeight !== '0px' && miniCal.style.maxHeight !== '';
      miniCal.style.maxHeight = isOpen ? '0' : '280px';
      if(!isOpen) renderMiniCal();
    });
    container.querySelector('#fDate').addEventListener('change', (e)=>{
      const m = e.target.value.trim().match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);
      if(m){ selectedDate = new Date(Number(m[3]), Number(m[2])-1, Number(m[1])); mcYear=selectedDate.getFullYear(); mcMonth=selectedDate.getMonth(); renderMiniCal(); }
    });

    const stageDdBtn = container.querySelector('#stageDdBtn');
    const stageDdPanel = container.querySelector('#stageDdPanel');
    const selectedStages = msSelectedStages();
    selectedStages.forEach(s=>{
      const it = document.createElement('div');
      it.className = 'dd-item';
      it.innerHTML = `<i style="background:${s.color};display:inline-block;width:7px;height:7px;margin-right:8px"></i>${s.name}`;
      it.addEventListener('click', ()=>{
        stageKey = s.key;
        container.querySelector('#stageDdLabel').textContent = s.name;
        container.querySelector('#stageDdDot').style.background = s.color;
        stageDdPanel.classList.remove('open');
      });
      stageDdPanel.appendChild(it);
    });
    stageDdBtn.addEventListener('click', ()=> stageDdPanel.classList.toggle('open'));
    const initS = msStageByKey(stageKey) || selectedStages[0];
    if(initS){ stageKey = initS.key; container.querySelector('#stageDdLabel').textContent = initS.name; container.querySelector('#stageDdDot').style.background = initS.color; }

    container.querySelector('#saveBtn').addEventListener('click', async ()=>{
      const amount = Number((container.querySelector('#fAmount').value||'').replace(/\s/g,'')) || 0;
      if(amount<=0){ alert('Zadej částku.'); return; }
      const title = container.querySelector('#fTitle').value.trim() || (txType==='expense'?'Bez popisu':'Vklad na účet');
      const date = selectedDate.getFullYear()+'-'+String(selectedDate.getMonth()+1).padStart(2,'0')+'-'+String(selectedDate.getDate()).padStart(2,'0');
      const tx = { type:txType, title, amount, date };
      if(txType==='expense' || txType==='planned'){ tx.stage=stageKey; tx.category = null; } else { tx.stage=null; tx.category=null; }
      const saveBtn = container.querySelector('#saveBtn');
      const originalLabel = saveBtn.textContent;
      saveBtn.textContent = 'Ukládám…'; saveBtn.disabled = true;
      const saved = editingTx ? msUpdateTransaction(params.edit, tx) : msAddTransaction(tx);
      if(txType==='expense' && receiptChanged){
        if(receiptDataUrl) await msSetTransactionReceipt(saved.id, receiptDataUrl);
        else msRemoveTransactionReceipt(saved.id);
      }
      Router.go(params.back || 'dashboard');
    });
    if(editingTx){
      container.querySelector('#deleteBtn').addEventListener('click', async ()=>{
        if(!await Layout.confirmDialog('Opravdu smazat tuhle transakci? Nedá se to vrátit zpět.', 'Smazat')) return;
        msDeleteTransaction(params.edit);
        Router.go(params.back || 'dashboard');
      });
    }
    return { activeTab:'dashboard' };
  }
  return { render };
})();
Router.register('expense-add', ExpenseAddScreen);


/* ---------- Novy zapis do deniku ---------- */
const DiaryAddScreen = (function(){
  function render(container, params){
    const editingEntry = params && params.edit ? msDiaryEntryById(params.edit) : null;
    let important = editingEntry ? !!editingEntry.important : false;
    let stageKey = editingEntry ? editingEntry.stage : msGetCurrentStage();
    let selectedDate = editingEntry ? new Date(editingEntry.date+'T00:00:00') : new Date();
    let queueItems = editingEntry ? [] : msDiaryQueueResolved(); // {type, refId, label, preview, stage, addedAt} - fronta dava smysl jen pri NOVEM zapisu
    let extraPhotos = []; // nove fotky pridane primo tady pres "+" (fotoaparat/soubor), jeste nejsou v msPhotos()
    let galleryPicked = []; // fotky VYBRANE z jiz existujici Galerie appky - {id, thumb}, nemaji se znovu pridavat do msPhotos()
    function formatDateCz(d){ return `${d.getDate()}. ${d.getMonth()+1}. ${d.getFullYear()}`; }
    const MONTHS = ['Leden','Únor','Březen','Duben','Květen','Červen','Červenec','Srpen','Září','Říjen','Listopad','Prosinec'];

    const projects = msLoadProjects();
    const proj = projects.find(pr=>pr.id===msGetActiveProjectId()) || projects[0] || {};
    const meta = msDiaryMeta();

    // pokud fronta obsahuje polozky z konkretni etapy, tu preferujeme jako
    // vychozi - jinak aktualni etapu (Naradi se v deniku nikdy nenabizi)
    const stageVotes = {};
    queueItems.forEach(it=>{ if(it.stage) stageVotes[it.stage] = (stageVotes[it.stage]||0)+1; });
    const topStage = Object.keys(stageVotes).sort((a,b)=>stageVotes[b]-stageVotes[a])[0];
    if(topStage) stageKey = topStage;
    if(stageKey==='naradi') stageKey = null;

    container.innerHTML = `
      <div class="topbar">
        <div class="back-btn" id="backBtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></div>
        <h1>${editingEntry ? 'Upravit záznam' : 'Nový záznam'}</h1>
      </div>
      <div class="screen-scroll">
        <div id="impRow" style="display:flex;align-items:center;justify-content:space-between;border:1px solid var(--line);padding:11px 12px;margin-bottom:16px">
          <div><b style="display:flex;align-items:center;gap:6px;font-size:12.5px"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z"/></svg>Důležitý zápis</b><span style="font-size:10px;color:var(--muted)">Bude vždy nahoře při zobrazení této etapy</span></div>
          <div id="impSwitch" style="width:38px;height:22px;border-radius:11px;border:1px solid var(--line);position:relative;cursor:pointer;flex:0 0 auto"><i style="position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:var(--muted)"></i></div>
        </div>

        <div id="queueSection" style="display:none">
          <p class="f-label">Připraveno k zápisu</p>
          <div style="display:flex;gap:8px;overflow-x:auto;padding:2px 2px 8px;margin-bottom:2px;-webkit-overflow-scrolling:touch" id="queueGrid"></div>
          <p style="font-size:10px;color:var(--muted);margin:0 0 16px">Klepnutím dlaždici vynecháš z tohoto zápisu, zůstane na příště. Spravovat/natrvalo odebrat jde v Deníku přes <b style="color:var(--accent);cursor:pointer" id="goQueueLink">K zápisu</b>.</p>
        </div>

        <p class="f-label">Přidat fotky</p>
        <div style="display:flex;gap:8px;overflow-x:auto;padding:2px 2px 8px;margin-bottom:16px;-webkit-overflow-scrolling:touch" id="photoGrid"></div>

        <p class="section-label" style="margin-top:0">Povinné</p>
        <p class="f-label">Datum</p>
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <input class="f-input" id="fDate" value="" style="flex:1"/>
          <div class="icon-btn" id="calToggleBtn" style="flex:0 0 auto"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="1"/><path d="M8 3v4M16 3v4M3 10h18"/></svg></div>
        </div>
        <div id="miniCal" style="max-height:0;overflow:hidden;transition:max-height .2s ease;margin-bottom:0">
          <div style="border:1px solid var(--line);background:var(--card-bg-2);border-radius:var(--radius);padding:10px;margin-bottom:12px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
              <b id="mcLabel" style="font-size:12px"></b>
              <div style="display:flex;gap:6px">
                <button id="mcPrev" style="width:24px;height:24px;border:1px solid var(--line);background:transparent;color:#fff;cursor:pointer">‹</button>
                <button id="mcNext" style="width:24px;height:24px;border:1px solid var(--line);background:transparent;color:#fff;cursor:pointer">›</button>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(7,1fr);margin-bottom:4px">
              ${['Po','Út','St','Čt','Pá','So','Ne'].map(d=>`<span style="text-align:center;font-size:8.5px;color:var(--muted);font-weight:800">${d}</span>`).join('')}
            </div>
            <div id="mcGrid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px"></div>
          </div>
        </div>
        <div id="dayCountRow" style="display:none;font-size:10.5px;color:var(--muted);margin:-6px 0 12px"></div>

        <p class="f-label">Etapa</p>
        <div class="dropdown" id="stageDropdown" style="margin-bottom:12px">
          <button class="dd-btn" id="stageDdBtn"><span class="left"><i id="stageDdDot"></i><span id="stageDdLabel">—</span></span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 9l6 6 6-6"/></svg></button>
          <div class="dd-panel" id="stageDdPanel"></div>
        </div>

        <p class="f-label">Co se dělalo <span style="color:var(--muted);font-weight:600;text-transform:none;letter-spacing:0">(nepovinné, klidně jen fotky/dokumenty výše)</span></p>
        <textarea class="f-textarea" id="fText" placeholder="Např. Založena první řada Ytongu / Zabetonován věnec / Osazena okna…" style="margin-bottom:12px;min-height:70px">${editingEntry ? (editingEntry.text||'') : ''}</textarea>
        <input type="file" accept="image/*" multiple id="photoInput" style="display:none"/>

        <div id="detailsToggle" style="display:flex;align-items:center;justify-content:space-between;border:1px solid var(--line);padding:11px 12px;cursor:pointer">
          <b style="font-size:12.5px;color:var(--muted)">+ Přidat podrobnosti</b>
          <svg id="detailsChevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="color:var(--muted);transition:transform .15s"><path d="M6 9l6 6 6-6"/></svg>
        </div>
        <div id="detailsFields" style="max-height:0;overflow:hidden;transition:max-height .25s ease">
          <div style="padding-top:14px">
            <p class="f-label">Kdo pracoval</p>
            <input class="f-input" id="fWorker" value="${editingEntry ? (editingEntry.worker||'') : (meta.stavebnik||'')}" placeholder="Např. Firma Novák s.r.o. / Pepa Svoboda" style="margin-bottom:14px"/>
            <p class="f-label">Materiál</p>
            <input class="f-input" id="fMaterial" value="${editingEntry ? (editingEntry.material||'') : ''}" placeholder="Např. 12 ks překladů" style="margin-bottom:14px"/>
            <p class="f-label">Problém / poznámka</p>
            <textarea class="f-textarea" id="fIssue" placeholder="Cokoliv, co stojí za zaznamenání navíc…" style="margin-bottom:0;min-height:60px">${editingEntry ? (editingEntry.issue||'') : ''}</textarea>
          </div>
        </div>
      </div>
      <div style="padding:12px 16px calc(20px + env(safe-area-inset-bottom));border-top:1px solid var(--line)">
        <button class="btn-primary" id="saveBtn" style="border-color:#ffd35c">${editingEntry ? 'Uložit změny' : 'Uložit záznam'}</button>
        ${editingEntry ? '<button class="btn-ghost" id="deleteBtn" style="margin-top:8px;color:#ff7a86">Smazat záznam</button>' : ''}
      </div>
    `;
    container.querySelector('#backBtn').addEventListener('click', ()=> Router.back());

    // --- datum ---
    container.querySelector('#fDate').value = formatDateCz(selectedDate);
    const miniCal = container.querySelector('#miniCal');
    let mcYear = selectedDate.getFullYear(), mcMonth = selectedDate.getMonth();
    function updateDayCountRow(){
      const row = container.querySelector('#dayCountRow');
      if(proj.started && proj.startDate){
        const iso = selectedDate.getFullYear()+'-'+String(selectedDate.getMonth()+1).padStart(2,'0')+'-'+String(selectedDate.getDate()).padStart(2,'0');
        row.style.display = 'block';
        row.textContent = `Den stavby ${msDayCount(proj.startDate)} · doplní se automaticky`;
      } else {
        row.style.display = 'none';
      }
    }
    updateDayCountRow();
    function renderMiniCal(){
      container.querySelector('#mcLabel').textContent = MONTHS[mcMonth] + ' ' + mcYear;
      const grid = container.querySelector('#mcGrid');
      grid.innerHTML = '';
      const firstDay = new Date(mcYear, mcMonth, 1);
      let startWeekday = firstDay.getDay(); startWeekday = startWeekday===0?6:startWeekday-1;
      const daysInMonth = new Date(mcYear, mcMonth+1, 0).getDate();
      for(let i=0;i<startWeekday;i++) grid.appendChild(document.createElement('div'));
      for(let d=1; d<=daysInMonth; d++){
        const isSel = selectedDate.getFullYear()===mcYear && selectedDate.getMonth()===mcMonth && selectedDate.getDate()===d;
        const cell = document.createElement('div');
        cell.style.cssText = `height:26px;display:flex;align-items:center;justify-content:center;font-size:10px;cursor:pointer;border-radius:3px;background:${isSel?'#ffd35c':'transparent'};color:${isSel?'#04070f':'#c7cee6'}`;
        cell.textContent = d;
        cell.addEventListener('click', ()=>{
          selectedDate = new Date(mcYear, mcMonth, d);
          container.querySelector('#fDate').value = formatDateCz(selectedDate);
          renderMiniCal();
          updateDayCountRow();
          miniCal.style.maxHeight = '0';
        });
        grid.appendChild(cell);
      }
    }
    container.querySelector('#mcPrev').addEventListener('click', ()=>{ mcMonth--; if(mcMonth<0){mcMonth=11;mcYear--;} renderMiniCal(); });
    container.querySelector('#mcNext').addEventListener('click', ()=>{ mcMonth++; if(mcMonth>11){mcMonth=0;mcYear++;} renderMiniCal(); });
    container.querySelector('#calToggleBtn').addEventListener('click', ()=>{
      const isOpen = miniCal.style.maxHeight !== '0px' && miniCal.style.maxHeight !== '';
      miniCal.style.maxHeight = isOpen ? '0' : '280px';
      if(!isOpen) renderMiniCal();
    });

    // --- etapa (Naradi se v deniku nenabizi - nema zapisy) ---
    const stageDdBtn = container.querySelector('#stageDdBtn');
    const stageDdPanel = container.querySelector('#stageDdPanel');
    msSelectedStages().filter(s=>s.key!=='naradi' && s.key!=='projekt_povoleni').forEach(s=>{
      const it = document.createElement('div');
      it.className = 'dd-item';
      it.innerHTML = `<i style="background:${s.color};display:inline-block;width:7px;height:7px;margin-right:8px"></i>${s.name}`;
      it.addEventListener('click', ()=>{
        stageKey = s.key;
        container.querySelector('#stageDdLabel').textContent = s.name;
        container.querySelector('#stageDdDot').style.background = s.color;
        stageDdPanel.classList.remove('open');
      });
      stageDdPanel.appendChild(it);
    });
    stageDdBtn.addEventListener('click', ()=> stageDdPanel.classList.toggle('open'));
    const initS = msStageByKey(stageKey);
    if(initS){ container.querySelector('#stageDdLabel').textContent = initS.name; container.querySelector('#stageDdDot').style.background = initS.color; }
    else { container.querySelector('#stageDdLabel').textContent = 'Vyber etapu'; }

    // --- rozbalovaci podrobnosti ---
    let detailsOpen = false;
    const detailsFields = container.querySelector('#detailsFields');
    container.querySelector('#detailsToggle').addEventListener('click', ()=>{
      detailsOpen = !detailsOpen;
      detailsFields.style.maxHeight = detailsOpen ? '400px' : '0';
      container.querySelector('#detailsChevron').style.transform = detailsOpen ? 'rotate(180deg)' : 'rotate(0)';
    });

    const impSwitch = container.querySelector('#impSwitch');
    if(important){
      impSwitch.style.borderColor = '#ffd35c';
      impSwitch.querySelector('i').style.left = '18px';
      impSwitch.querySelector('i').style.background = '#ffd35c';
    }
    impSwitch.addEventListener('click', ()=>{
      important = !important;
      impSwitch.style.borderColor = important ? '#ffd35c' : 'var(--line)';
      impSwitch.querySelector('i').style.left = important ? '18px' : '2px';
      impSwitch.querySelector('i').style.background = important ? '#ffd35c' : 'var(--muted)';
    });

    // --- fronta pripraveneho materialu + rychle pridani nove fotky primo sem ---
    const ICONS = {
      photo: '<rect x="3" y="6" width="18" height="14" rx="1"/><circle cx="12" cy="13" r="3.5"/>',
      document: '<path d="M6 3h9l3 3v15H6z"/><path d="M9 10h6M9 14h6"/>',
      event: '<rect x="3" y="5" width="18" height="16" rx="1"/><path d="M8 3v4M16 3v4M3 10h18"/>',
      stage_complete: '<path d="M5 13l4 4L19 7"/>',
    };
    function resizeImage(file, maxDim){
      const attempt = new Promise((resolve, reject)=>{
        const reader = new FileReader();
        reader.onload = ()=>{
          const img = new Image();
          img.onload = ()=>{
            let {width,height} = img;
            if(width>height && width>maxDim){ height=height*maxDim/width; width=maxDim; }
            else if(height>maxDim){ width=width*maxDim/height; height=maxDim; }
            const canvas = document.createElement('canvas');
            canvas.width=width; canvas.height=height;
            canvas.getContext('2d').drawImage(img,0,0,width,height);
            resolve(canvas.toDataURL('image/jpeg',0.90));
          };
          img.onerror = ()=> reject(new Error('obrazek se nepodarilo rozkodovat'));
          img.src = reader.result;
        };
        reader.onerror = ()=> reject(new Error('soubor se nepodarilo precist'));
        reader.readAsDataURL(file);
      });
      // OPRAVA (1.8.2026): tahle funkce dřív nemela VUBEC zadne oseteni
      // chyby (ani onerror, natoz casovy limit) - kdyz telefon obrazek
      // nezvladl zpracovat, appka na to cekala navzdy, potichu, a fotka
      // se nikam neulozila (ani do zapisu, ani do Galerie). DULEZITE: casovy
      // limit musi zavodit s PUVODNIM (jeste nedokoncenym) pokusem, ne az s
      // jeho vysledkem - jinak by "zaseknuti" vubec nezachytil.
      const withTimeout = Promise.race([
        attempt,
        new Promise((_, reject)=> setTimeout(()=> reject(new Error('časový limit vypršel')), 12000))
      ]);
      return withTimeout.catch(e=>{ console.error('resizeImage selhalo', e); return null; });
    }
    function renderQueueGrid(){
      const section = container.querySelector('#queueSection');
      const grid = container.querySelector('#queueGrid');
      if(queueItems.length===0){ section.style.display = 'none'; return; }
      section.style.display = 'block';
      grid.innerHTML = '';
      const TILE = 76;
      queueItems.forEach((it,i)=>{
        const cell = document.createElement('div');
        const dim = it.selected===false;
        cell.style.cssText = `flex:0 0 auto;width:${TILE}px;height:${TILE}px;border:1px solid ${dim?'var(--line)':'var(--accent)'};border-radius:3px;position:relative;display:grid;place-items:center;overflow:hidden;cursor:pointer;opacity:${dim?0.4:1};${it.preview?`background-image:url(${it.preview});background-size:cover`:'background:var(--card-bg-2)'}`;
        if(!it.preview){
          cell.innerHTML = `<div style="text-align:center;padding:4px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[it.type]||ICONS.document}</svg><span style="display:block;font-size:7.5px;color:var(--muted);margin-top:2px;line-height:1.2;max-width:56px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${it.label}</span></div>`;
        }
        cell.addEventListener('click', ()=>{ it.selected = dim; renderQueueGrid(); });
        grid.appendChild(cell);
      });
    }
    function renderPhotoGrid(){
      const grid = container.querySelector('#photoGrid');
      grid.innerHTML = '';
      const TILE = 76;
      extraPhotos.forEach((dataUrl,i)=>{
        const cell = document.createElement('div');
        cell.style.cssText = `flex:0 0 auto;width:${TILE}px;height:${TILE}px;border:1px solid var(--accent);border-radius:3px;position:relative;background-image:url(${dataUrl});background-size:cover`;
        const rm = document.createElement('span');
        rm.textContent = '✕';
        rm.style.cssText = 'position:absolute;top:-6px;right:-6px;width:16px;height:16px;background:var(--card-bg-2);border:1px solid var(--line);border-radius:50%;display:grid;place-items:center;font-size:9px;cursor:pointer';
        rm.addEventListener('click', ()=>{ extraPhotos.splice(i,1); renderPhotoGrid(); });
        cell.appendChild(rm);
        grid.appendChild(cell);
      });
      galleryPicked.forEach((p,i)=>{
        const cell = document.createElement('div');
        cell.style.cssText = `flex:0 0 auto;width:${TILE}px;height:${TILE}px;border:1px solid var(--accent);border-radius:3px;position:relative;background-image:url(${p.thumb});background-size:cover`;
        const rm = document.createElement('span');
        rm.textContent = '✕';
        rm.style.cssText = 'position:absolute;top:-6px;right:-6px;width:16px;height:16px;background:var(--card-bg-2);border:1px solid var(--line);border-radius:50%;display:grid;place-items:center;font-size:9px;cursor:pointer';
        rm.addEventListener('click', ()=>{ galleryPicked.splice(i,1); renderPhotoGrid(); });
        cell.appendChild(rm);
        grid.appendChild(cell);
      });
      const addCell = document.createElement('div');
      addCell.style.cssText = `flex:0 0 auto;width:${TILE}px;height:${TILE}px;border:1px dashed var(--line);border-radius:3px;display:grid;place-items:center;cursor:pointer;color:var(--muted)`;
      addCell.title = 'Vyfotit / nahrát ze zařízení';
      addCell.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
      addCell.addEventListener('click', ()=> container.querySelector('#photoInput').click());
      grid.appendChild(addCell);

      const pickCell = document.createElement('div');
      pickCell.style.cssText = `flex:0 0 auto;width:${TILE}px;height:${TILE}px;border:1px dashed var(--line);border-radius:3px;display:grid;place-items:center;cursor:pointer;color:var(--muted)`;
      pickCell.title = 'Vybrat z galerie';
      pickCell.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10.5" r="1.5"/><path d="M21 15l-5-5L5 19"/></svg>';
      pickCell.addEventListener('click', openGalleryPicker);
      grid.appendChild(pickCell);
    }

    function openGalleryPicker(){
      const already = new Set(galleryPicked.map(p=>p.id));
      const allPhotos = msPhotos().slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).filter(p=>p.thumb);
      const picked = new Set(already);
      const overlay = document.createElement('div');
      overlay.className = 'ms-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;background:var(--bg);z-index:90;display:flex;flex-direction:column';
      overlay.innerHTML = `
        <div class="topbar">
          <div class="back-btn" id="pickerCloseBtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></div>
          <h1>Vybrat z galerie</h1>
        </div>
        <div class="screen-scroll" style="padding:10px 12px">
          ${allPhotos.length===0 ? '<p class="empty-msg">Zatím tu nemáš žádné fotky.</p>' : `<div id="pickerGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px"></div>`}
        </div>
        <div style="padding:12px 16px calc(16px + env(safe-area-inset-bottom));border-top:1px solid var(--line)">
          <button class="btn-primary" id="pickerConfirmBtn">Přidat vybrané</button>
        </div>
      `;
      document.body.appendChild(overlay);
      overlay.querySelector('#pickerCloseBtn').addEventListener('click', ()=> document.body.removeChild(overlay));
      const pickerGrid = overlay.querySelector('#pickerGrid');
      if(pickerGrid){
        allPhotos.forEach(p=>{
          const cell = document.createElement('div');
          cell.style.cssText = `aspect-ratio:1;border-radius:3px;border:2px solid ${picked.has(p.id)?'var(--accent)':'transparent'};background:url(${p.thumb}) center/cover;position:relative;cursor:pointer`;
          if(picked.has(p.id)){
            cell.innerHTML = '<span style="position:absolute;top:4px;right:4px;width:18px;height:18px;background:var(--accent);border-radius:50%;display:grid;place-items:center;color:#fff;font-size:11px">✓</span>';
          }
          cell.addEventListener('click', ()=>{
            if(picked.has(p.id)){ picked.delete(p.id); } else { picked.add(p.id); }
            cell.style.borderColor = picked.has(p.id) ? 'var(--accent)' : 'transparent';
            cell.innerHTML = picked.has(p.id) ? '<span style="position:absolute;top:4px;right:4px;width:18px;height:18px;background:var(--accent);border-radius:50%;display:grid;place-items:center;color:#fff;font-size:11px">✓</span>' : '';
          });
          pickerGrid.appendChild(cell);
        });
      }
      overlay.querySelector('#pickerConfirmBtn').addEventListener('click', ()=>{
        galleryPicked = allPhotos.filter(p=>picked.has(p.id)).map(p=>({id:p.id, thumb:p.thumb}));
        document.body.removeChild(overlay);
        renderPhotoGrid();
      });
    }
    container.querySelector('#photoInput').addEventListener('change', async (e)=>{
      for(const file of e.target.files){ if(!file.type.startsWith('image/')) continue; const r = await resizeImage(file,2000); if(r) extraPhotos.push(r); else alert('Jednu z fotek se nepodařilo zpracovat, zkus to prosím znovu.'); }
      renderPhotoGrid();
    });
    renderQueueGrid();
    renderPhotoGrid();
    container.querySelector('#goQueueLink').addEventListener('click', ()=> Router.go('diary-queue'));

    container.querySelector('#saveBtn').addEventListener('click', async ()=>{
      const included = queueItems.filter(it=>it.selected!==false);
      const text = container.querySelector('#fText').value.trim();
      if(!text && included.length===0 && extraPhotos.length===0 && galleryPicked.length===0 && !(editingEntry && (editingEntry.photos||[]).length)){ alert('Napiš prosím pár slov, nebo vyber aspoň jednu dlaždici.'); return; }
      if(!stageKey){ alert('Vyber prosím etapu.'); return; }
      const saveBtn = container.querySelector('#saveBtn');
      const originalLabel = saveBtn.textContent;
      saveBtn.disabled = true; saveBtn.textContent = 'Ukládám…';
      try{
        const worker = container.querySelector('#fWorker').value.trim();
        const material = container.querySelector('#fMaterial').value.trim();
        const issue = container.querySelector('#fIssue').value.trim();
        const date = selectedDate.getFullYear()+'-'+String(selectedDate.getMonth()+1).padStart(2,'0')+'-'+String(selectedDate.getDate()).padStart(2,'0');
        // OPRAVA (1.8.2026): fotky se zpracovavaji JEDNA PO DRUHE (ne vsechny
        // najednou pres Promise.all), a appka u tlacitka ukazuje postup
        // ("Zpracovávám fotku 2 z 3…") - radeji ať appka viditelne chvíli
        // pracuje, než aby se tvářila hotovo a přitom něco potichu vynechala.
        // nove fotky pridane primo tady (+) se ulozi i do Galerie, at jsou videt i tam
        const newPhotos = [];
        for(let i=0;i<extraPhotos.length;i++){
          saveBtn.textContent = `Ukládám fotku ${i+1} z ${extraPhotos.length}…`;
          const saved = await msAddPhoto({ stage: stageKey, thumb: extraPhotos[i], caption: null });
          if(saved){ newPhotos.push(saved); }
          else{ console.error('msAddPhoto vratilo null pro fotku', i); }
        }
        saveBtn.textContent = 'Ukládám…';
        const newPhotoIds = newPhotos.filter(Boolean).map(p=>p.id);
        // fotky vybrane z JIZ EXISTUJICI galerie se znovu nepridavaji do msPhotos() -
        // jen se na ne odkazuje (referId), presne jako u polozek z fronty
        const items = included.map(it=>({type:it.type, refId:it.refId}))
          .concat(newPhotoIds.map(id=>({type:'photo', refId:id})))
          .concat(galleryPicked.map(p=>({type:'photo', refId:p.id})));
        const rawPhotos = included.filter(it=>it.type==='photo').map(it=>it.preview)
          .concat(extraPhotos)
          .concat(galleryPicked.map(p=>p.thumb));
        // OPRAVA: appka fotku u zapisu do deniku zobrazuje jen jako maly
        // nahled (44px v seznamu) - vkladat ji v puvodni velikosti (2000px,
        // stejne jako do Galerie) by zbytecne nafoukvalo cely "snimek" dat,
        // ktery appka posila na server kvuli sdileni, a mohlo to vest ke
        // ztrate fotky pri prenosu (prilis velky payload). Plna velikost
        // zustava zachovana v Galerii (msAddPhoto vyse), tady jde jen o
        // malou kopii pro nahled primo v zapisu.
        const photos = await Promise.all(rawPhotos.map(p => msResizeDataUrl(p, 400, 0.6)));
        if(editingEntry){
          const mergedPhotos = (editingEntry.photos||[]).concat(photos);
          const mergedItems = (editingEntry.items||[]).concat(items);
          msUpdateDiaryEntry(editingEntry.id, { stage: stageKey, date, text, worker: worker||null, material: material||null, issue: issue||null, important, photos: mergedPhotos, items: mergedItems });
        } else {
          msAddDiaryEntry({ stage: stageKey, date, text, worker: worker||null, material: material||null, issue: issue||null, important, photos, items });
        }
        // z fronty zmizi jen to, co jsme fakt pouzili v tomhle zapisu - nevybrane
        // dlazdice (a X uz odebrane) zustavaji/jsou pryc uz z fronty samotne,
        // ne z celeho seznamu najednou
        included.forEach(it=> msUnqueueFromDiary(it.type, it.refId));
        Router.go('diary');
      }catch(e){
        // OPRAVA (31.7.2026): drive nezachycena chyba (napr. vzacne selhani
        // IndexedDB u jedne z fotek) tady potichu presekla celou funkci -
        // fotka se do Galerie mohla ulozit, ale samotny zapis do Deniku uz
        // vubec nevznikl, bez jakekoli hlasky. Ted appka aspon rekne, ze
        // se to nepovedlo, a nechá formular otevreny, at to jde zkusit znovu.
        console.error('Ulozeni zapisu do deniku selhalo', e);
        saveBtn.disabled = false; saveBtn.textContent = originalLabel;
        alert('Zápis se nepodařilo uložit. Zkus to prosím znovu.');
      }
    });
    if(editingEntry){
      container.querySelector('#deleteBtn').addEventListener('click', async ()=>{
        if(!await Layout.confirmDialog('Opravdu smazat tenhle zápis? Nedá se to vrátit zpět.', 'Smazat')) return;
        msDeleteDiaryEntry(editingEntry.id);
        Router.go('diary');
      });
    }
    return { activeTab:'diary' };
  }
  return { render };
})();
Router.register('diary-add', DiaryAddScreen);


/* ---------- Nova udalost ---------- */
const EventAddScreen = (function(){
  function render(container, params){
    const editing = params && params.eventId ? msEvents().find(e=>e.id===params.eventId) : null;
    container.innerHTML = `
      <div class="topbar">
        <div class="back-btn" id="backBtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></div>
        <h1>${editing ? 'Upravit událost' : 'Nová událost'}</h1>
      </div>
      <div class="screen-scroll">
        <p class="f-label">Název *</p>
        <input class="f-input" id="fTitle" value="${editing ? editing.title : ''}" placeholder="Např. Návštěva statika" style="margin-bottom:12px"/>
        <p class="f-label">Datum *</p>
        <input class="f-input" id="fDate" type="date" value="${editing ? editing.date : new Date().toISOString().slice(0,10)}" style="margin-bottom:12px"/>
        <div id="timeBlock" style="display:${editing && !editing.time ? 'none' : 'block'}">
          <p class="f-label">Čas</p>
          <input class="f-input" id="fTime" type="time" value="${editing && editing.time ? editing.time : '09:00'}" style="margin-bottom:12px"/>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;border:1px solid var(--line);padding:11px 12px;margin-bottom:10px">
          <b style="font-size:12.5px">Celodenní událost</b>
          <div id="allDaySwitch" style="width:38px;height:22px;border-radius:11px;border:1px solid ${editing && !editing.time ? '#25b7ff' : 'var(--line)'};position:relative;cursor:pointer"><i style="position:absolute;top:2px;left:${editing && !editing.time ? '18px' : '2px'};width:16px;height:16px;border-radius:50%;background:${editing && !editing.time ? '#25b7ff' : 'var(--muted)'}"></i></div>
        </div>
        ${editing ? '' : `
        <div style="display:flex;align-items:center;justify-content:space-between;border:1px solid var(--line);padding:11px 12px">
          <div><b style="font-size:12.5px">Připravit pro další zápis</b><span style="display:block;font-size:10.5px;color:var(--muted)">Objeví se jako dlaždice u příštího zápisu do deníku</span></div>
          <div id="queueSwitch" data-on="0" style="width:38px;height:22px;border-radius:11px;border:1px solid var(--line);position:relative;cursor:pointer;flex:0 0 auto"><i style="position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:var(--muted)"></i></div>
        </div>`}
      </div>
      <div style="padding:12px 16px calc(20px + env(safe-area-inset-bottom));border-top:1px solid var(--line)">
        <button class="btn-primary" id="saveBtn" style="border-color:#25b7ff">${editing ? 'Uložit změny' : 'Uložit událost'}</button>
      </div>
    `;
    container.querySelector('#backBtn').addEventListener('click', ()=> Router.go(editing ? 'calendar' : 'dashboard'));
    let allDay = !!(editing && !editing.time);
    const sw = container.querySelector('#allDaySwitch');
    sw.addEventListener('click', ()=>{
      allDay = !allDay;
      sw.style.borderColor = allDay ? '#25b7ff' : 'var(--line)';
      sw.querySelector('i').style.left = allDay ? '18px' : '2px';
      sw.querySelector('i').style.background = allDay ? '#25b7ff' : 'var(--muted)';
      container.querySelector('#timeBlock').style.display = allDay ? 'none' : 'block';
    });
    const queueSwitch = container.querySelector('#queueSwitch');
    if(queueSwitch){
      queueSwitch.addEventListener('click', ()=>{
        const on = queueSwitch.dataset.on === '1';
        queueSwitch.dataset.on = on ? '0' : '1';
        queueSwitch.style.borderColor = on ? 'var(--line)' : 'var(--accent)';
        queueSwitch.querySelector('i').style.left = on ? '2px' : '18px';
        queueSwitch.querySelector('i').style.background = on ? 'var(--muted)' : 'var(--accent)';
      });
    }
    container.querySelector('#saveBtn').addEventListener('click', ()=>{
      const title = container.querySelector('#fTitle').value.trim();
      const date = container.querySelector('#fDate').value;
      if(!title || !date){ alert('Vyplň název a datum.'); return; }
      const time = allDay ? null : container.querySelector('#fTime').value;
      if(editing){
        msUpdateEvent(editing.id, { title, date, time });
        Router.go('calendar');
      } else {
        const saved = msAddEvent({ title, date, time });
        if(queueSwitch && queueSwitch.dataset.on === '1') msQueueForDiary('event', saved.id);
        Router.go('dashboard');
      }
    });
    return { activeTab:'dashboard' };
  }
  return { render };
})();
Router.register('event-add', EventAddScreen);

const TaskAddScreen = (function(){
  function render(container, params){
    const editing = params && params.taskId ? msTasks().find(t=>t.id===params.taskId) : null;
    let mode = editing ? (editing.dateMode || 'date') : 'date'; // 'none' | 'date' | 'deadline'
    container.innerHTML = `
      <div class="topbar">
        <div class="back-btn" id="backBtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></div>
        <h1>${editing ? 'Upravit úkol' : 'Nový úkol'}</h1>
      </div>
      <div class="screen-scroll">
        <p class="f-label">Co je potřeba udělat *</p>
        <input class="f-input" id="fTitle" value="${editing ? editing.title : ''}" placeholder="Např. Dodělat plot" style="margin-bottom:14px"/>

        <p class="f-label">Termín</p>
        <div id="modeSeg" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:12px">
          <button data-mode="none" style="height:40px;border:1px solid var(--line);background:transparent;color:var(--text-main);font-size:11px;font-weight:700;cursor:pointer">Bez termínu</button>
          <button data-mode="date" style="height:40px;border:1px solid var(--line);background:transparent;color:var(--text-main);font-size:11px;font-weight:700;cursor:pointer">Konkrétní den</button>
          <button data-mode="deadline" style="height:40px;border:1px solid var(--line);background:transparent;color:var(--text-main);font-size:11px;font-weight:700;cursor:pointer">Deadline</button>
        </div>

        <div id="dateBlock" style="display:none">
          <p class="f-label" id="dateLabel">Datum *</p>
          <input class="f-input" id="fDate" type="date" value="${editing && editing.date ? editing.date : new Date().toISOString().slice(0,10)}" style="margin-bottom:12px"/>
        </div>
        <p id="noneHint" style="display:none;font-size:11px;color:var(--muted);margin:-2px 0 12px;line-height:1.5">Úkol bez termínu se bude v Kalendáři zobrazovat každý den u dneška, dokud ho nesplníš. Po splnění zůstane zaznamenaný jen v den, kdy jsi ho dokončil.</p>
      </div>
      <div style="padding:12px 16px calc(20px + env(safe-area-inset-bottom));border-top:1px solid var(--line)">
        <button class="btn-primary" id="saveBtn" style="border-color:#ff9b32">${editing ? 'Uložit změny' : 'Uložit úkol'}</button>
      </div>
    `;
    container.querySelector('#backBtn').addEventListener('click', ()=> Router.go(editing ? 'calendar' : 'dashboard'));

    const modeBtns = container.querySelectorAll('#modeSeg button');
    function refreshMode(){
      modeBtns.forEach(b=>{
        const active = b.dataset.mode === mode;
        b.style.borderColor = active ? '#ff9b32' : 'var(--line)';
        b.style.color = active ? '#ff9b32' : 'var(--text-main)';
        b.style.background = active ? 'color-mix(in srgb, #ff9b32 10%, transparent)' : 'transparent';
      });
      container.querySelector('#dateBlock').style.display = mode==='none' ? 'none' : 'block';
      container.querySelector('#dateLabel').textContent = mode==='deadline' ? 'Dokončit do *' : 'Datum *';
      container.querySelector('#noneHint').style.display = mode==='none' ? 'block' : 'none';
    }
    modeBtns.forEach(b=> b.addEventListener('click', ()=>{ mode = b.dataset.mode; refreshMode(); }));
    refreshMode();

    container.querySelector('#saveBtn').addEventListener('click', ()=>{
      const title = container.querySelector('#fTitle').value.trim();
      if(!title){ alert('Vyplň, co je potřeba udělat.'); return; }
      const date = mode==='none' ? null : container.querySelector('#fDate').value;
      if(mode!=='none' && !date){ alert('Vyplň prosím datum.'); return; }
      const patch = { title, date, dateMode: mode };
      if(editing){ msUpdateTask(editing.id, patch); Router.go('calendar'); }
      else { msAddTask(patch); Router.go('dashboard'); }
    });
    return { activeTab:'dashboard' };
  }
  return { render };
})();
Router.register('task-add', TaskAddScreen);


/* ---------- Nova fotka ---------- */
const PhotoAddScreen = (function(){
  function render(container){
    let photos = [];
    let stageKey = msGetCurrentStage();

    container.innerHTML = `
      <div class="topbar">
        <div class="back-btn" id="backBtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></div>
        <h1>Přidat fotku</h1>
      </div>
      <div class="screen-scroll">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
          <div id="btnCamera" style="border:1px dashed var(--line);padding:16px 8px;text-align:center;cursor:pointer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="14" rx="1"/><circle cx="12" cy="13" r="3.5"/></svg>
            <b style="display:block;font-size:11.5px;margin-top:6px">Vyfotit</b>
          </div>
          <div id="btnGallery" style="border:1px dashed var(--line);padding:16px 8px;text-align:center;cursor:pointer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="1"/><circle cx="9" cy="11" r="2"/></svg>
            <b style="display:block;font-size:11.5px;margin-top:6px">Z galerie</b>
          </div>
        </div>
        <input type="file" accept="image/*" capture="environment" id="cameraInput" style="display:none"/>
        <input type="file" accept="image/*" multiple id="galleryInput" style="display:none"/>
        <p class="f-label">Vybráno (<span id="selCount">0</span>)</p>
        <div id="thumbGrid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px"></div>
        <p class="f-label">Etapa</p>
        <div class="dropdown" id="stageDropdown" style="margin-bottom:12px">
          <button class="dd-btn" id="stageDdBtn"><span class="left"><i id="stageDdDot"></i><span id="stageDdLabel">—</span></span></button>
          <div class="dd-panel" id="stageDdPanel"></div>
        </div>
        <p class="f-label">Popisek (nepovinné)</p>
        <input class="f-input" id="fCaption" placeholder="Např. Betonáž základové desky" style="margin-bottom:12px"/>
        <div style="display:flex;align-items:center;justify-content:space-between;border:1px solid var(--line);padding:11px 12px">
          <div><b style="font-size:12.5px">Připravit pro další zápis</b><span style="display:block;font-size:10.5px;color:var(--muted)">Objeví se jako dlaždice u příštího zápisu do deníku</span></div>
          <div id="queueSwitch" data-on="0" style="width:38px;height:22px;border-radius:11px;border:1px solid var(--line);position:relative;cursor:pointer;flex:0 0 auto"><i style="position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:var(--muted)"></i></div>
        </div>
      </div>
      <div style="padding:12px 16px calc(20px + env(safe-area-inset-bottom));border-top:1px solid var(--line)">
        <button class="btn-primary" id="saveBtn" style="border-color:#b34cff">Nahrát fotky</button>
      </div>
    `;
    container.querySelector('#backBtn').addEventListener('click', ()=> Router.go('dashboard'));

    function resizeImage(file, maxDim){
      const attempt = new Promise((resolve, reject)=>{
        const reader = new FileReader();
        reader.onload = ()=>{
          const img = new Image();
          img.onload = ()=>{
            let {width,height} = img;
            if(width>height && width>maxDim){ height=height*maxDim/width; width=maxDim; }
            else if(height>maxDim){ width=width*maxDim/height; height=maxDim; }
            const canvas = document.createElement('canvas');
            canvas.width=width; canvas.height=height;
            canvas.getContext('2d').drawImage(img,0,0,width,height);
            resolve(canvas.toDataURL('image/jpeg',0.90));
          };
          img.onerror = ()=> reject(new Error('obrazek se nepodarilo rozkodovat'));
          img.src = reader.result;
        };
        reader.onerror = ()=> reject(new Error('soubor se nepodarilo precist'));
        reader.readAsDataURL(file);
      });
      // OPRAVA (1.8.2026): tahle funkce dřív nemela VUBEC zadne oseteni
      // chyby (ani onerror, natoz casovy limit) - kdyz telefon obrazek
      // nezvladl zpracovat, appka na to cekala navzdy, potichu, a fotka
      // se nikam neulozila (ani do zapisu, ani do Galerie). DULEZITE: casovy
      // limit musi zavodit s PUVODNIM (jeste nedokoncenym) pokusem, ne az s
      // jeho vysledkem - jinak by "zaseknuti" vubec nezachytil.
      const withTimeout = Promise.race([
        attempt,
        new Promise((_, reject)=> setTimeout(()=> reject(new Error('časový limit vypršel')), 12000))
      ]);
      return withTimeout.catch(e=>{ console.error('resizeImage selhalo', e); return null; });
    }
    function renderThumbs(){
      const grid = container.querySelector('#thumbGrid');
      grid.innerHTML = photos.map((dataUrl,i)=>`<div style="aspect-ratio:1;border:1px solid #b34cff;background-image:url(${dataUrl});background-size:cover;position:relative">
        <span data-i="${i}" class="rm" style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;background:var(--card-bg-2);border:1px solid var(--line);border-radius:50%;display:grid;place-items:center;font-size:10px;cursor:pointer">✕</span>
      </div>`).join('');
      grid.querySelectorAll('.rm').forEach(el=> el.addEventListener('click', ()=>{ photos.splice(Number(el.dataset.i),1); renderThumbs(); }));
      container.querySelector('#selCount').textContent = photos.length;
    }
    async function handleFiles(fileList){
      for(const file of fileList){ if(!file.type.startsWith('image/')) continue; const r = await resizeImage(file,2000); if(r) photos.push(r); else alert('Jednu z fotek se nepodařilo zpracovat, zkus to prosím znovu.'); }
      renderThumbs();
    }
    container.querySelector('#cameraInput').addEventListener('change', e=>handleFiles(e.target.files));
    container.querySelector('#galleryInput').addEventListener('change', e=>handleFiles(e.target.files));
    container.querySelector('#btnCamera').addEventListener('click', ()=> container.querySelector('#cameraInput').click());
    container.querySelector('#btnGallery').addEventListener('click', ()=> container.querySelector('#galleryInput').click());
    renderThumbs();

    const stageDdBtn = container.querySelector('#stageDdBtn');
    const stageDdPanel = container.querySelector('#stageDdPanel');
    msSelectedStages().forEach(s=>{
      const it = document.createElement('div');
      it.className = 'dd-item';
      it.innerHTML = `<i style="background:${s.color};display:inline-block;width:7px;height:7px;margin-right:8px"></i>${s.name}`;
      it.addEventListener('click', ()=>{ stageKey=s.key; container.querySelector('#stageDdLabel').textContent=s.name; container.querySelector('#stageDdDot').style.background=s.color; stageDdPanel.classList.remove('open'); });
      stageDdPanel.appendChild(it);
    });
    stageDdBtn.addEventListener('click', ()=> stageDdPanel.classList.toggle('open'));
    const initS = msStageByKey(stageKey);
    if(initS){ container.querySelector('#stageDdLabel').textContent = initS.name; container.querySelector('#stageDdDot').style.background = initS.color; }

    const queueSwitch = container.querySelector('#queueSwitch');
    queueSwitch.addEventListener('click', ()=>{
      const on = queueSwitch.dataset.on === '1';
      queueSwitch.dataset.on = on ? '0' : '1';
      queueSwitch.style.borderColor = on ? 'var(--line)' : 'var(--accent)';
      queueSwitch.querySelector('i').style.left = on ? '2px' : '18px';
      queueSwitch.querySelector('i').style.background = on ? 'var(--muted)' : 'var(--accent)';
    });

    const saveBtn = container.querySelector('#saveBtn');
    saveBtn.addEventListener('click', async ()=>{
      if(photos.length===0){ alert('Nejdřív vyber nebo vyfoť aspoň jednu fotku.'); return; }
      const caption = container.querySelector('#fCaption').value.trim() || null;
      const wantsQueue = queueSwitch.dataset.on === '1' && stageKey !== 'naradi';
      const originalLabel = saveBtn.textContent;
      saveBtn.textContent = 'Ukládám…'; saveBtn.disabled = true;
      let failed = 0;
      for(const dataUrl of photos){
        const saved = await msAddPhoto({ stage: stageKey, thumb: dataUrl, caption });
        if(!saved){ failed++; continue; }
        if(wantsQueue) msQueueForDiary('photo', saved.id);
      }
      if(failed>0){
        saveBtn.textContent = originalLabel; saveBtn.disabled = false;
        alert(`${failed} z ${photos.length} fotek se nepodařilo uložit - úložiště telefonu je pravděpodobně plné. Zkus uvolnit místo (např. smazat pár starších fotek) a zkusit to znovu.`);
        return;
      }
      Router.go('dashboard');
    });
    return { activeTab:'dashboard' };
  }
  return { render };
})();
Router.register('photo-add', PhotoAddScreen);
