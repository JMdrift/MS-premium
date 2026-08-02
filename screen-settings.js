/* ==========================================================
   NASTAVENI
   ========================================================== */
const SettingsScreen = (function(){
  function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function render(container){
    container.innerHTML = `
      <div class="topbar">
        <div class="back-btn" id="backBtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></div>
        <h1>Nastavení</h1>
      </div>
      <div class="screen-scroll">
        <!-- Premium/sdileni: bod 2 (prihlaseni) a bod 1 (sdileni) uz jsou
             rozestavene jako UI mock, viz Premium-sdileni-specifikace.md,
             sekce 9 a 10 (log stavby). -->
        <p class="section-label" style="margin-top:4px">Premium</p>
        <div style="border:1.5px solid var(--accent);padding:16px;margin-bottom:14px" id="premiumCard"></div>

        <p class="section-label" style="margin-top:4px">Projekty</p>
        <div id="projectsCard" style="border:1px solid var(--line)"></div>

        <p class="section-label">Předvolby</p>
        <div style="border:1px solid var(--line);margin-bottom:14px">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px">
            <div><b style="display:block;font-size:12.5px">Oznámení</b><span id="notifStatus" style="font-size:10.5px;color:var(--muted)">Posílat události přímo jako notifikaci</span></div>
            <div id="notifSwitch" style="width:38px;height:22px;border-radius:11px;border:1px solid var(--line);position:relative;cursor:pointer"><i style="position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:var(--muted)"></i></div>
          </div>
          <div id="rowAppLock" style="display:flex;align-items:center;justify-content:space-between;padding:12px;border-top:1px solid var(--line);cursor:pointer">
            <div><b style="display:block;font-size:12.5px">Zámek appky</b><span style="font-size:10.5px;color:var(--muted)">${msGetAppLock()==='faceid' ? 'Face ID' : 'Bez zámku'}</span></div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2.5" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>
          </div>
        </div>

        <p class="section-label">Generátory a export</p>
        <div style="border:1px solid var(--line)">
          <div class="row-item" id="rowDiaryGen" style="padding:12px;cursor:pointer"><b style="font-size:12.5px">Vygenerovat stavební deník</b><span style="display:block;font-size:10.5px;color:var(--muted)">Chronologický PDF deník podle etap, s fotkami</span></div>
        </div>

        <p class="section-label">Úložiště</p>
        <div style="border:1px solid var(--line)">
          <div style="padding:12px;border-bottom:1px solid var(--line)">
            <div id="storageBar" style="height:6px;background:var(--card-bg-2);border:1px solid var(--line);margin-bottom:8px;overflow:hidden"><div id="storageBarFill" style="height:100%;background:var(--accent);width:0%"></div></div>
            <span id="storageText" style="font-size:11px;color:var(--muted)">Počítám…</span>
          </div>
          <div class="row-item" id="rowCompress" style="padding:12px;cursor:pointer"><b style="font-size:12.5px">Zmenšit uložené fotky a dokumenty</b><span style="display:block;font-size:10.5px;color:var(--muted)">Uvolní místo bez ztráty obsahu - hodí se, když appka hlásí plné úložiště</span></div>
        </div>

        <p class="section-label">Zálohování dat</p>
        <div style="border:1px solid var(--line)">
          <div class="row-item" id="rowExport" style="padding:12px;cursor:pointer;border-bottom:1px solid var(--line)"><b style="font-size:12.5px">Exportovat zálohu</b><span style="display:block;font-size:10.5px;color:var(--muted)">Stáhne všechna data appky jako soubor</span></div>
          <div class="row-item" id="rowImport" style="padding:12px;cursor:pointer"><b style="font-size:12.5px">Obnovit ze zálohy</b><span style="display:block;font-size:10.5px;color:var(--muted)">Nahraje dříve stažený soubor</span></div>
          <input type="file" id="importFile" accept="application/json" style="display:none"/>
        </div>

        <p class="section-label">Podpora</p>
        <div style="border:1px solid var(--line)">
          <div class="row-item" id="rowSupport" style="padding:12px;border-bottom:1px solid var(--line);cursor:pointer"><b style="font-size:12.5px">Nápověda a podpora</b><span style="display:block;font-size:10.5px;color:var(--muted)">moje-stavba-app@seznam.cz</span></div>
          <div class="row-item" id="rowDeleteAll" style="padding:12px;cursor:pointer;color:#ff7a86"><b style="font-size:12.5px">Smazat všechna data appky</b><span style="display:block;font-size:10.5px;color:var(--muted)">Nevratné</span></div>
        </div>

        <p class="section-label">O aplikaci</p>
        <div style="border:1px solid var(--line);padding:16px;text-align:center;margin-bottom:14px">
          <b style="display:block;font-size:14px">Moje Stavba</b>
          <span style="font-size:11px;color:var(--muted);display:block;margin:8px 0 4px;line-height:1.5">Mějte svou stavbu pod kontrolou — etapy, deník, výdaje, fotky a kalendář na jednom místě, bez složitých tabulek. Všechna data zůstávají jen v tomto telefonu.</span>
          <span style="font-size:11px;color:var(--muted)">Verze 1.0 (nová architektura)</span>
        </div>
        <div style="border:1px solid var(--line)">
          <div class="row-item" id="rowPrivacy" style="padding:12px;border-bottom:1px solid var(--line);cursor:pointer"><b style="font-size:12.5px">Zásady ochrany osobních údajů</b></div>
          <div class="row-item" id="rowTerms" style="padding:12px;cursor:pointer"><b style="font-size:12.5px">Podmínky používání</b></div>
        </div>
      </div>
    `;
    container.querySelector('#backBtn').addEventListener('click', ()=> Router.back());
    function renderPremiumCard(){
      const card = container.querySelector('#premiumCard');
      const projects = msLoadProjects();
      const activeP = projects.find(x=> x.id === msGetActiveProjectId());
      const projName = activeP ? activeP.name : 'tahle stavba';

      // Sdileny projekt (jsem jen pozvany, ne vlastnik) - Premium/sdileni
      // spravuje vylucne vlastnik na SVEM zarizeni. Kdyby appka tady
      // nabidla "Aktivovat Premium", zalozila by pro tenhle projekt
      // úplně jiny, matouci cloudovy zaznam - viz Krok 11.
      if(activeP && activeP.isShared){
        card.innerHTML = `
          <b style="display:block;font-size:15px;font-family:var(--font-head)">Sdílená stavba</b>
          <span style="font-size:11.5px;color:var(--muted);display:block;margin:4px 0 0;line-height:1.5">Přístup k <b style="color:var(--text-main)">${escapeHtml(projName)}</b> ti dal vlastník stavby. Premium a sdílení spravuje on, ne ty.</span>
        `;
        return;
      }

      if(msIsPremiumMock()){
        const planType = msGetPremiumPlanType();
        const isLifetime = planType === 'lifetime';
        const planLabel = isLifetime ? 'Natrvalo' : (planType === 'yearly' ? 'Ročně' : 'Měsíčně');
        card.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <b style="font-size:15px;font-family:var(--font-head)">Premium</b>
            <span style="font-size:8.5px;font-weight:800;border:1px solid var(--money-pos);color:var(--money-pos);padding:2px 6px;text-transform:uppercase">Aktivní</span>
          </div>
          <span style="font-size:11.5px;color:var(--muted);display:block;margin:4px 0 4px;line-height:1.5">Platí pro <b style="color:var(--text-main)">${projName}</b> — plán: ${planLabel}.</span>
          <span style="font-size:11.5px;color:var(--muted);display:block;margin:0 0 12px;line-height:1.5">Projekt je připravený ke sdílení s rodinou, projektantem nebo stavebním dozorem.</span>
          <button class="btn-primary" id="btnGoShare">Sdílet stavbu</button>
        `;
        container.querySelector('#btnGoShare').addEventListener('click', ()=> Router.go('sdilet-stavbu'));
        // Zadne viditelne tlacitko "Zalohovat ted" - appka se tvari, ze
        // uklada automaticky, tak to ma delat i doopravdy. Snimek se tise
        // obnovi na pozadi pri kazdem otevreni Nastaveni (a pri kazdem
        // prejmenovani projektu, viz edit-btn nize) - uzivatel si toho
        // nemusi vsimnout, ale zustava to aktualni.
        if(typeof MSCloud !== 'undefined'){
          MSCloud.uploadSnapshot().catch(e=> console.error('tichy uploadSnapshot selhal', e));
          // Zpetne odeslani VSECH existujicich souboru (ne jen nove
          // pridanych) - resi i situaci "predplatne vyprselo, chvili jsem
          // pridaval fotky ve FREE rezimu, pak jsem zaplatil znovu" - v tom
          // pripade se ma backfill spustit ZNOVU, ne jen pri uplne prvni
          // aktivaci. Priznak proto sleduje AKTUALNI nepretrzity "aktivni
          // useik", ne "uz se to nekdy stalo" - kdyz appka zjisti, ze
          // Premium prave PRESLO z neaktivniho na aktivni, spusti to znovu.
          const wasActiveKey = 'ms_premium_was_active_v1__' + msGetActiveProjectId();
          if(localStorage.getItem(wasActiveKey) !== '1'){
            MSCloud.backfillAllFiles().then(({error})=>{
              if(!error) localStorage.setItem(wasActiveKey, '1');
              else console.error('backfillAllFiles selhalo, zkusi se priste znovu', error);
            }).catch(e=> console.error('backfillAllFiles selhalo', e));
          }
        }
      } else {
        card.innerHTML = `
          <b style="display:block;font-size:15px;font-family:var(--font-head)">Premium</b>
          <span style="font-size:11.5px;color:var(--muted);display:block;margin:4px 0 10px;line-height:1.5">Aktivuje se pro <b style="color:var(--text-main)">${projName}</b> — cloudová záloha a sdílení jen pro tuhle stavbu.</span>
          <span style="display:block;font-size:13px;font-weight:800;color:var(--accent);margin-bottom:12px">od 69 Kč / měsíc</span>
          <button class="btn-primary" id="btnActivatePremium">Aktivovat Premium</button>
        `;
        container.querySelector('#btnActivatePremium').addEventListener('click', ()=> PremiumLogin.open(()=>{ renderPremiumCard(); renderProjects(); }));
      }
    }
    renderPremiumCard();
    container.querySelector('#rowSupport').addEventListener('click', ()=>{
      window.location.href = 'mailto:moje-stavba-app@seznam.cz?subject=' + encodeURIComponent('Moje Stavba - dotaz/podpora');
    });
    container.querySelector('#rowPrivacy').addEventListener('click', ()=> Router.go('privacy-policy'));
    container.querySelector('#rowTerms').addEventListener('click', ()=> Router.go('terms'));
    container.querySelector('#rowDiaryGen').addEventListener('click', ()=> Router.go('diary-export', {}));

    function renderProjects(){
      const wrap = container.querySelector('#projectsCard');
      const projects = msLoadProjects();
      const activeId = msGetActiveProjectId();
      wrap.innerHTML = projects.map(p=>`
        <div class="proj-row" data-id="${p.id}" style="display:flex;align-items:center;gap:10px;padding:11px 12px;border-bottom:1px solid var(--line);cursor:pointer">
          <div style="width:8px;height:8px;border-radius:50%;background:${p.currentStage?p.currentStage.color:'#94a0bc'}"></div>
          <div style="flex:1;min-width:0"><b style="display:block;font-size:13px">${p.name}</b><span style="font-size:10.5px;color:var(--muted)">${p.type?p.type+' · ':''}${p.location||''}</span></div>
          ${p.isShared ? '<span style="font-size:8px;font-weight:800;color:#25b7ff;border:1px solid #25b7ff;padding:2px 5px;text-transform:uppercase">Sdíleno</span>' : (msIsPremiumMockForProject(p.id) ? '<span style="font-size:8px;font-weight:800;color:var(--money-pos);border:1px solid var(--money-pos);padding:2px 5px;text-transform:uppercase">Premium</span>' : '<span style="font-size:8px;font-weight:800;color:var(--muted);border:1px solid var(--line);padding:2px 5px;text-transform:uppercase">Free</span>')}
          ${p.id===activeId?'<span style="font-size:8.5px;font-weight:800;color:var(--accent);border:1px solid var(--accent);padding:2px 5px">Aktivní</span>':''}
          ${p.isShared ? `<span class="leave-btn" data-id="${p.id}" style="font-size:11px;color:#ff7a86;font-weight:700">Opustit</span>` : `<span class="edit-btn" data-id="${p.id}" style="font-size:11px;color:#25b7ff;font-weight:700">Upravit</span><span class="remove-btn" data-id="${p.id}" style="font-size:11px;color:#ff7a86;font-weight:700;margin-left:10px">Odebrat</span>`}
        </div>
      `).join('') + `<div id="addProjectRow" style="display:flex;align-items:center;gap:8px;padding:12px;color:#b34cff;font-size:12.5px;font-weight:800;cursor:pointer">+ Přidat projekt</div>`;

      wrap.querySelectorAll('.proj-row').forEach(row=>{
        row.addEventListener('click', (e)=>{
          if(e.target.closest('.edit-btn') || e.target.closest('.leave-btn') || e.target.closest('.remove-btn')) return;
          msSetActiveProjectId(row.dataset.id);
          renderProjects();
        });
      });
      // Zadne viditelne tlacitko "Aktualizovat" - sdilene projekty se
      // sami obcas potichu obnovi na pozadi (viz MSCloud.autoRefreshAllShared
      // v supabase-data.js, spousti se z main.js).
      wrap.querySelectorAll('.leave-btn').forEach(btn=>{
        btn.addEventListener('click', async (e)=>{
          e.stopPropagation();
          const p = projects.find(x=>x.id===btn.dataset.id);
          if(!await Layout.confirmDialog('Opravdu chceš opustit sdílenou stavbu "' + p.name + '"? Appka si o ní přestane pamatovat cokoli - budeš ji muset znovu přijmout pozvánkou, kdybys chtěl zpátky.', 'Opustit')) return;
          await msDeleteProject(p.id);
          renderProjects();
        });
      });
      // OPRAVA (2.8.2026): odebrani VLASTNIHO projektu - dvoufazove
      // potvrzeni, protoze na rozdil od "Opustit" (sdileny projekt, data
      // zustavaji v cloudu u vlastnika) tady jde o TRVALE a NEVRATNE
      // smazani vsech dat projektu z tohohle zarizeni. Faze 1: vysvetleni
      // + potvrzovaci dialog. Faze 2: napsat presne slovo "odebrat", aby
      // se predeslo omylnemu kliknuti.
      wrap.querySelectorAll('.remove-btn').forEach(btn=>{
        btn.addEventListener('click', async (e)=>{
          e.stopPropagation();
          const p = projects.find(x=>x.id===btn.dataset.id);
          const ok1 = await Layout.confirmDialog(
            'Opravdu odebrat stavbu "' + p.name + '"? Appka trvale smaže tenhle projekt a všechna jeho data z tohoto zařízení - deník, fotky, výdaje, dokumenty i kalendář. Tenhle krok nejde vrátit zpět.',
            'Ano, chci odebrat', 'Zrušit'
          );
          if(!ok1) return;
          const typed = prompt('Pro potvrzení napiš slovo "odebrat":');
          if(typed === null) return;
          if(typed.trim().toLowerCase() !== 'odebrat'){
            alert('Slovo nesouhlasí, projekt nebyl odebrán.');
            return;
          }
          await msDeleteProject(p.id);
          renderProjects();
        });
      });
      wrap.querySelectorAll('.edit-btn').forEach(btn=>{
        btn.addEventListener('click', (e)=>{
          e.stopPropagation();
          const p = projects.find(x=>x.id===btn.dataset.id);
          const name = prompt('Název projektu:', p.name);
          if(name===null) return;
          const loc = prompt('Místo stavby:', p.location||'');
          if(loc===null) return;
          msUpdateProject(p.id, {name:name.trim()||p.name, location:loc.trim()});
          renderProjects();
          // Tichy refresh snimku - jen kdyz jde o AKTIVNI, VLASTNENY
          // (ne sdileny) projekt s Premium, jinak by uploadSnapshot()
          // omylem poslal data pod spatny cloudovy projekt (pracuje vzdy
          // s prave aktivnim projektem, ne s tim, co se prave edituje).
          if(!p.isShared && p.id === msGetActiveProjectId() && msIsPremiumMockForProject(p.id) && typeof MSCloud !== 'undefined'){
            MSCloud.uploadSnapshot().catch(err=> console.error('tichy uploadSnapshot po prejmenovani selhal', err));
          }
        });
      });
      wrap.querySelector('#addProjectRow').addEventListener('click', ()=> Router.go('onboarding-project'));
    }
    renderProjects();

    // notifikace
    const notifSwitch = container.querySelector('#notifSwitch');
    container.querySelector('#rowAppLock').addEventListener('click', ()=> Router.go('app-lock-setup'));
    const notifStatus = container.querySelector('#notifStatus');
    const NOTIF_KEY = 'ms_notifications_enabled_v1';
    function refreshNotif(){
      const enabled = localStorage.getItem(NOTIF_KEY)==='1' && (typeof Notification!=='undefined' && Notification.permission==='granted');
      notifSwitch.style.borderColor = enabled ? 'var(--accent)' : 'var(--line)';
      notifSwitch.querySelector('i').style.left = enabled ? '18px' : '2px';
      notifSwitch.querySelector('i').style.background = enabled ? 'var(--accent)' : 'var(--muted)';
      if(typeof Notification==='undefined') notifStatus.textContent = 'Tento prohlížeč oznámení nepodporuje';
      else if(Notification.permission==='denied') notifStatus.textContent = 'Zablokováno v nastavení prohlížeče';
      else if(enabled) notifStatus.textContent = 'Zapnuto';
      else notifStatus.textContent = 'Posílat události přímo jako notifikaci';
    }
    notifSwitch.addEventListener('click', async ()=>{
      if(typeof Notification==='undefined'){ alert('Prohlížeč oznámení nepodporuje.'); return; }
      if(localStorage.getItem(NOTIF_KEY)==='1'){ localStorage.setItem(NOTIF_KEY,'0'); refreshNotif(); return; }
      const perm = await Notification.requestPermission();
      if(perm==='granted'){ localStorage.setItem(NOTIF_KEY,'1'); new Notification('Moje Stavba', {body:'Oznámení jsou zapnutá.'}); }
      refreshNotif();
    });
    refreshNotif();

    // zaloha
    // uloziste - realny odhad primo z prohlizece (pokryva IndexedDB, kde
    // ted zijou fotky/dokumenty - ma mnohem vetsi strop nez drivejsi
    // localStorage, typicky stovky MB az GB podle mista v telefonu)
    async function refreshStorageBar(){
      container.querySelector('#storageText').textContent = 'Počítám…';
      let est = null;
      if(navigator.storage && navigator.storage.estimate){
        try{ est = await navigator.storage.estimate(); }catch(e){}
      }
      if(est && est.quota){
        const usedMb = (est.usage/1024/1024).toFixed(1);
        const quotaMb = (est.quota/1024/1024/1024).toFixed(1);
        const pct = Math.min(100, Math.round(est.usage/est.quota*100));
        container.querySelector('#storageBarFill').style.width = pct+'%';
        container.querySelector('#storageBarFill').style.background = pct>85 ? '#ff6a6a' : 'var(--accent)';
        container.querySelector('#storageText').textContent = `Využito ${usedMb} MB z ~${quotaMb} GB dostupných na telefonu`;
      } else {
        const used = msStorageUsageBytes();
        container.querySelector('#storageBarFill').style.width = '0%';
        container.querySelector('#storageText').textContent = `Drobná data appky: ${(used/1024).toFixed(0)} kB (fotky/dokumenty se počítají zvlášť, telefon jejich přesnou velikost nesděluje)`;
      }
    }
    refreshStorageBar();
    container.querySelector('#rowCompress').addEventListener('click', async ()=>{
      const row = container.querySelector('#rowCompress');
      const originalHtml = row.innerHTML;
      row.innerHTML = '<b style="font-size:12.5px">Zmenšuji…</b>';
      const saved = await msCompressExistingMedia((cat, i, n)=>{
        row.innerHTML = `<b style="font-size:12.5px">Zmenšuji ${cat} (${i}/${n})…</b>`;
      });
      row.innerHTML = originalHtml;
      refreshStorageBar();
      alert(saved>0 ? `Hotovo, uvolnilo se přibližně ${(saved/1024).toFixed(0)} kB.` : 'Všechno už bylo v optimální velikosti, nebylo co zmenšit.');
    });

    container.querySelector('#rowExport').addEventListener('click', ()=>{
      const data = {};
      for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&k.startsWith('ms_')) data[k]=localStorage.getItem(k); }
      const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href=url; a.download='moje-stavba-zaloha-'+new Date().toISOString().slice(0,10)+'.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    });
    container.querySelector('#rowImport').addEventListener('click', ()=> container.querySelector('#importFile').click());
    container.querySelector('#importFile').addEventListener('change', (e)=>{
      const file = e.target.files[0]; if(!file) return;
      const reader = new FileReader();
      reader.onload = async ()=>{
        let data;
        try{ data = JSON.parse(reader.result); }
        catch(err){ alert('Tenhle soubor se nepodařilo přečíst jako zálohu.'); return; }

        // Typy dat, ktere appka drzi jako pole zaznamu s "id". Ze starsich
        // zaloh (pred rozdelenim dat na projekty) muze byt v souboru jak
        // spravny "projektovy" klic (s __<projectId> na konci), tak stary
        // OSIRELY klic bez teto pripony - ten pri obnove SLOUCIME do
        // aktualniho, misto abychom ho prepsali nebo zahodili, at se nic
        // neztrati. Porovnava se PODLE OBSAHU (ne jen podle "id") - stara
        // osirela data casto obsahuji tytez zaznamy znovu ulozene pod jinym
        // nahodnym id, takze porovnani jen podle id by je zdvojilo. U
        // fotek/dokumentu navic presuneme obrazek/prilohu do IndexedDB
        // (rovnou v localStorage by se to uz nemuselo vejit).
        const LIST_TYPES = { 'ms_photos_v1':'thumb', 'ms_documents_v1':'content', 'ms_expenses_v1':null, 'ms_diary_v1':null, 'ms_events_v1':null, 'ms_tasks_v1':null };
        const CONTENT_KEY = {
          'ms_photos_v1': x => [x.stage||'', x.date||'', (x.caption||'')].join('|'),
          'ms_documents_v1': x => [x.stage||'', (x.name||'')].join('|'),
          'ms_expenses_v1': x => [(x.title||x.name||'').trim().toLowerCase(), Number(x.amount||0), x.date||'', x.type||''].join('|'),
          'ms_diary_v1': x => [(x.title||'').trim().toLowerCase(), (x.text||x.content||'').trim().toLowerCase(), x.date||''].join('|'),
          'ms_events_v1': x => [(x.title||'').trim().toLowerCase(), x.date||'', x.time||''].join('|'),
          'ms_tasks_v1': x => [(x.title||'').trim().toLowerCase(), x.date||'', x.dateMode||''].join('|'),
        };
        const failedKeys = [];

        // 1) nejdriv vsechny "obycejne" klice (vcetne ms_active_project_v1
        // a ms_projects_v1) - na tech dalsi krok stavi
        Object.keys(data).forEach(k=>{
          if(!k.startsWith('ms_')) return;
          if(Object.keys(LIST_TYPES).some(base => k===base || k.startsWith(base+'__'))) return; // reseno v kroku 2
          try{ localStorage.setItem(k, data[k]); }catch(err){ failedKeys.push(k); }
        });

        // 2) seznamova data - slouceni osireleho a aktualniho podle OBSAHU
        const activeId = localStorage.getItem('ms_active_project_v1');
        const scopedSuffix = activeId ? '__'+activeId : '';
        for(const [base, blobField] of Object.entries(LIST_TYPES)){
          const scopedKey = base + scopedSuffix;
          let scopedList = [], orphanList = [];
          try{ scopedList = data[scopedKey] ? JSON.parse(data[scopedKey]) : []; }catch(e){}
          try{ orphanList = data[base] ? JSON.parse(data[base]) : []; }catch(e){}
          if(scopedList.length===0 && orphanList.length===0) continue;
          const keyFn = CONTENT_KEY[base];
          const seenKeys = new Set(scopedList.map(keyFn));
          const merged = scopedList.concat(orphanList.filter(x=>!seenKeys.has(keyFn(x))));
          for(const item of merged){
            if(blobField && item[blobField]){
              const blobKey = msBlobKey(base==='ms_photos_v1' ? 'photo' : 'doc', item.id);
              try{
                await msIdbSet(blobKey, item[blobField]);
                MS_BLOB_CACHE.set(blobKey, item[blobField]);
                delete item[blobField]; // ulozeno rychle (IndexedDB) - v localStorage uz obrazek nemusi byt
              }catch(err){
                // ulozeni do IndexedDB se nepovedlo - radeji obrazek NEZAHODIT
                // a nechat ho rovnou v zaznamu (stary/pomalejsi zpusob), nez
                // aby fotka zmizela docela
              }
            }
          }
          try{ localStorage.setItem(scopedKey, JSON.stringify(merged)); }catch(err){ failedKeys.push(scopedKey); }
        }

        if(failedKeys.length){
          alert('Záloha obnovena, ale tohle se nepovedlo uložit (zkus to případně zvlášť): ' + failedKeys.join(', '));
        } else {
          alert('Záloha byla obnovena.');
        }
        Router.go('dashboard');
      };
      reader.readAsText(file);
    });

    // OPRAVA (2.8.2026): dvoufazove potvrzeni stejne jako u odebrani
    // projektu - tohle smaze UPLNE VSECHNO, vsechny projekty najednou,
    // bez moznosti navratu. Faze 1: vysvetleni + potvrzovaci dialog.
    // Faze 2: napsat presne slovo "smazat".
    container.querySelector('#rowDeleteAll').addEventListener('click', async ()=>{
      const ok1 = await Layout.confirmDialog(
        'Opravdu smazat úplně všechna data appky? Tohle nevratně smaže VŠECHNY stavby na tomhle zařízení - deníky, fotky, výdaje, dokumenty i nastavení. Appka nemá žádnou zálohu, tenhle krok nejde vrátit zpět.',
        'Ano, chci smazat', 'Zrušit'
      );
      if(!ok1) return;
      const typed = prompt('Pro potvrzení napiš slovo "smazat":');
      if(typed === null) return;
      if(typed.trim().toLowerCase() !== 'smazat'){
        alert('Slovo nesouhlasí, appka nic nesmazala.');
        return;
      }
      const keys = [];
      for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&k.startsWith('ms_')) keys.push(k); }
      keys.forEach(k=>localStorage.removeItem(k));
      Router.go('onboarding-project');
    });

    return { activeTab:'', showNav:true };
  }
  return { render };
})();
Router.register('settings', SettingsScreen);
