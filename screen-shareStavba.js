/* ==========================================================
   SDILENI STAVBY (bod 1 specifikace) - "Sdilet stavbu" a
   "Upravit pristup" obrazovky + Premium zed.
   Viz Premium-sdileni-specifikace.md, sekce 10.

   KROK 10a+10b+10c+11+12+13+14 (30.-31.7.2026): CELY tok je
   napojen na skutecny backend. Vytvoreni pozvanky, seznam
   pozvanych, editace, skutecne PRIJETI pozvanky, a po prijeti
   appka pozvanemu STAHNE textova data (etapy/finance/denik/
   kalendar/ukoly) I SOUBORY (fotky/dokumenty/uctenky) ze
   Supabase Storage - viz MSCloud.materializeSharedProject()
   a MSCloud.syncSharedFiles() v supabase-data.js.

   DULEZITE OMEZENI (vedome, zapsano v Premium-sdileni-specifikace.md):
   NENI to zive sdileni - je to jednorazovy/rucne obnovitelny
   snimek (appka nema zadnou pojistku proti tomu, aby si pozvany
   ve svem "zrcadle" neco upravil - takova zmena se ale NIKDY
   neposle zpet vlastnikovi a pri dalsim "Aktualizovat" zase
   zmizi). Fotky/dokumenty se navic synchronizuji jen OD ted DAL
   (soubory pridane pred Krokem 13 se zpetne nedohledavaji).
   ========================================================== */
