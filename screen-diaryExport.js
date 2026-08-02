/* ==========================================================
   GENERATOR STAVEBNIHO DENIKU - skutecne PDF (jsPDF).
   Krok 1: titulni udaje (pamatuji se pro priste).
   Krok 2: "Cely denik" nebo "Jedna etapa" - pokud uz prijdeme
   s konkretni etapou (napr. z Deniku s aktivnim filtrem, nebo
   z detailu etapy), krok 2 se preskoci a generuje se rovnou.
   Naradi se do deniku vubec nenabizi (nikdy nema zapisy).
   ========================================================== */
const DiaryExportScreen = (function(){
  function render(container, params){
    const presetStage = params && params.stage && params.stage!=='all' && params.stage!=='naradi' ? params.stage : null;

    function drawStep1(){
      const savedMeta = msDiaryMeta();
      const projects = msLoadProjects();
      const p = projects.find(pr=>pr.id===msGetActiveProjectId()) || projects[0] || {};
      // appka uz zna nazev a lokaci z projektu - nenechame o to uzivatele
      // zbytecne znovu zadat, jen kdyz uz drive rucne zadal neco jineho
      const meta = Object.assign({}, savedMeta, {
        nazev: savedMeta.nazev || p.name || null,
        misto: savedMeta.misto || p.location || null,
      });
      container.innerHTML = `
        <div class="topbar">
          <div class="back-btn" id="backBtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></div>
          <h1>Titulní strana</h1>
        </div>
        <div class="screen-scroll">
          <p style="font-size:15px;font-weight:800;margin:2px 0 4px">Doplňte údaje pro titulní stranu</p>
          <p style="font-size:11px;color:var(--muted);margin:0 0 14px;line-height:1.5">Tyto informace budou použity na titulní stránku deníku. Zapamatujeme si je pro příště.</p>
          <p class="f-label">Název stavby *</p><input class="f-input" id="mNazev" value="${meta.nazev||''}" placeholder="Zadejte název stavby" style="margin-bottom:10px"/>
          <p class="f-label">Místo stavby *</p><input class="f-input" id="mMisto" value="${meta.misto||''}" placeholder="Zadejte místo stavby" style="margin-bottom:10px"/>
          <p class="f-label">Stavebník *</p><input class="f-input" id="mStavebnik" value="${meta.stavebnik||''}" placeholder="Zadejte jméno nebo název stavebníka" style="margin-bottom:10px"/>
          <p class="f-label">Projektant</p><input class="f-input" id="mProjektant" value="${meta.projektant||''}" placeholder="Zadejte jméno projektanta (volitelné)" style="margin-bottom:10px"/>
          <p class="f-label">Stavební dozor</p><input class="f-input" id="mDozor" value="${meta.dozor||''}" placeholder="Zadejte jméno stavebního dozoru (volitelné)" style="margin-bottom:10px"/>
          <p class="f-label">Parcelní číslo</p><input class="f-input" id="mParcela" value="${meta.parcela||''}" placeholder="Např. 123/45" style="margin-bottom:10px"/>
          <p class="f-label">Katastrální území</p><input class="f-input" id="mKatastr" value="${meta.katastr||''}" placeholder="Např. Malé Březno u Mostu" style="margin-bottom:10px"/>
          <p class="f-label">Číslo stavebního povolení</p><input class="f-input" id="mPovoleni" value="${meta.povoleni||''}" placeholder="Např. SÚ/1234/2026" style="margin-bottom:10px"/>
          <p style="font-size:10.5px;color:var(--muted);margin-top:4px">* Označuje povinný údaj.</p>
        </div>
        <div style="padding:12px 16px calc(20px + env(safe-area-inset-bottom));border-top:1px solid var(--line)">
          <button class="btn-primary" id="nextBtn">Pokračovat →</button>
        </div>
      `;
      container.querySelector('#backBtn').addEventListener('click', ()=> Router.go('diary'));
      container.querySelector('#nextBtn').addEventListener('click', ()=>{
        const nazev = container.querySelector('#mNazev').value.trim();
        const misto = container.querySelector('#mMisto').value.trim();
        const stavebnik = container.querySelector('#mStavebnik').value.trim();
        if(!nazev||!misto||!stavebnik){ alert('Vyplň prosím povinné údaje.'); return; }
        msSetDiaryMeta({
          nazev, misto, stavebnik,
          projektant: container.querySelector('#mProjektant').value.trim()||null,
          dozor: container.querySelector('#mDozor').value.trim()||null,
          parcela: container.querySelector('#mParcela').value.trim()||null,
          katastr: container.querySelector('#mKatastr').value.trim()||null,
          povoleni: container.querySelector('#mPovoleni').value.trim()||null,
        });
        if(presetStage){ drawPreview(presetStage); } else { drawStep2(); }
      });
    }

    function drawStep2(){
      const stages = msSelectedStages().filter(s=>s.key!=='naradi');
      let selectedType = 'complete';
      let selectedStageKey = stages[0] ? stages[0].key : null;
      container.innerHTML = `
        <div class="topbar">
          <div class="back-btn" id="backBtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></div>
          <h1>Rozsah</h1>
        </div>
        <div class="screen-scroll">
          <p style="font-size:15px;font-weight:800;margin:2px 0 14px">Co se má vygenerovat?</p>
          <div class="opt-card" data-opt="complete" style="border:1px solid var(--accent);padding:12px;margin-bottom:9px;cursor:pointer">
            <b style="display:block;font-size:13px">Celý deník</b><span style="font-size:11px;color:var(--muted)">Všechny etapy, které mají alespoň jeden zápis</span>
          </div>
          <div class="opt-card" data-opt="onestage" style="border:1px solid var(--line);padding:12px;margin-bottom:9px;cursor:pointer">
            <b style="display:block;font-size:13px">Jedna etapa</b><span style="font-size:11px;color:var(--muted)">Vyber konkrétní etapu níže</span>
          </div>
          <div id="stageExtra" style="display:none;margin:4px 0 12px">
            <div class="dropdown" id="stageDropdown">
              <button class="dd-btn" id="stageDdBtn"><span class="left"><i id="stageDdDot" style="background:${selectedStageKey?msStageByKey(selectedStageKey).color:'transparent'}"></i><span id="stageDdLabel">${selectedStageKey?msStageByKey(selectedStageKey).name:'Vyber etapu'}</span></span></button>
              <div class="dd-panel" id="stageDdPanel"></div>
            </div>
          </div>
        </div>
        <div style="padding:12px 16px calc(20px + env(safe-area-inset-bottom));border-top:1px solid var(--line)">
          <button class="btn-primary" id="genBtn2">Vygenerovat PDF</button>
        </div>
      `;
      container.querySelector('#backBtn').addEventListener('click', drawStep1);
      container.querySelectorAll('.opt-card').forEach(card=>{
        card.addEventListener('click', ()=>{
          container.querySelectorAll('.opt-card').forEach(c=>c.style.borderColor='var(--line)');
          card.style.borderColor = 'var(--accent)';
          selectedType = card.dataset.opt;
          container.querySelector('#stageExtra').style.display = selectedType==='onestage' ? 'block' : 'none';
        });
      });
      const stageDdBtn = container.querySelector('#stageDdBtn');
      const stageDdPanel = container.querySelector('#stageDdPanel');
      stages.forEach(s=>{
        const it = document.createElement('div');
        it.className = 'dd-item';
        it.innerHTML = `<i style="background:${s.color};display:inline-block;width:7px;height:7px;margin-right:8px"></i>${s.name}`;
        it.addEventListener('click', ()=>{ selectedStageKey=s.key; container.querySelector('#stageDdLabel').textContent=s.name; container.querySelector('#stageDdDot').style.background=s.color; stageDdPanel.classList.remove('open'); });
        stageDdPanel.appendChild(it);
      });
      stageDdBtn.addEventListener('click', ()=> stageDdPanel.classList.toggle('open'));

      container.querySelector('#genBtn2').addEventListener('click', ()=>{
        if(selectedType==='onestage' && !selectedStageKey){ alert('Vyber prosím etapu.'); return; }
        drawPreview(selectedType==='onestage' ? selectedStageKey : null);
      });
    }

    // --- nahled obsahu: seznam zapisu, co se pouziji, jde jen odebrat
    // (ne pridat), potvrzovaci tlacitko jede furt nahore, at neni potreba
    // rolovat pripadne desitky stranek nahoru/dolu, aby na nej uzivatel dosahl ---
    function drawPreview(onlyStageKey){
      let entries = msDiaryNumbered().filter(e => e.stage !== 'naradi');
      if(onlyStageKey) entries = entries.filter(e=>e.stage===onlyStageKey);
      entries.sort((a,b)=> (a.date||'').localeCompare(b.date||''));
      const excluded = new Set();
      const excludedDocs = new Set();

      container.innerHTML = `
        <div class="topbar" style="gap:8px">
          <div class="back-btn" id="backBtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></div>
          <h1 style="font-size:15px">Náhled obsahu</h1>
          <button class="btn-primary" id="confirmBtn" style="width:auto;padding:8px 14px;font-size:11px;flex:0 0 auto">Potvrdit obsah</button>
        </div>
        <div class="screen-scroll">
          <p style="font-size:11px;color:var(--muted);margin:0 0 14px;line-height:1.5">Tohle se objeví v PDF. Klepnutím na ✕ zápis (nebo jen konkrétní dokument) z generování vyloučíš – v Deníku samotném zůstane beze změny. Nic přidat nejde, jen zúžit.</p>
          <div id="previewList"></div>
        </div>
      `;
      container.querySelector('#backBtn').addEventListener('click', ()=> presetStage ? Router.go('diary') : drawStep2());
      container.querySelector('#confirmBtn').addEventListener('click', ()=>{
        drawGenerating();
        buildDiaryPdf(onlyStageKey, [...excluded], [...excludedDocs]).then(drawDone).catch(drawError);
      });

      const list = container.querySelector('#previewList');
      function renderList(){
        if(entries.length===0){ list.innerHTML = '<p class="empty-msg">Žádné zápisy k zobrazení.</p>'; return; }
        list.innerHTML = entries.map(e=>{
          const s = msStageByKey(e.stage);
          const isOut = excluded.has(e.id);
          const docs = (e.items||[]).filter(it=>it.type==='document').map(it=> msDocuments().find(d=>d.id===it.refId)).filter(Boolean);
          const photoCount = (e.photos||[]).length;
          return `<div class="prev-row" data-id="${e.id}" style="border:1px solid var(--line);padding:8px 9px;margin-bottom:6px;opacity:${isOut?0.4:1}">
            <div style="display:flex;align-items:center;gap:8px">
              <div style="flex:1;min-width:0">
                <div style="display:flex;gap:6px;align-items:center;font-size:9.5px;color:var(--muted)">
                  <span style="border:1px solid var(--line);padding:0 4px">č. ${e.number}</span>
                  <b style="color:var(--accent)">${s?s.name:'—'}</b><span>${formatDateCz(e.date)}</span>
                  ${photoCount?`<span>· ${photoCount} foto</span>`:''}
                </div>
                <p style="margin:2px 0 0;font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.text || '(bez textu)'}</p>
              </div>
              <div class="prev-x" data-id="${e.id}" style="width:26px;height:26px;flex:0 0 auto;border:1px solid var(--line);display:grid;place-items:center;cursor:pointer;color:var(--muted)">${isOut?'↺':'✕'}</div>
            </div>
            ${docs.length ? `<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:6px">${docs.map(d=>{
              const docOut = excludedDocs.has(d.id);
              return `<span class="prev-doc-x" data-doc="${d.id}" style="display:flex;align-items:center;gap:4px;border:1px solid var(--line);padding:2px 6px;font-size:9.5px;color:${docOut?'var(--muted)':'var(--accent)'};text-decoration:${docOut?'line-through':'none'};cursor:pointer">📎 ${d.name} <b style="margin-left:2px">${docOut?'↺':'✕'}</b></span>`;
            }).join('')}</div>` : ''}
          </div>`;
        }).join('');
        list.querySelectorAll('.prev-x').forEach(el=>{
          el.addEventListener('click', ()=>{
            const id = el.dataset.id;
            if(excluded.has(id)) excluded.delete(id); else excluded.add(id);
            renderList();
          });
        });
        list.querySelectorAll('.prev-doc-x').forEach(el=>{
          el.addEventListener('click', (ev)=>{
            ev.stopPropagation();
            const id = el.dataset.doc;
            if(excludedDocs.has(id)) excludedDocs.delete(id); else excludedDocs.add(id);
            renderList();
          });
        });
      }
      renderList();
      return { showNav:false };
    }

    function drawGenerating(){
      container.innerHTML = `
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:24px;text-align:center">
          <p style="font-size:12.5px;color:var(--muted)">Generuji PDF…</p>
        </div>`;
    }
    function drawError(err){
      container.innerHTML = `
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center">
          <div style="width:64px;height:64px;border:1px solid var(--accent);color:var(--accent);display:grid;place-items:center">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v5M12 16h.01"/><circle cx="12" cy="12" r="9"/></svg>
          </div>
          <h2 style="margin:0;font-size:16px">Generování se nepovedlo</h2>
          <p style="margin:0;font-size:12px;color:var(--muted);max-width:250px">${err && err.message ? err.message : 'Zkus to prosím znovu.'} Appka na generování potřebuje internet.</p>
          <button class="btn-primary" id="backBtn2" style="margin-top:6px;width:auto;padding:12px 24px">Zpět do deníku</button>
        </div>`;
      container.querySelector('#backBtn2').addEventListener('click', ()=> Router.go('diary'));
    }
    function drawDone(doc){
      const filename = 'stavebni-denik.pdf';
      container.innerHTML = `
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center">
          <div style="width:64px;height:64px;border:1px solid var(--accent);color:var(--accent);display:grid;place-items:center">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>
          </div>
          <h2 style="margin:0;font-size:16px">Deník je připravený</h2>
          <p style="margin:0;font-size:12px;color:var(--muted);max-width:250px">PDF má ${doc.internal.getNumberOfPages()} stran.</p>
          <button class="btn-ghost" id="previewBtn" style="width:auto;padding:10px 20px">Náhled</button>
          <button class="btn-primary" id="shareBtn" style="margin-top:2px;width:auto;padding:12px 24px">Uložit / sdílet PDF</button>
          <button class="btn-ghost" id="doneBtn" style="width:auto;padding:10px 20px">Zpět do deníku</button>
        </div>`;
      container.querySelector('#previewBtn').addEventListener('click', ()=>{
        // OPRAVA (1.8.2026): puvodni reseni (PDF v <iframe> uvnitr appky)
        // na iPhonu (hlavne v appce pridane na plochu) nespolehlive
        // funguje - PDF se v iframe nezobrazi (prazdna stranka) a appka
        // navic spatne pocitala s vyrezem/stavovym radkem nahore, takze
        // se "Zavřít" nedalo poradne trefit. Otevreni primo pres telefon
        // vlastni prohlizec PDF (stejnou cestou, jakou uz spolehlive
        // funguje "Uložit / sdílet") je jednodussi a funguje jistě.
        const url = MsPdf.getBlobUrl(doc);
        window.open(url, '_blank');
      });
      container.querySelector('#shareBtn').addEventListener('click', ()=> MsPdf.saveOrShare(doc, filename));
      container.querySelector('#doneBtn').addEventListener('click', ()=> Router.go('diary'));
    }

    drawStep1();
    return { showNav:false };
  }

  async function buildDiaryPdf(onlyStageKey, excludeIds, excludeDocIds){
    excludeIds = excludeIds || [];
    excludeDocIds = excludeDocIds || [];
    const meta = msDiaryMeta();
    const doc = MsPdf.newDoc();
    const cur = MsPdf.makeCursor(doc);
    const projects = msLoadProjects();
    const p = projects.find(pr=>pr.id===msGetActiveProjectId()) || projects[0] || {};

    // etapy s alespon jednim zapisem, v poradi podle data prvniho zapisu -
    // etapy bez zaznamu (a Naradi, ktere zapisy vubec nema) se nezobrazi
    const allEntries = msDiaryNumbered().filter(e => e.stage !== 'naradi' && !excludeIds.includes(e.id));
    const byStage = {};
    allEntries.forEach(e=>{ (byStage[e.stage] = byStage[e.stage]||[]).push(e); });
    let stageKeys = Object.keys(byStage);
    if(onlyStageKey) stageKeys = stageKeys.filter(k=>k===onlyStageKey);
    stageKeys.sort((a,b)=> (byStage[a][0].date||'').localeCompare(byStage[b][0].date||''));
    const chapters = stageKeys.map(key=>({ key, stage: msStageByKey(key), entries: byStage[key].sort((x,y)=>(x.date||'').localeCompare(y.date||'')) }));
    const totalEntries = chapters.reduce((a,c)=>a+c.entries.length, 0);

    MsPdf.coverPage(doc, cur, 'STAVEBNÍ DENÍK', p.name || meta.nazev || 'Rodinný dům', [
      ['Místo stavby', meta.misto],
      ['Parcelní číslo', meta.parcela],
      ['Katastrální území', meta.katastr],
      ['Stavebník', meta.stavebnik],
      ['Projektant', meta.projektant],
      ['Stavební dozor', meta.dozor],
      ['Číslo stavebního povolení', meta.povoleni],
      ['Vytvořeno dne', formatDateCz(msTodayISO())],
    ], [`Deník obsahuje ${totalEntries} zápis${totalEntries===1?'':(totalEntries<5?'y':'ů')} ze ${chapters.length} etap${chapters.length===1?'u':(chapters.length<5?'':'')}.`]);

    if(chapters.length===0){
      doc.addPage(); cur.y = MsPdf.MARGIN; MsPdf.pageBorder(doc);
      MsPdf.heading(doc, cur, 'Přehled etap');
      MsPdf.paragraph(doc, cur, 'Zatím žádné zápisy.', {color:MsPdf.MUTED});
      MsPdf.footer(doc);
      return doc;
    }

    // --- prehled etap: etapa / stranka / pocet zapisu ---
    // (stranky se pocitaji az podle skutecneho poctu stran kapitol -
    // dopredu spocitame, kolik stran kazda kapitola zabere)
    doc.addPage(); cur.y = MsPdf.MARGIN; MsPdf.pageBorder(doc);
    const overviewPageIndex = doc.internal.getNumberOfPages();
    MsPdf.heading(doc, cur, 'Přehled etap');
    MsPdf.paragraph(doc, cur, 'Etapy bez záznamu se v přehledu ani v deníku nezobrazují.', {size:9.5, color:MsPdf.MUTED});
    cur.y += 2;
    const overviewTableY = cur.y;

    // --- kapitoly po etapach, chronologicky ---
    const chapterStartPages = [];
    const appendixWithImage = []; // {name, content, stageName, date} - vytisknou se na A5 na konci
    const appendixNoImage = [];   // dokumenty bez obsahu (skutecne PDF apod.) - jen jmenovky
    for(const ch of chapters){
      const chapterDocs = [];
      doc.addPage(); cur.y = MsPdf.MARGIN; MsPdf.pageBorder(doc);
      chapterStartPages.push(doc.internal.getNumberOfPages());
      doc.setFont(MsPdf.font(), 'bold'); doc.setFontSize(17); doc.setTextColor(...MsPdf.INK);
      doc.text(ch.stage ? ch.stage.name : 'Bez etapy', MsPdf.MARGIN, cur.y); cur.y += 6;
      doc.setFont(MsPdf.font(), 'normal'); doc.setFontSize(9); doc.setTextColor(...MsPdf.MUTED);
      const first = ch.entries[0].date, last = ch.entries[ch.entries.length-1].date;
      const span = first===last ? formatDateCz(first) : `${formatDateCz(first)} – ${formatDateCz(last)}`;
      doc.text(`${span} · ${ch.entries.length} zápis${ch.entries.length===1?'':(ch.entries.length<5?'y':'ů')}`, MsPdf.MARGIN, cur.y);
      cur.y += 11;

      for(const e of ch.entries){
        cur.ensure(9);
        doc.setFont(MsPdf.font(), 'bold'); doc.setFontSize(10.5); doc.setTextColor(...MsPdf.BRICK);
        doc.text(`Zápis č. ${e.number} · ${formatDateCz(e.date)}`, MsPdf.MARGIN, cur.y); cur.y += 6.3;
        doc.setFont(MsPdf.font(), 'normal');
        if(e.worker) MsPdf.labelValueRow(doc, cur, 'Kdo pracoval', e.worker);
        if(e.material) MsPdf.labelValueRow(doc, cur, 'Materiál', e.material);
        MsPdf.paragraph(doc, cur, e.text || '', {size:9.8});
        if(e.issue){ MsPdf.paragraph(doc, cur, 'Poznámka: '+e.issue, {size:9, color:MsPdf.MUTED}); }
        if(e.photos && e.photos.length){ cur.y += 1; await MsPdf.photoRow(doc, cur, e.photos); }
        const docItems = (e.items||[]).filter(it=>it.type==='document' && !excludeDocIds.includes(it.refId)).map(it=> msDocuments().find(d=>d.id===it.refId)).filter(Boolean);
        docItems.forEach(d=>{
          MsPdf.paragraph(doc, cur, 'K deníku přiloženo: '+d.name, {size:9, color:MsPdf.MUTED});
          const stageName = ch.stage ? ch.stage.name : 'Bez etapy';
          if(d.content) appendixWithImage.push({name:d.name, content:d.content, stageName, date:e.date});
          else appendixNoImage.push({name:d.name, stageName, date:e.date});
          chapterDocs.push(d.name);
        });
        cur.y += 5;
      }

      // --- vypis, jake dokumenty se maji k teto etape prilozit (jen jmenovky) ---
      if(chapterDocs.length){
        cur.ensure(12);
        doc.setFont(MsPdf.font(), 'bold'); doc.setFontSize(9.5); doc.setTextColor(...MsPdf.INK);
        doc.text('Přílohy k této etapě', MsPdf.MARGIN, cur.y); cur.y += 5.5;
        MsPdf.paragraph(doc, cur, chapterDocs.join(', '), {size:9, color:MsPdf.MUTED});
      }
    }

    // --- doplnit tabulku prehledu (uz zname skutecne stranky kapitol) ---
    doc.setPage(overviewPageIndex);
    cur.y = overviewTableY;
    MsPdf.table(doc, cur,
      [ {label:'ETAPA', w:95}, {label:'STRÁNKA', w:35, align:'right'}, {label:'POČET ZÁPISŮ', w:40, align:'right'} ],
      chapters.map((ch,i)=>[ch.stage?ch.stage.name:'Bez etapy', String(chapterStartPages[i]), String(ch.entries.length)])
    );

    // --- prilohy: kazdy dokument s fotoobsahem na vlastni strance, ve
    // formatu A5 (dost velke na precteni), na uplnem konci deniku ---
    if(appendixWithImage.length || appendixNoImage.length){
      doc.setPage(doc.internal.getNumberOfPages());
      doc.addPage(); cur.y = MsPdf.MARGIN; MsPdf.pageBorder(doc);
      MsPdf.heading(doc, cur, 'Přílohy');
      MsPdf.paragraph(doc, cur, 'Dokumenty přiložené k jednotlivým zápisům, ve čitelné velikosti.', {size:9.5, color:MsPdf.MUTED});
      for(let i=0;i<appendixWithImage.length;i++){
        const att = appendixWithImage[i];
        if(i>0){ doc.addPage(); cur.y = MsPdf.MARGIN; MsPdf.pageBorder(doc); }
        doc.setFont(MsPdf.font(), 'bold'); doc.setFontSize(11); doc.setTextColor(...MsPdf.INK);
        doc.text(att.name, MsPdf.MARGIN, cur.y); cur.y += 5.5;
        doc.setFont(MsPdf.font(), 'normal'); doc.setFontSize(9); doc.setTextColor(...MsPdf.MUTED);
        doc.text(`${att.stageName} · ${formatDateCz(att.date)}`, MsPdf.MARGIN, cur.y); cur.y += 6;
        // A5-formatova velikost (dostatecne velka na precteni), oriznuto na sirku stranky
        const boxH = 148;
        await MsPdf.photoRow(doc, cur, [att.content], {h: boxH});
      }
      if(appendixNoImage.length){
        if(appendixWithImage.length){ doc.addPage(); cur.y = MsPdf.MARGIN; MsPdf.pageBorder(doc); }
        cur.ensure(14);
        doc.setFont(MsPdf.font(), 'bold'); doc.setFontSize(11); doc.setTextColor(...MsPdf.INK);
        doc.text('Další přílohy k doplnění zvlášť', MsPdf.MARGIN, cur.y); cur.y += 6;
        MsPdf.paragraph(doc, cur, 'Appka pro ně nemá uložený obsah (typicky PDF nahraný jako soubor) - prosím přilož je zvlášť podle názvu a strany zápisu.', {size:9, color:MsPdf.MUTED});
        cur.y += 2;
        MsPdf.table(doc, cur,
          [ {label:'NÁZEV', w:95}, {label:'ETAPA', w:50}, {label:'DATUM', w:25} ],
          appendixNoImage.map(d=>[d.name, d.stageName, formatDateCz(d.date)])
        );
      }
    }

    // --- zaver na posledni strance ---
    doc.setPage(doc.internal.getNumberOfPages());
    cur.y = MsPdf.PAGE_H - MsPdf.MARGIN - 30;
    cur.ensure(30);
    doc.setFont(MsPdf.font(), 'bold'); doc.setFontSize(12); doc.setTextColor(...MsPdf.INK);
    doc.text('Závěr', MsPdf.MARGIN, cur.y); cur.y += 8;
    MsPdf.paragraph(doc, cur, `Tento stavební deník obsahuje celkem ${totalEntries} zápisů ze ${chapters.length} etap.`);
    cur.y += 12;
    doc.setDrawColor(...MsPdf.LINE); doc.line(MsPdf.MARGIN, cur.y, MsPdf.MARGIN+70, cur.y); cur.y += 5;
    doc.setFont(MsPdf.font(), 'normal'); doc.setFontSize(9.3); doc.setTextColor(...MsPdf.MUTED);
    doc.text(meta.stavebnik || '', MsPdf.MARGIN, cur.y);

    MsPdf.footer(doc);
    return doc;
  }

  function formatDateCz(iso){
    if(!iso) return '—';
    const d = new Date(iso+'T00:00:00');
    if(isNaN(d)) return iso;
    return `${d.getDate()}. ${d.getMonth()+1}. ${d.getFullYear()}`;
  }

  return { render, buildDiaryPdf, formatDateCz };
})();
Router.register('diary-export', DiaryExportScreen);
