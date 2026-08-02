/* ==========================================================
   GALERIE
   ========================================================== */
const GalleryScreen = (function(){
  const MONTHS = ['Leden','Únor','Březen','Duben','Květen','Červen','Červenec','Srpen','Září','Říjen','Listopad','Prosinec'];

  function render(container, params){
    let activeStage = params.stage || 'all';

    container.innerHTML = `
      <div class="topbar">
        <div class="back-btn" id="backBtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></div>
        <h1>Galerie</h1>
        <div class="icon-btn" id="addBtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></div>
      </div>
      <div class="screen-scroll">
        <div class="dropdown" id="stageDropdown" style="margin-bottom:12px">
          <button class="dd-btn" id="ddBtn"><span class="left"><i id="ddDot"></i><span id="ddLabel">Etapa: Vše</span></span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 9l6 6 6-6"/></svg></button>
          <div class="dd-panel" id="ddPanel"></div>
        </div>
        <div id="months"></div>
      </div>
    `;
    container.querySelector('#backBtn').addEventListener('click', ()=> Router.back());
    const galleryAddBtn = container.querySelector('#addBtn');
    if(typeof msCanAddSection === 'function' && !msCanAddSection('fotky')){ galleryAddBtn.style.display = 'none'; }
    else galleryAddBtn.addEventListener('click', ()=> Router.go('photo-add'));

    const ddBtn = container.querySelector('#ddBtn');
    const ddPanel = container.querySelector('#ddPanel');
    function buildDropdown(){
      const allPhotos = msPhotos();
      ddPanel.innerHTML = '';
      const allItem = document.createElement('div');
      allItem.className = 'dd-item' + (activeStage==='all'?' is-active':'');
      allItem.innerHTML = `<i style="background:#fff;display:inline-block;width:8px;height:8px;margin-right:7px"></i>Vše · ${allPhotos.length} fotek`;
      allItem.addEventListener('click', ()=>{ activeStage='all'; ddLabelUpdate(); ddPanel.classList.remove('open'); draw(); });
      ddPanel.appendChild(allItem);
      msSelectedStages().forEach(s=>{
        const count = allPhotos.filter(p=>p.stage===s.key).length;
        const it = document.createElement('div');
        it.className = 'dd-item' + (activeStage===s.key?' is-active':'');
        it.style.color = s.color;
        it.innerHTML = `<i style="background:${s.color};display:inline-block;width:8px;height:8px;margin-right:7px"></i>${s.name} · ${count} fotek`;
        it.addEventListener('click', ()=>{ activeStage=s.key; ddLabelUpdate(); ddPanel.classList.remove('open'); draw(); });
        ddPanel.appendChild(it);
      });
    }
    function ddLabelUpdate(){
      const s = msStageByKey(activeStage);
      container.querySelector('#ddLabel').textContent = 'Etapa: ' + (s?s.name:'Vše');
    }
    ddBtn.addEventListener('click', ()=> ddPanel.classList.toggle('open'));

    function draw(){
      buildDropdown(); ddLabelUpdate();
      const wrap = container.querySelector('#months');
      const allPhotos = msPhotos();

      // konkretni etapa vybrana (z dropdownu, nebo prichozi z Detailu etapy) -
      // plocha chronologicka mrizka jedne etapy, beze zmeny oproti drivejsku
      if(activeStage !== 'all'){
        const photos = allPhotos.filter(p=>p.stage===activeStage).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
        if(photos.length===0){ wrap.innerHTML = '<p class="empty-msg">Zatím žádné fotky. Přidej první přes +.</p>'; return; }
        wrap.innerHTML = `<div class="month-grid" data-month="single" style="display:grid;grid-template-columns:repeat(3,1fr);gap:2px"></div>`;
        const grid = wrap.querySelector('.month-grid');
        photos.forEach((p,i)=> grid.appendChild(photoCell(p, photos, i)));
        return;
      }

      // vychozi pohled "Vse": rozdeleno do chlivku po etapach - jen ty, co
      // uz maji aspon 1 fotku, aktualni etapa vzdy prvni, zbytek podle
      // data posledni fotky (nejcerstvejsi nahoru), uvnitr chronologicky
      if(allPhotos.length===0){ wrap.innerHTML = '<p class="empty-msg">Zatím žádné fotky. Přidej první přes +.</p>'; return; }
      const curStage = msGetCurrentStage();
      const byStage = {};
      allPhotos.forEach(p=>{ (byStage[p.stage] = byStage[p.stage]||[]).push(p); });
      let stageKeys = Object.keys(byStage);
      stageKeys.sort((a,b)=>{
        if(a===curStage) return -1;
        if(b===curStage) return 1;
        const lastA = byStage[a].map(p=>p.date||'').sort().pop() || '';
        const lastB = byStage[b].map(p=>p.date||'').sort().pop() || '';
        return lastB.localeCompare(lastA);
      });

      wrap.innerHTML = stageKeys.map(key=>{
        const s = msStageByKey(key);
        return `<div style="margin-bottom:16px">
          <p style="font-size:11px;font-weight:800;color:${s?s.color:'var(--muted)'};text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px">${s?s.name:'Bez etapy'}${key===curStage?' · aktuální':''} · ${byStage[key].length} fotek</p>
          <div class="month-grid" data-month="${key}" style="display:grid;grid-template-columns:repeat(3,1fr);gap:2px"></div>
        </div>`;
      }).join('');

      stageKeys.forEach(key=>{
        byStage[key].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
      });
      const flatList = stageKeys.flatMap(key=>byStage[key]);

      stageKeys.forEach(key=>{
        const grid = wrap.querySelector(`.month-grid[data-month="${key}"]`);
        byStage[key].forEach(p=>{
          const flatIdx = flatList.indexOf(p);
          grid.appendChild(photoCell(p, flatList, flatIdx));
        });
      });
    }

    function photoCell(p, list, idx){
      const s = msStageByKey(p.stage);
      const bg = p.thumb ? `background-image:url(${p.thumb});background-size:cover;background-position:center` : `background:color-mix(in srgb, ${s?s.color:'#94a0bc'} 15%, #0b0f1c)`;
      const cell = document.createElement('div');
      cell.className = 'gallery-photo';
      cell.style.cssText = `position:relative;aspect-ratio:1;cursor:pointer;overflow:hidden;${bg}`;
      let badgesHtml = `<i style="position:absolute;left:5px;bottom:5px;width:7px;height:7px;border-radius:50%;background:${s?s.color:'var(--muted)'};box-shadow:0 0 0 1.5px rgba(0,0,0,.35)"></i>`;
      cell.innerHTML = badgesHtml;
      cell.addEventListener('click', ()=> openPhoto(list, idx));
      return cell;
    }

    // Prohlizec fotek - swipe doleva/doprava mezi fotkami (jako v systemove
    // Galerii), pinch-zoom a double-tap zoom na jedne fotce. Cistý JS bez
    // knihovny: pri zoomu (scale>1) swipe funguje jako posun (pan), ne
    // prechod na dalsi fotku - pri scale===1 je horizontalni tazeni prechod.
    function openPhoto(list, startIdx){
      let idx = startIdx;
      const overlay = document.createElement('div');
      overlay.className = 'ms-overlay'; overlay.style.cssText = 'position:fixed;inset:0;background:var(--bg-deep);z-index:70;display:flex;flex-direction:column';
      document.body.appendChild(overlay);

      let scale=1, panX=0, panY=0;
      let startDist=0, startScale=1, startPanX=0, startPanY=0, startTouchX=0, startTouchY=0;
      let swiping=false, swipeStartX=0, dragDX=0;

      function drawFrame(){
        const p = list[idx];
        const s = msStageByKey(p.stage);
        overlay.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:calc(14px + env(safe-area-inset-top)) 16px 8px">
            <span style="font-size:11px;color:var(--muted)">${idx+1} / ${list.length}</span>
            <div id="closePhoto" style="width:32px;height:32px;border:1px solid var(--line);border-radius:3px;display:grid;place-items:center;color:var(--text-main);cursor:pointer">✕</div>
          </div>
          <div id="photoViewport" style="flex:1;overflow:hidden;position:relative;touch-action:none">
            <img id="photoImg" src="${p.thumb||''}" style="position:absolute;top:50%;left:50%;max-width:100%;max-height:100%;width:auto;height:auto;transform:translate(-50%,-50%) scale(1);transform-origin:center;user-select:none;-webkit-user-drag:none"/>
          </div>
          <div style="padding:14px 16px calc(20px + env(safe-area-inset-bottom))">
            ${s ? `<p style="margin:0 0 4px;font-size:11px;color:${s.color};font-weight:800">${s.name}</p>` : ''}
            <p style="margin:0 0 8px;font-size:11px;color:var(--muted)">${p.date || ''}</p>
            <textarea id="capField" class="f-textarea" placeholder="Přidat popisek…" style="min-height:50px">${p.caption||''}</textarea>
            <div style="display:flex;gap:8px;margin-top:8px">
              <button id="saveCapBtn" class="btn-primary" style="border-color:${s?s.color:'#b34cff'}">Uložit popisek</button>
              <button id="delPhotoBtn" class="btn-ghost" style="color:#ff7a86;flex:0 0 auto;width:auto;padding:11px 16px">Smazat</button>
            </div>
          </div>
        `;
        scale=1; panX=0; panY=0;
        overlay.querySelector('#closePhoto').addEventListener('click', ()=> document.body.removeChild(overlay));
        overlay.querySelector('#saveCapBtn').addEventListener('click', ()=>{
          const caption = overlay.querySelector('#capField').value.trim();
          msUpdatePhoto(p.id, { caption });
          document.body.removeChild(overlay);
          draw();
        });
        overlay.querySelector('#delPhotoBtn').addEventListener('click', async ()=>{
          if(!await Layout.confirmDialog('Smazat tuhle fotku? Nedá se to vrátit zpět.', 'Smazat')) return;
          msDeletePhoto(p.id);
          document.body.removeChild(overlay);
          draw();
        });
        wireGestures();
      }

      function applyTransform(){
        const img = overlay.querySelector('#photoImg');
        if(img) img.style.transform = `translate(calc(-50% + ${panX}px), calc(-50% + ${panY}px)) scale(${scale})`;
      }

      function dist(t0,t1){ return Math.hypot(t1.clientX-t0.clientX, t1.clientY-t0.clientY); }

      function wireGestures(){
        const vp = overlay.querySelector('#photoViewport');
        vp.addEventListener('touchstart', (e)=>{
          if(e.touches.length===2){
            startDist = dist(e.touches[0], e.touches[1]);
            startScale = scale;
          } else if(e.touches.length===1){
            startTouchX = e.touches[0].clientX; startTouchY = e.touches[0].clientY;
            startPanX = panX; startPanY = panY;
            swipeStartX = e.touches[0].clientX; dragDX = 0;
            swiping = scale<=1.02;
          }
        }, {passive:true});
        vp.addEventListener('touchmove', (e)=>{
          if(e.touches.length===2){
            const d = dist(e.touches[0], e.touches[1]);
            scale = Math.min(4, Math.max(1, startScale * (d/startDist)));
            applyTransform();
          } else if(e.touches.length===1){
            const dx = e.touches[0].clientX - startTouchX;
            const dy = e.touches[0].clientY - startTouchY;
            if(scale>1.02){
              panX = startPanX + dx; panY = startPanY + dy;
              applyTransform();
            } else if(swiping){
              dragDX = e.touches[0].clientX - swipeStartX;
              overlay.querySelector('#photoViewport').style.transform = `translateX(${dragDX}px)`;
              overlay.querySelector('#photoViewport').style.opacity = String(1 - Math.min(0.5, Math.abs(dragDX)/600));
            }
          }
        }, {passive:true});
        vp.addEventListener('touchend', ()=>{
          if(swiping && scale<=1.02){
            const vpEl = overlay.querySelector('#photoViewport');
            vpEl.style.transition = 'transform .18s ease, opacity .18s ease';
            if(dragDX < -60 && idx < list.length-1){ idx++; drawFrame(); }
            else if(dragDX > 60 && idx > 0){ idx--; drawFrame(); }
            else { vpEl.style.transform = 'translateX(0)'; vpEl.style.opacity = '1'; setTimeout(()=>{ if(vpEl) vpEl.style.transition=''; }, 200); }
          }
          if(scale < 1){ scale = 1; applyTransform(); }
        }, {passive:true});
        // double-tap = rychly zoom in/out
        let lastTap = 0;
        vp.addEventListener('touchend', ()=>{
          const now = Date.now();
          if(now - lastTap < 280){
            scale = scale>1 ? 1 : 2.5;
            panX=0; panY=0;
            applyTransform();
          }
          lastTap = now;
        }, {passive:true});
      }

      drawFrame();
    }

    draw();
    return { activeTab:'dashboard' };
  }
  return { render };
})();
Router.register('gallery', GalleryScreen);