const ShareStavbaScreen = (function(){

  const ROLE_LABEL = { rodina:'Rodina', dozor:'Stavební dozor', projektant:'Projektant', vlastni:'Vlastní' };
  const SECTION_LABEL = { finance:'Finance', denik:'Deník', etapy:'Etapy', projekt:'Projekt', kalendar:'Kalendář', fotky:'Fotky' };
  const SECTION_ORDER = ['finance','denik','etapy','projekt','kalendar','fotky'];

  // Pevne definice sablon - viz specifikace 10.3. "dozor" a "projektant"
  // se NIKDY needituji (ani pri zalozeni, ani pozdeji).
  const TEMPLATES = {
    rodina:    { sections:{finance:1,denik:1,etapy:1,projekt:1,kalendar:1,fotky:1}, canAdd:true,  editableLater:true  },
    dozor:     { sections:{finance:0,denik:1,etapy:1,projekt:1,kalendar:0,fotky:1}, canAdd:false, editableLater:false },
    projektant:{ sections:{finance:0,denik:0,etapy:0,projekt:1,kalendar:0,fotky:0}, canAdd:true,  editableLater:false },
  };

  function roleIcon(role){
    if(role === 'rodina') return '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M14 14.3c2.7.3 5 2.5 5 5.7"/>';
    if(role === 'dozor') return '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>';
    if(role === 'projektant') return '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M8 9h8M8 13h5"/>';
    return '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8"/>'; // vlastni / fallback
  }
  function roleColor(role){
    if(role === 'rodina') return '#c8562f';
    if(role === 'dozor') return '#5a7fb0';
    if(role === 'projektant') return '#8a7a4a';
    return 'var(--accent)';
  }
  function svgIcon(role, size){
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="color:${roleColor(role)}">${roleIcon(role)}</svg>`;
  }

  /* =========================================================
     OBRAZOVKA: Sdilet stavbu (hlavni)
     ========================================================= */
  function render(container){
    let selectedTpl = null;
    let custom = { sections:{finance:0,denik:0,etapy:0,projekt:0,kalendar:0,fotky:0}, canAdd:false };

    container.innerHTML = `
      <div class="topbar">
        <div class="back-btn" id="backBtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></div>
        <h1>Sdílet stavbu</h1>
      </div>
      <div class="screen-scroll">
        <p class="section-label" style="margin-top:2px">Komu dáš přístup</p>
        <div id="tplGrid" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px">
          ${tplTile('rodina','Rodina','Vidí a přidává vše, nemůže mazat')}
          ${tplTile('dozor','Stavební dozor','Etapy, projekt a deník s fotkami, nic nepřidává')}
          ${tplTile('projektant','Projektant','Jen záložka Projekt, může přidávat')}
          ${tplTile('vlastni','Vlastní','Sám vybereš, co uvidí a co smí')}
        </div>

        <div id="customPanel" style="display:none;border:1.5px solid var(--accent);background:var(--card-bg);padding:10px 14px;margin:12px 0 0">
          <p class="section-label" style="margin:0 0 4px">Co uvidí</p>
          ${SECTION_ORDER.map(sec=>`
            <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)">
              <b style="font-size:12px;font-weight:700">${SECTION_LABEL[sec]}</b>
              <div class="chk" data-sec="${sec}" style="width:18px;height:18px;border:1.5px solid var(--line);display:grid;place-items:center;cursor:pointer;background:var(--card-bg-2)"></div>
            </div>
          `).join('')}
          <div style="display:flex;align-items:center;justify-content:space-between;padding-top:8px;margin-top:2px;border-top:1.5px dashed var(--line)">
            <b style="font-size:12.5px">Může přidávat</b>
            <div class="switch" id="customAddSwitch" style="width:36px;height:20px;border-radius:10px;border:1px solid var(--line);position:relative;cursor:pointer;background:var(--card-bg-2)"><i style="position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--muted);transition:left .15s"></i></div>
          </div>
          <p style="font-size:10px;color:var(--muted);line-height:1.5;margin:9px 0 0">V Etapách se vždycky ukáže jen to, na co má přístup i jinde (např. ceny jen s Financemi).</p>
        </div>

        <div id="shareBtnWrap" style="padding-top:14px;padding-bottom:6px">
          <button class="btn-primary" id="btnShare" disabled>Sdílet projekt</button>
          <p id="shareHint" style="font-size:10.5px;color:var(--muted);text-align:center;margin:8px 0 0">Nejdřív vyber výše, komu chceš dát přístup.</p>
        </div>

        <p class="section-label">Pozvaní lidé</p>
        <div id="peopleList"></div>
      </div>
    `;

    container.querySelector('#backBtn').addEventListener('click', ()=> Router.back());

    const tplGrid = container.querySelector('#tplGrid');
    const customPanel = container.querySelector('#customPanel');
    const shareBtnWrap = container.querySelector('#shareBtnWrap');
    const btnShare = container.querySelector('#btnShare');

    tplGrid.querySelectorAll('.tpl-tile').forEach(t=>{
      t.addEventListener('click', ()=>{
        selectedTpl = t.dataset.tpl;
        tplGrid.querySelectorAll('.tpl-tile').forEach(x=> x.style.borderColor = 'var(--line)');
        t.style.borderColor = 'var(--accent)';
        const isCustom = selectedTpl === 'vlastni';
        customPanel.style.display = isCustom ? 'block' : 'none';
        shareBtnWrap.style.paddingTop = isCustom ? '0' : '14px';
        btnShare.disabled = false;
        const shareHint = container.querySelector('#shareHint');
        if(shareHint) shareHint.style.display = 'none';
      });
    });

    customPanel.querySelectorAll('.chk').forEach(c=>{
      c.addEventListener('click', ()=>{
        const on = !custom.sections[c.dataset.sec];
        custom.sections[c.dataset.sec] = on ? 1 : 0;
        c.style.background = on ? 'var(--accent)' : 'var(--card-bg-2)';
        c.style.borderColor = on ? 'var(--accent)' : 'var(--line)';
        c.innerHTML = on ? checkSvg() : '';
      });
    });
    const addSwitch = container.querySelector('#customAddSwitch');
    addSwitch.addEventListener('click', ()=>{
      custom.canAdd = !custom.canAdd;
      addSwitch.style.background = custom.canAdd ? 'var(--accent)' : 'var(--card-bg-2)';
      addSwitch.style.borderColor = custom.canAdd ? 'var(--accent)' : 'var(--line)';
      addSwitch.querySelector('i').style.left = custom.canAdd ? '18px' : '2px';
      addSwitch.querySelector('i').style.background = custom.canAdd ? '#fff' : 'var(--muted)';
    });

    btnShare.addEventListener('click', ()=>{
      if(!selectedTpl) return;
      if(!msIsPremiumMock()){
        openPremiumWall(selectedTpl, ()=> doShare(selectedTpl, custom, container));
        return;
      }
      doShare(selectedTpl, custom, container);
    });

    renderPeopleList(container);
  }

  function tplTile(key, title, desc){
    return `
      <div class="tpl-tile" data-tpl="${key}" style="border:1.5px solid var(--line);background:var(--card-bg);padding:14px 12px;cursor:pointer;display:flex;flex-direction:column;gap:6px;text-align:left">
        ${svgIcon(key,26)}
        <b style="font-size:13px;font-family:var(--font-head)">${title}</b>
        <span style="font-size:10.5px;color:var(--muted);line-height:1.4">${desc}</span>
      </div>
    `;
  }
  function checkSvg(){
    return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
  }

  function doShare(tpl, custom, container){
    const def = tpl === 'vlastni' ? custom : TEMPLATES[tpl];
    const btnShare = container.querySelector('#btnShare');
    if(btnShare){ btnShare.disabled = true; btnShare.textContent = 'Vytvářím odkaz…'; }

    MSCloud.createInvite(tpl, !!def.canAdd, Object.assign({}, def.sections)).then(({invite, error})=>{
      if(btnShare){ btnShare.disabled = false; btnShare.textContent = 'Sdílet projekt'; }
      if(error){
        alert('Pozvánku se nepodařilo vytvořit: ' + (typeof error === 'string' ? error : (error.message || 'neznámá chyba')) + '\n\n(Musíš být přihlášen/a a mít aktivní Premium pro tuhle stavbu.)');
        return;
      }
      const link = MSCloud.inviteLink(invite.token);
      if(navigator.share){
        navigator.share({ title:'Pozvánka do appky Moje Stavba', url: link }).then(()=>{
          renderPeopleList(container);
        }).catch(async ()=>{
          // Sdileni bylo zruseno/nevyslo (system share sheet zavrena
          // krizkem apod.) - pozvanku, kterou jsme uz stihli vytvorit,
          // proto zase stahneme zpet, at se v seznamu neobjevi neco,
          // co jsi ve skutecnosti nikomu neposlal(a).
          await MSCloud.cancelInvite(invite.id);
          renderPeopleList(container);
        });
      } else {
        const typed = prompt('Odkaz na pozvánku (zkopíruj a pošli tomu, koho zveš):', link);
        if(typed === null){
          MSCloud.cancelInvite(invite.id).then(()=> renderPeopleList(container));
        } else {
          renderPeopleList(container);
        }
      }
    }).catch(e=>{
      // Pojistka: kdyby cokoli nad ramec ocekavaneho selhalo (napr. vypadek
      // site uprostred pozadavku), tlacitko se ma VZDY vratit do puvodniho
      // stavu, at neni appka "zasekla" a nemusi se restartovat.
      console.error('doShare neocekavana chyba', e);
      if(btnShare){ btnShare.disabled = false; btnShare.textContent = 'Sdílet projekt'; }
      alert('Něco se nepovedlo. Zkontroluj prosím připojení k internetu a zkus to znovu.');
    });
  }

  function renderPeopleList(container){
    const wrap = container.querySelector('#peopleList');
    wrap.innerHTML = `<p class="empty-msg" style="text-align:center;padding:18px 0;color:var(--muted);font-size:11.5px">Načítám…</p>`;

    MSCloud.listPeople().then(({people, error})=>{
      if(error){
        wrap.innerHTML = `<p class="empty-msg" style="text-align:center;padding:18px 0;color:var(--muted);font-size:11.5px">Nepodařilo se načíst seznam (${escapeHtml(typeof error==='string'?error:(error.message||'chyba'))}).</p>`;
        return;
      }
      if(!people.length){
        wrap.innerHTML = `<p class="empty-msg" style="text-align:center;padding:18px 0">Zatím jsi s nikým nesdílel(a).</p>`;
        return;
      }
      wrap.innerHTML = people.map(p=>{
        const statusChip = p.status === 'active'
          ? `<span style="font-size:8.5px;font-weight:800;padding:3px 6px;border:1px solid var(--money-pos);color:var(--money-pos);text-transform:uppercase">Aktivní</span>`
          : p.status === 'denied'
          ? `<span style="font-size:8.5px;font-weight:800;padding:3px 6px;border:1px solid var(--accent);color:var(--accent);text-transform:uppercase">Odepřeno</span>`
          : `<span style="font-size:8.5px;font-weight:800;padding:3px 6px;border:1px solid var(--muted);color:var(--muted);text-transform:uppercase">Čeká na přijetí</span>`;
        const addBadge = p.canAdd ? `<span style="width:16px;height:16px;border-radius:50%;background:var(--money-pos);color:#fff;display:inline-grid;place-items:center" title="Může přidávat"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span>` : '';
        return `
          <div class="person-row" data-id="${p.id}" style="display:flex;align-items:center;gap:11px;padding:12px 4px;border-bottom:1px solid var(--line);cursor:pointer;${p.status==='denied'?'opacity:.55':''}">
            <div style="width:38px;height:38px;border:1.5px solid var(--line);border-radius:50%;display:grid;place-items:center;background:var(--card-bg);flex:0 0 auto">
              ${svgIcon(p.role,18)}
            </div>
            <div style="flex:1;min-width:0">
              <b style="display:block;font-size:13px">${escapeHtml(p.name)}</b>
              <span style="font-size:10.5px;color:var(--muted);display:flex;align-items:center;gap:5px;margin-top:2px">${ROLE_LABEL[p.role]||'Vlastní'} ${addBadge}</span>
            </div>
            ${statusChip}
            <span style="color:var(--muted);flex:0 0 auto"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg></span>
          </div>
        `;
      }).join('');
      wrap.querySelectorAll('.person-row').forEach(row=>{
        row.addEventListener('click', ()=> Router.go('sdilet-upravit', { id: row.dataset.id }));
      });
    }).catch(e=>{
      // Pojistka: kdyby nacitani seznamu neocekavane spadlo, ukaz aspon
      // chybovou hlasku s moznosti to zkusit znovu, at appka nezustane
      // navzdy trcet na "Nacitam...".
      console.error('renderPeopleList neocekavana chyba', e);
      wrap.innerHTML = `<p class="empty-msg" style="text-align:center;padding:18px 0;color:var(--muted);font-size:11.5px">Nepodařilo se načíst seznam. Zkontroluj připojení k internetu a zkus to znovu.</p>`;
    });
  }

  function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  /* =========================================================
     PREMIUM ZED - u tlacitka "Sdilet projekt", jen pokud
     msIsPremiumMock() je false. Viz specifikace 10.1.
     ========================================================= */
  function openPremiumWall(chosenTpl, onProceed){
    const overlay = document.createElement('div');
    overlay.className = 'ms-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(29,30,28,.55);z-index:92;display:flex;align-items:flex-end;justify-content:center';
    document.body.appendChild(overlay);
    const roleLabel = ROLE_LABEL[chosenTpl] || 'vybranou roli';
    overlay.innerHTML = `
      <div style="width:100%;max-width:480px;background:var(--card-bg-2);border-top:1.5px solid var(--line);padding:22px 20px calc(22px + min(env(safe-area-inset-bottom),34px));text-align:center">
        <div style="display:flex;margin-bottom:2px">
          <button id="pwClose" style="width:26px;height:26px;border:1.5px solid var(--line);display:grid;place-items:center;color:var(--muted);margin-left:auto;background:transparent;cursor:pointer">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div style="width:50px;height:50px;border:1.5px solid var(--accent);display:grid;place-items:center;color:var(--accent);margin:6px auto 16px">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v6M12 2l3 3M12 2L9 5"/><rect x="3" y="11" width="18" height="10" rx="0"/><path d="M7 11V9a5 5 0 0 1 10 0v2"/></svg>
        </div>
        <h2 style="font-family:var(--font-head);font-size:21px;line-height:1.22;margin:0 0 10px;color:var(--text-main)">Projekt je připravený, chybí Premium</h2>
        <p style="font-size:13px;line-height:1.55;color:var(--text-main);margin:0 0 4px">Aktivací appka projekt nahraje do cloudu a rovnou pošle pozvánku přesně s právy pro <b style="color:var(--accent)">${roleLabel}</b>, jak jsi vybral(a).</p>
        <p style="font-size:11px;color:var(--muted);margin:14px 0 2px">Platí jen pro tuhle stavbu — od 69 Kč / měsíc, nebo natrvalo za 1499 Kč.</p>
        <button class="btn-primary" id="pwActivate" style="width:100%;margin-top:8px">Aktivovat Premium</button>
        <button id="pwCancel" style="width:100%;text-align:center;background:none;border:none;color:var(--muted);font-size:12px;text-decoration:underline;text-underline-offset:3px;padding:12px 0 0;cursor:pointer;font-family:inherit">Zpět k výběru</button>
      </div>
    `;
    function close(){ if(overlay.parentNode) overlay.parentNode.removeChild(overlay); }
    overlay.querySelector('#pwClose').addEventListener('click', close);
    overlay.querySelector('#pwCancel').addEventListener('click', close);
    overlay.querySelector('#pwActivate').addEventListener('click', ()=>{
      close();
      PremiumLogin.open(()=>{ if(onProceed) onProceed(); });
    });
  }

  Router.register('sdilet-stavbu', { render });

  /* =========================================================
     OBRAZOVKA: Upravit pristup
     ========================================================= */
  function renderEdit(container, params){
    const id = params && params.id;
    container.innerHTML = `
      <div class="topbar">
        <div class="back-btn" id="backBtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></div>
        <h1>Upravit přístup</h1>
      </div>
      <div class="screen-scroll" id="editBody" style="display:flex;flex-direction:column;min-height:calc(100% - 10px)">
        <p class="empty-msg" style="text-align:center;padding:30px 0;color:var(--muted)">Načítám…</p>
      </div>
    `;
    container.querySelector('#backBtn').addEventListener('click', ()=> Router.back());

    if(!id || typeof MSCloud === 'undefined'){
      container.querySelector('#editBody').innerHTML = `<p class="empty-msg" style="text-align:center;padding:30px 0">Tahle osoba už v seznamu není.</p>`;
      return { activeTab:'', showNav:true };
    }

    MSCloud.getPerson(id).then(({person, kind, rawId, error})=>{
      const body = container.querySelector('#editBody');
      if(!body) return; // appka mezitim prenavigovala jinam
      if(error){
        body.innerHTML = `<p class="empty-msg" style="text-align:center;padding:30px 0;color:var(--muted)">Nepodařilo se načíst (${escapeHtml(typeof error==='string'?error:(error.message||'chyba'))}). Zkus to prosím znovu.</p>`;
        return;
      }
      if(!person){
        body.innerHTML = `<p class="empty-msg" style="text-align:center;padding:30px 0">Tahle osoba už v seznamu není.</p>`;
        return;
      }
      renderEditBody(body, kind, rawId, person);
    }).catch(e=>{
      console.error('renderEdit neocekavana chyba', e);
      const body = container.querySelector('#editBody');
      if(body) body.innerHTML = `<p class="empty-msg" style="text-align:center;padding:30px 0;color:var(--muted)">Nepodařilo se načíst. Zkontroluj prosím připojení k internetu.</p>`;
    });

    return { activeTab:'', showNav:true };
  }

  /* ---------------------------------------------------------
     Krok 10b - skutecny obsah obrazovky "Upravit pristup", jakmile
     uz mame nactena data z backendu. "invite" (jeste neprijata
     pozvanka) ma jen zjednodusene zobrazeni + zruseni. "member"
     (uz skutecny prijaty clovek) ma plnou editaci prav.
     --------------------------------------------------------- */
  function renderEditBody(body, kind, rawId, person){
    if(kind === 'invite'){
      body.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;padding:18px 16px 10px;text-align:center">
          <div style="width:64px;height:64px;border:1.5px solid var(--line);border-radius:50%;display:grid;place-items:center;background:var(--card-bg);margin-bottom:12px">
            ${svgIcon(person.role, 30)}
          </div>
          <b style="font-family:var(--font-head);font-size:19px;color:var(--text-main)">${escapeHtml(person.name)}</b>
          <span style="font-size:11.5px;color:var(--muted);margin-top:4px">(e-mail zatím neznámý, čeká na přijetí)</span>
          <span style="display:inline-block;margin-top:8px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;border:1px solid var(--accent);color:var(--accent);padding:4px 10px">${ROLE_LABEL[person.role]||'Vlastní'}</span>
        </div>
        <p class="section-label" style="margin:16px 16px 8px">Co uvidí, jakmile přijme</p>
        <div style="border:1.5px solid var(--line);background:var(--card-bg);padding:10px 14px;margin:6px 16px 4px">
          ${SECTION_ORDER.map(sec=>`
            <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--line);opacity:.7">
              <b style="font-size:12.5px;font-weight:700">${SECTION_LABEL[sec]}</b>
              <div style="width:19px;height:19px;border:1.5px solid ${person.sections[sec]?'var(--accent)':'var(--line)'};background:${person.sections[sec]?'var(--accent)':'var(--card-bg-2)'};display:grid;place-items:center;color:#fff">${person.sections[sec]?checkSvg():''}</div>
            </div>
          `).join('')}
        </div>
        <p style="font-size:10.5px;color:var(--muted);line-height:1.5;margin:8px 16px 0">Dokud pozvánku nepřijme, práva se nedají upravovat. Klidně mu pošli odkaz znovu, nebo pozvánku zruš.</p>
        <div style="padding:18px 16px calc(24px + min(env(safe-area-inset-bottom),34px));margin-top:auto">
          <button id="btnCancelInvite" style="width:100%;border:1.5px solid #ff7a86;background:transparent;color:#ff7a86;font-weight:700;font-size:13px;padding:12px;cursor:pointer;font-family:inherit">Zrušit pozvánku</button>
        </div>
      `;
      body.querySelector('#btnCancelInvite').addEventListener('click', async ()=>{
        const ok = await Layout.confirmDialog('Opravdu zrušit tuhle pozvánku?', 'Zrušit pozvánku');
        if(!ok) return;
        const btn = body.querySelector('#btnCancelInvite');
        btn.disabled = true; btn.textContent = 'Ruším…';
        const { error } = await MSCloud.cancelInvite(rawId);
        if(error){
          btn.disabled = false; btn.textContent = 'Zrušit pozvánku';
          alert('Nepodařilo se zrušit pozvánku: ' + (typeof error==='string'?error:(error.message||'neznámá chyba')));
          return;
        }
        Router.go('sdilet-stavbu');
      });
      return;
    }

    // kind === 'member' - skutecny prijaty clovek, plna editace
    body.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;padding:18px 16px 10px;text-align:center">
        <div style="width:64px;height:64px;border:1.5px solid var(--line);border-radius:50%;display:grid;place-items:center;background:var(--card-bg);margin-bottom:12px">
          ${svgIcon(person.role, 30)}
        </div>
        <div style="display:flex;align-items:center;gap:8px;justify-content:center;margin-bottom:8px">
          <input id="nameInput" value="${escapeHtml(person.name)}" style="border:none;border-bottom:1.5px solid var(--line);background:transparent;color:var(--text-main);font-family:var(--font-head);font-size:19px;padding:4px 0;text-align:center;width:auto;max-width:220px">
          <span id="nameEditIcon" title="Přejmenovat" style="width:22px;height:22px;border:1.5px solid var(--line);display:grid;place-items:center;color:var(--accent);flex:0 0 auto;cursor:pointer">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
          </span>
        </div>
        <span style="font-size:11.5px;color:var(--muted)">${person.email ? escapeHtml(person.email) : ''}</span>
        <span style="display:inline-block;margin-top:8px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;border:1px solid var(--accent);color:var(--accent);padding:4px 10px">${ROLE_LABEL[person.role]||'Vlastní'}</span>
      </div>

      <p class="section-label" style="margin:16px 16px 8px">Co vidí a smí</p>
      <div id="customPanel" style="border:1.5px solid var(--line);background:var(--card-bg);padding:10px 14px;margin:6px 16px 4px">
        ${SECTION_ORDER.map(sec=>`
          <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--line)">
            <b style="font-size:12.5px;font-weight:700">${SECTION_LABEL[sec]}</b>
            <div class="chk" data-sec="${sec}" style="width:19px;height:19px;border:1.5px solid ${person.sections[sec]?'var(--accent)':'var(--line)'};background:${person.sections[sec]?'var(--accent)':'var(--card-bg-2)'};display:grid;place-items:center;cursor:pointer;color:#fff">${person.sections[sec]?checkSvg():''}</div>
          </div>
        `).join('')}
        <div style="display:flex;align-items:center;justify-content:space-between;padding-top:9px;margin-top:3px;border-top:1.5px dashed var(--line)">
          <b style="font-size:12.5px">Může přidávat</b>
          <div class="switch" id="addSwitch" style="width:36px;height:20px;border-radius:10px;border:1px solid ${person.canAdd?'var(--accent)':'var(--line)'};position:relative;cursor:pointer;background:${person.canAdd?'var(--accent)':'var(--card-bg-2)'}">
            <i style="position:absolute;top:2px;left:${person.canAdd?'18px':'2px'};width:14px;height:14px;border-radius:50%;background:${person.canAdd?'#fff':'var(--muted)'};transition:left .15s"></i>
          </div>
        </div>
        <p style="font-size:10px;color:var(--muted);line-height:1.5;margin:9px 0 0">V Etapách se vždycky ukáže jen to, na co má přístup i jinde (např. ceny jen s Financemi).</p>
      </div>
      <div id="saveWrap" style="display:none;padding:0 16px 6px">
        <button class="btn-primary" id="btnSave" style="width:100%">Uložit změny přístupu</button>
      </div>

      ${person.status === 'denied' ? `
        <div style="padding:0 16px 6px">
          <p style="font-size:11px;color:var(--muted);line-height:1.5;margin:0 0 10px">${person.deniedReason === 'expired' ? 'Appka mu přístup zamkla sama, protože vypršelo Premium pro tuhle stavbu. Jakmile předplatné obnovíš, odemkne se mu automaticky.' : 'Přístup jsi mu zamkl(a) ty ručně.'}</p>
          <button id="btnUnlock" style="width:100%;border:1.5px solid var(--money-pos);background:transparent;color:var(--money-pos);font-weight:700;font-size:13px;padding:12px;cursor:pointer;font-family:inherit">Znovu odemknout přístup</button>
        </div>
      ` : ''}

      <div style="padding:18px 16px calc(24px + min(env(safe-area-inset-bottom),34px));margin-top:auto">
        ${person.status !== 'denied' ? `
          <div style="margin-bottom:10px">
            <button id="btnDeny" style="width:100%;border:1.5px solid var(--accent);background:transparent;color:var(--accent);font-weight:700;font-size:13px;padding:12px;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="10" rx="1"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
              Odepřít přístup (dočasně)
            </button>
          </div>
        ` : ''}
        <button id="btnRemove" style="width:100%;border:1.5px solid #ff7a86;background:transparent;color:#ff7a86;font-weight:700;font-size:13px;padding:12px;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></svg>
          Odebrat sdílení úplně
        </button>
        <p style="font-size:10.5px;color:var(--muted);line-height:1.5;margin:10px 4px 0">Nevratné — ${escapeHtml(person.name)} ztratí přístup úplně a musel(a) by dostat novou pozvánku. Tvůj projekt tím nijak nezmizí ani se nesmaže.</p>
      </div>
    `;

    // prejmenovani - realny zapis
    const nameInput = body.querySelector('#nameInput');
    function commitName(){
      const v = nameInput.value.trim();
      if(v && v !== person.name){
        person.name = v;
        MSCloud.updateMember(rawId, { name: v }).then(({error})=>{
          if(error) console.error('Prejmenovani se neulozilo', error);
        });
      }
    }
    nameInput.addEventListener('blur', commitName);
    nameInput.addEventListener('keydown', e=>{ if(e.key==='Enter') nameInput.blur(); });
    const nameEditIcon = body.querySelector('#nameEditIcon');
    if(nameEditIcon) nameEditIcon.addEventListener('click', ()=> nameInput.focus());

    // checklist + ulozit zmeny
    const saveWrap = body.querySelector('#saveWrap');
    const btnSave = body.querySelector('#btnSave');
    let workingSections = Object.assign({}, person.sections);
    let workingCanAdd = person.canAdd;
    function refreshSaveVisibility(){
      const changed = JSON.stringify(workingSections) !== JSON.stringify(person.sections) || workingCanAdd !== person.canAdd;
      saveWrap.style.display = changed ? 'block' : 'none';
    }
    body.querySelectorAll('#customPanel .chk').forEach(c=>{
      c.addEventListener('click', ()=>{
        const on = !workingSections[c.dataset.sec];
        workingSections[c.dataset.sec] = on ? 1 : 0;
        c.style.background = on ? 'var(--accent)' : 'var(--card-bg-2)';
        c.style.borderColor = on ? 'var(--accent)' : 'var(--line)';
        c.innerHTML = on ? checkSvg() : '';
        refreshSaveVisibility();
      });
    });
    const addSwitch = body.querySelector('#addSwitch');
    addSwitch.addEventListener('click', ()=>{
      workingCanAdd = !workingCanAdd;
      addSwitch.style.background = workingCanAdd ? 'var(--accent)' : 'var(--card-bg-2)';
      addSwitch.style.borderColor = workingCanAdd ? 'var(--accent)' : 'var(--line)';
      addSwitch.querySelector('i').style.left = workingCanAdd ? '18px' : '2px';
      addSwitch.querySelector('i').style.background = workingCanAdd ? '#fff' : 'var(--muted)';
      refreshSaveVisibility();
    });
    btnSave.addEventListener('click', async ()=>{
      const ok = await Layout.confirmDialog('Uložit změny přístupu?', 'Uložit');
      if(!ok) return;
      btnSave.disabled = true; btnSave.textContent = 'Ukládám…';
      const { error } = await MSCloud.updateMember(rawId, { sections: workingSections, can_add: workingCanAdd });
      btnSave.disabled = false; btnSave.textContent = 'Uložit změny přístupu';
      if(error){
        alert('Nepodařilo se uložit: ' + (typeof error==='string'?error:(error.message||'neznámá chyba')));
        return;
      }
      person.sections = Object.assign({}, workingSections);
      person.canAdd = workingCanAdd;
      saveWrap.style.display = 'none';
    });

    // odemknout (z odepreneho stavu zpet na aktivni)
    const btnUnlock = body.querySelector('#btnUnlock');
    if(btnUnlock){
      btnUnlock.addEventListener('click', async ()=>{
        const ok = await Layout.confirmDialog('Znovu odemknout přístup?', 'Odemknout');
        if(!ok) return;
        btnUnlock.disabled = true; btnUnlock.textContent = 'Odemykám…';
        const { error } = await MSCloud.updateMember(rawId, { status: 'active', denied_reason: null });
        if(error){
          btnUnlock.disabled = false; btnUnlock.textContent = 'Znovu odemknout přístup';
          alert('Nepodařilo se odemknout: ' + (typeof error==='string'?error:(error.message||'neznámá chyba')));
          return;
        }
        Router.go('sdilet-upravit', { id: person.id });
      });
    }

    // odepřít pristup
    const btnDeny = body.querySelector('#btnDeny');
    if(btnDeny){
      btnDeny.addEventListener('click', async ()=>{
        const ok = await Layout.confirmDialog('Opravdu odepřít přístup?', 'Odepřít');
        if(!ok) return;
        btnDeny.disabled = true; btnDeny.textContent = 'Odpírám…';
        const { error } = await MSCloud.updateMember(rawId, { status: 'denied', denied_reason: 'manual' });
        if(error){
          btnDeny.disabled = false; btnDeny.textContent = 'Odepřít přístup (dočasně)';
          alert('Nepodařilo se odepřít přístup: ' + (typeof error==='string'?error:(error.message||'neznámá chyba')));
          return;
        }
        Router.go('sdilet-upravit', { id: person.id });
      });
    }

    // odebrat sdileni uplne
    body.querySelector('#btnRemove').addEventListener('click', async ()=>{
      const ok = await Layout.confirmDialog('Opravdu odebrat sdílení? Nedá se to vrátit.', 'Odebrat');
      if(!ok) return;
      const btnRemove = body.querySelector('#btnRemove');
      btnRemove.disabled = true; btnRemove.textContent = 'Odebírám…';
      const { error } = await MSCloud.removeMember(rawId);
      if(error){
        btnRemove.disabled = false; btnRemove.textContent = 'Odebrat sdílení úplně';
        alert('Nepodařilo se odebrat sdílení: ' + (typeof error==='string'?error:(error.message||'neznámá chyba')));
        return;
      }
      Router.go('sdilet-stavbu');
    });
  }

  Router.register('sdilet-upravit', { render: renderEdit });

  /* =========================================================
     OBRAZOVKA: Byl jsi pozvan (strana pozvaneho, bod 3.3/12)
     Route: 'prijmout-pozvanku', params: { id: <person.id> }
     ========================================================= */
  /* =========================================================
     OBRAZOVKA: Byl jsi pozvan (strana pozvaneho, bod 3.3/12)
     Krok 10c (30.7.2026): SKUTECNY tok, ne mock. Route:
     'prijmout-pozvanku', ocekava v URL '?token=...' (viz
     MSCloud.inviteLink() - presne tenhle tvar odkazu appka
     sama vygenerovala v Kroku 10a).
     ========================================================= */
  function renderInviteLanding(container, params){
    const token = params && params.token;

    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;padding:18px 16px 4px;gap:8px">
        <span style="font:800 11px/1 var(--font-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)">Moje Stavba</span>
      </div>
      <div class="screen-scroll" id="landingBody" style="display:flex;flex-direction:column;text-align:center;padding-top:10px;min-height:calc(100% - 30px)">
        <p class="empty-msg" style="padding-top:40px">Načítám pozvánku…</p>
      </div>
    `;
    const body = container.querySelector('#landingBody');

    if(!token || typeof MSCloud === 'undefined'){
      body.innerHTML = `<p class="empty-msg" style="padding-top:40px">Tenhle odkaz není platný.</p>`;
      return { activeTab:'', showNav:false };
    }

    MSCloud.previewInvite(token).then(({preview, error})=>{
      if(!body.isConnected) return; // appka mezitim prenavigovala jinam
      if(error || !preview){
        body.innerHTML = `
          <div style="width:56px;height:56px;border:1.5px solid var(--muted);color:var(--muted);display:grid;place-items:center;margin:30px auto 18px">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
          </div>
          <h1 style="font-family:var(--font-head);font-size:22px;line-height:1.25;margin:0 0 22px">Tahle pozvánka<br>už neplatí</h1>
          <div style="border:1.5px solid var(--accent);background:var(--card-bg);padding:16px;text-align:left;margin-bottom:20px">
            <p style="margin:0;font-size:12.5px;color:var(--text-main);line-height:1.55">${error ? 'Nepodařilo se ji načíst — zkontroluj připojení k internetu.' : 'Odkaz už byl použitý nebo zrušený. Požádej vlastníka stavby o novou pozvánku.'}</p>
          </div>
        `;
        return;
      }
      renderInvitePreviewBody(body, token, preview);
    }).catch(e=>{
      console.error('renderInviteLanding neocekavana chyba', e);
      if(body.isConnected) body.innerHTML = `<p class="empty-msg" style="padding-top:40px">Nepodařilo se načíst pozvánku. Zkontroluj připojení k internetu.</p>`;
    });

    return { activeTab:'', showNav:false };
  }

  function renderInvitePreviewBody(body, token, preview){
    const roleBadges = SECTION_ORDER.map(sec=>{
      const on = preview.sections[sec];
      return `<span style="font-size:10px;font-weight:700;padding:3px 7px;border:1px solid ${on?'var(--accent)':'var(--line)'};color:${on?'var(--accent)':'var(--muted)'};${on?'':'text-decoration:line-through;opacity:.6'}">${SECTION_LABEL[sec]}</span>`;
    }).join('');

    body.innerHTML = `
      <div style="width:56px;height:56px;border:1.5px solid var(--accent);color:var(--accent);display:grid;place-items:center;margin:10px auto 18px">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l9 6 9-6"/><rect x="3" y="5" width="18" height="14" rx="1"/></svg>
      </div>
      <h1 style="font-family:var(--font-head);font-size:22px;line-height:1.25;margin:0 0 4px">Byl(a) jsi pozván(a)<br>do stavby<br><span style="color:var(--accent)">${escapeHtml(preview.project_name || 'stavba')}</span></h1>

      <div style="border:1.5px solid var(--line);background:var(--card-bg);padding:14px;text-align:left;display:flex;gap:12px;align-items:flex-start;margin:20px 0">
        ${svgIcon(preview.role, 24)}
        <div>
          <b style="display:block;font-size:13.5px;font-family:var(--font-head);margin-bottom:3px">${ROLE_LABEL[preview.role]||'Vlastní'}</b>
          <span style="display:flex;flex-wrap:wrap;gap:5px;margin-top:4px">${roleBadges}</span>
          <span style="display:block;margin-top:7px;font-size:11px;color:var(--muted)">Může přidávat: <b style="color:var(--text-main)">${preview.can_add?'Ano':'Ne'}</b></span>
        </div>
      </div>

      <p style="font-size:12.5px;line-height:1.6;color:var(--text-main);text-align:left;margin-bottom:6px">Abychom věděli, kdo jsi, a dali ti přesně tenhle přístup, ověř se přes Google nebo e-mail.</p>
      <p style="font-size:11px;line-height:1.55;color:var(--muted);text-align:left;margin-bottom:26px"><b style="color:var(--text-main)">Tvoje vlastní appka a data se tím nijak nezmění</b> — tenhle projekt přibude vedle nich jako další, samostatný.</p>

      <div id="inviteActionWrap" style="margin-top:auto">
        <button class="btn-primary" id="continueBtn" style="width:100%">Přijmout pozvánku</button>
        <span id="skipLink" style="display:block;text-align:center;font-size:11.5px;color:var(--muted);text-decoration:underline;text-underline-offset:3px;margin-top:14px;cursor:pointer">Zatím nechci</span>
      </div>
    `;
    body.querySelector('#skipLink').addEventListener('click', ()=> Router.go('dashboard'));
    body.querySelector('#continueBtn').addEventListener('click', async ()=>{
      const btn = body.querySelector('#continueBtn');
      btn.disabled = true; btn.textContent = 'Ověřuji přihlášení…';
      let session = null;
      try{ session = await MSAuth.getSession(); }catch(e){}

      if(session){
        // uz prihlaseny (napr. driv v jine zalozce) - rovnou prijmout
        btn.textContent = 'Přijímám…';
        const { error, member } = await MSCloud.redeemInvite(token);
        if(error){
          btn.disabled = false; btn.textContent = 'Přijmout pozvánku';
          alert('Nepodařilo se přijmout pozvánku: ' + (typeof error==='string'?error:(error.message||'neznámá chyba')));
          return;
        }
        const localProject = await MSCloud.materializeSharedProject(member);
        renderInviteAccepted(body, localProject);
        return;
      }

      // neni prihlaseny - appka si ulozi token a spusti prihlaseni. Pokud
      // appka prihlaseni rozpozna BEZ restartu (stejna zalozka prohlizece,
      // viz MSAuth.onAuthChange), zavola se tenhle onSuccess primo. Pokud
      // appku presmerovani cele znovu nacte, prijeti resi checkAuthResume()
      // v teto same souboru misto toho.
      btn.disabled = false; btn.textContent = 'Přijmout pozvánku';
      PremiumLogin.openIdentityOnly(async ()=>{
        const { error, member } = await MSCloud.redeemInvite(token);
        if(error){
          alert('Nepodařilo se přijmout pozvánku: ' + (typeof error==='string'?error:(error.message||'neznámá chyba')));
          return;
        }
        const localProject = await MSCloud.materializeSharedProject(member);
        if(body.isConnected) renderInviteAccepted(body, localProject);
      }, token);
    });
  }

  function renderInviteAccepted(body, localProject){
    if(localProject) msSetActiveProjectId(localProject.id);
    const projLine = localProject
      ? `Appka na ni rovnou přepnula, jmenuje se <b style="color:var(--accent)">${escapeHtml(localProject.name)}</b>.`
      : `Pokud se v Nastavení → Projekty ještě neobjevila, zkus appku za chvíli otevřít znovu.`;
    body.innerHTML = `
      <div style="width:56px;height:56px;border:1.5px solid var(--money-pos);color:var(--money-pos);display:grid;place-items:center;margin:30px auto 18px">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
      </div>
      <h1 style="font-family:var(--font-head);font-size:22px;line-height:1.25;margin:0 0 14px">Pozvánka přijata!</h1>
      <div style="border:1.5px solid var(--line);background:var(--card-bg);padding:16px;text-align:left;margin-bottom:20px">
        <p style="margin:0 0 8px;font-size:12.5px;color:var(--text-main);line-height:1.55">Tvůj přístup je teď aktivní a appka na pozadí stahuje etapy, finance, deník i fotky. ${projLine}</p>
        <p style="margin:0;font-size:11px;color:var(--muted);line-height:1.55">Není to živé sdílení — appka stáhla poslední snímek stavby. Novější data od vlastníka doženeš tlačítkem "Aktualizovat" u projektu v Nastavení.</p>
      </div>
      <div style="margin-top:auto"><button class="btn-primary" id="backHomeBtn" style="width:100%">Zpátky na appku</button></div>
    `;
    body.querySelector('#backHomeBtn').addEventListener('click', ()=> Router.go('dashboard'));
  }
  Router.register('prijmout-pozvanku', { render: renderInviteLanding });

  return { openPremiumWall };
})();
