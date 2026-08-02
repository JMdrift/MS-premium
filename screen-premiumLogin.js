/* ==========================================================
   PREMIUM - PRIHLASOVACI FLOW (obrazovky 1 / 1b / 1c)
   Viz Premium-sdileni-specifikace.md, bod 2 (Onboarding/prihlaseni).

   DULEZITE: tohle je zatim jen UI MOCK, bez skutecneho pripojeni
   na Google nebo Supabase. Zadna data se nikam neposilaji, zadny
   ucet se doopravdy nezaklada. Az bude appka mit realny backend
   (Supabase Auth + tabulka pro pending login pozadavky, viz bod
   2.5 specifikace), tenhle soubor se prepoji na skutecna volani -
   vizualni prubeh a chovani uz ale odpovida odsouhlasenym navrhum.

   Spousti se z Nastaveni -> Premium -> "Aktivovat Premium"
   (viz screen-settings.js).

   Vzor overlaye je stejny jako zbytek appky (trida .ms-overlay,
   appka ho sama uklidi pri kazde navigaci - viz router.js).
   ========================================================== */
const PremiumLogin = (function(){

  let overlayEl = null;
  let resendTimer = null;
  let expiryTimer = null;
  let authListenerUnsub = null;
  let onSuccessCb = null;
  let chosenPeriod = 'monthly';
  let flowMode = 'purchase'; // 'purchase' (Premium) | 'identity' (prijeti pozvanky, viz specifikace 12.4)
  let identityExtra = null; // Krok 10c: token pozvanky, kdyz flowMode === 'identity'

  const PLAN_PRICES = { monthly:'69 Kč / měsíc', yearly:'599 Kč / rok', lifetime:'1499 Kč jednou' };

  function projectName(){
    try{
      const projects = msLoadProjects();
      const id = msGetActiveProjectId();
      const p = projects.find(x=> x.id === id);
      return (p && p.name) ? p.name : 'tuhle stavbu';
    }catch(e){ return 'tuhle stavbu'; }
  }
  function esc(s){ return (s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  // Oprava chyby "Premium tlacitka prestanou fungovat": router pri kazde
  // navigaci sam smaze .ms-overlay z DOM (viz router.js), ale nezavola
  // pritom nas close() - modul si tak dal myslel "mam otevreno", i kdyz
  // uz ve skutecnosti nic na obrazovce neni, a dalsi klik na "Aktivovat
  // Premium" pak potichu nedelal nic. Reseni: pred kazdym pouzitim
  // overlayEl overit, ze je porad skutecne pripojeny v DOM.
  function isOverlayLive(){
    return !!(overlayEl && document.body.contains(overlayEl));
  }

  function open(onSuccess){
    if(isOverlayLive()) return; // uz opravdu otevreno, neotvirat podruhe
    flowMode = 'purchase';
    onSuccessCb = (typeof onSuccess === 'function') ? onSuccess : null;
    overlayEl = document.createElement('div');
    overlayEl.className = 'ms-overlay';
    overlayEl.style.cssText = 'position:fixed;inset:0;background:rgba(29,30,28,.55);z-index:95;display:flex;align-items:flex-end;justify-content:center';
    document.body.appendChild(overlayEl);

    // Oprava: appka doted VZDY ukazovala "Prihlas se pres Google/e-mail",
    // i kdyz uz clovek byl prihlaseny z drivejska (Supabase session zustava
    // ulozena mezi otevrenimi appky). Ted se nejdriv potichu zepta, jestli
    // uz session existuje, a pokud ano, preskoci rovnou na vyber obdobi.
    sheet(`
      <div style="padding:30px 0">
        <div style="width:36px;height:36px;border:1.5px solid var(--line);display:grid;place-items:center;color:var(--muted);margin:0 auto">
          <svg class="pl-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/></svg>
        </div>
      </div>
    `);
    injectSpin();
    if(typeof MSAuth === 'undefined'){ renderStep1(); return; }
    MSAuth.getSession().then(session=>{
      if(!isOverlayLive()) return; // appka mezitim zavrena/prenavigovana
      if(session){ renderSuccess({ mergedWithGoogle:false }); }
      else { renderStep1(); }
    }).catch(()=>{ if(isOverlayLive()) renderStep1(); });
  }

  // Pro prijmuti pozvanky (bod 3.3/12.4) - stejne obrazovky 1/1b/1c, ale
  // po uspesnem prihlaseni se NEJDE do nakupu, jen se zavola onSuccess.
  function openIdentityOnly(onSuccess, extra){
    if(isOverlayLive()) return;
    flowMode = 'identity';
    identityExtra = extra || null;
    onSuccessCb = (typeof onSuccess === 'function') ? onSuccess : null;
    overlayEl = document.createElement('div');
    overlayEl.className = 'ms-overlay';
    overlayEl.style.cssText = 'position:fixed;inset:0;background:rgba(29,30,28,.55);z-index:95;display:flex;align-items:flex-end;justify-content:center';
    document.body.appendChild(overlayEl);
    renderStep1();
  }

  function close(){
    clearResendTimer();
    clearExpiryTimer();
    stopAuthListening();
    if(overlayEl && overlayEl.parentNode){ overlayEl.parentNode.removeChild(overlayEl); }
    overlayEl = null;
    onSuccessCb = null;
    flowMode = 'purchase';
    identityExtra = null;
  }

  function stopAuthListening(){ if(authListenerUnsub){ authListenerUnsub(); authListenerUnsub = null; } }

  function sheet(inner){
    overlayEl.innerHTML = `<div style="width:100%;max-width:480px;background:var(--card-bg-2);border-top:1.5px solid var(--line);padding:18px 20px calc(22px + min(env(safe-area-inset-bottom),34px));text-align:center">${inner}</div>`;
  }

  /* ---------------------------------------------------------
     KROK 1: vyber metody prihlaseni
     --------------------------------------------------------- */
  function renderStep1(){
    clearResendTimer(); clearExpiryTimer();
    sheet(`
      <div style="display:flex;margin-bottom:6px">
        <button id="plClose" title="Zavřít" style="width:26px;height:26px;border:1.5px solid var(--line);display:grid;place-items:center;color:var(--muted);margin-left:auto;background:transparent;cursor:pointer">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div style="width:44px;height:44px;border:1.5px solid var(--accent);display:grid;place-items:center;color:var(--accent);margin-bottom:14px">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      </div>
      <h2 style="font-family:var(--font-head);font-size:19px;line-height:1.25;margin:0 0 10px;text-align:left;color:var(--text-main)">${flowMode==='identity' ? 'Než tě appka pustí do projektu, přihlas se' : 'Než aktivujeme Premium, přihlas se'}</h2>
      <p style="font-size:13px;line-height:1.55;color:var(--text-main);margin:0 0 4px;text-align:left">${flowMode==='identity' ? 'Abychom věděli, kdo jsi, a dali ti přesně ten přístup, který ti byl nastavený.' : 'Abychom projekt mohli zálohovat do cloudu a ty jsi ho mohl kdykoli nasdílet dalším lidem, potřebujeme vědět, kdo jsi.'}</p>
      <p style="font-size:11.5px;color:var(--muted);margin:0 0 20px;line-height:1.5;text-align:left"><b style="color:var(--text-main)">Data, co už máš v appce uložená, se tím nijak nezmění</b> — zůstávají v telefonu přesně tak, jak jsou.</p>
      <button id="plGoogle" style="width:100%;display:flex;align-items:center;gap:12px;border:1.5px solid var(--line);background:var(--card-bg);padding:12px 14px;font-size:13.5px;font-weight:700;color:var(--text-main);cursor:pointer;margin-bottom:10px;font-family:inherit">
        <span style="width:20px;height:20px;display:grid;place-items:center;flex:0 0 auto">
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h11.8c-.5 2.7-2.1 5-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.6z"/><path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.7-3.9-12.4-9.1H4.3v5.7C7.9 41.1 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.6 27.9c-.4-1.3-.7-2.6-.7-4s.2-2.7.7-4v-5.7H4.3C2.8 17.1 2 20.4 2 24s.8 6.9 2.3 9.8z"/><path fill="#EA4335" d="M24 10.8c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C34.9 4.2 29.9 2 24 2 15.4 2 7.9 6.9 4.3 14.2l7.3 5.7c1.7-5.2 6.6-9.1 12.4-9.1z"/></svg>
        </span>
        Pokračovat přes Google
        <span style="margin-left:auto;color:var(--muted)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>
        </span>
      </button>
      <button id="plEmail" style="width:100%;display:flex;align-items:center;gap:12px;border:1.5px solid var(--line);background:var(--card-bg);padding:12px 14px;font-size:13.5px;font-weight:700;color:var(--text-main);cursor:pointer;margin-bottom:10px;font-family:inherit">
        <span style="width:20px;height:20px;display:grid;place-items:center;flex:0 0 auto;color:var(--accent)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16"/><path d="M2 6l10 7 10-7"/></svg>
        </span>
        Pokračovat přes e-mail
        <span style="margin-left:auto;color:var(--muted)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>
        </span>
      </button>
      <button id="plCancel" style="width:100%;text-align:center;background:none;border:none;color:var(--muted);font-size:12px;text-decoration:underline;text-underline-offset:3px;padding:10px 0 0;cursor:pointer;font-family:inherit">Zatím nechci, vrátit se zpět</button>
    `);
    overlayEl.querySelector('#plClose').addEventListener('click', close);
    overlayEl.querySelector('#plCancel').addEventListener('click', close);
    overlayEl.querySelector('#plGoogle').addEventListener('click', googleLogin);
    overlayEl.querySelector('#plEmail').addEventListener('click', renderStep1b);
  }

  /* ---------------------------------------------------------
     Google prihlaseni (Krok 9 - skutecne, viz bod 2.2)
     Presmeruje appku pryc na Google a appka se pri navratu cela
     znovu nacte - proto se pred odchodem ulozi "rezim" (nakup/
     prijeti pozvanky), viz MSAuth.setPendingFlow a checkAuthResume
     nize v tomhle souboru.
     --------------------------------------------------------- */
  function googleLogin(){
    sheet(`
      <div style="padding:30px 0 10px">
        <div style="width:44px;height:44px;border:1.5px solid var(--accent);display:grid;place-items:center;color:var(--accent);margin:0 auto 14px">
          <svg class="pl-spin" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/></svg>
        </div>
        <p style="font-size:12.5px;color:var(--muted)">Otevírám přihlášení přes Google…</p>
      </div>
    `);
    injectSpin();
    MSAuth.signInWithGoogle(flowMode, flowMode === 'identity' ? identityExtra : null).then(({error})=>{
      // Sem se kod dostane jen pri CHYBE - uspesna cesta appku rovnou
      // presmeruje na Google, tenhle .then uz nedobehne.
      if(error){ renderAuthError(typeof error === 'string' ? error : (error.message || 'Přihlášení přes Google se nepodařilo spustit.')); }
    });
  }

  /* ---------------------------------------------------------
     STAV: chyba pri spousteni prihlaseni (Google/e-mail se
     nepodarilo spustit - napr. spatne nastaveny Supabase klic,
     vypadek pripojeni...)
     --------------------------------------------------------- */
  function renderAuthError(message){
    clearResendTimer(); clearExpiryTimer(); stopAuthListening();
    sheet(`
      <div style="width:60px;height:60px;border:1.5px solid var(--muted);display:grid;place-items:center;color:var(--muted);margin:14px auto 16px">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>
      </div>
      <h2 style="font-family:var(--font-head);font-size:19px;margin:0 0 8px;color:var(--text-main)">Přihlášení se nepodařilo</h2>
      <div style="border:1.5px solid var(--line);background:var(--card-bg);padding:14px;margin-bottom:18px;text-align:left">
        <p style="margin:0;font-size:12.5px;color:var(--text-main);line-height:1.5">${esc(message)}</p>
      </div>
      <button id="plAuthErrBack" class="btn-primary">Zkusit znovu</button>
      <button id="plAuthErrCancel" style="display:block;width:100%;text-align:center;background:none;border:none;color:var(--muted);font-size:12px;text-decoration:underline;text-underline-offset:3px;padding:16px 0 0;cursor:pointer;font-family:inherit">Zrušit přihlašování</button>
    `);
    overlayEl.querySelector('#plAuthErrBack').addEventListener('click', renderStep1);
    overlayEl.querySelector('#plAuthErrCancel').addEventListener('click', close);
  }

  /* ---------------------------------------------------------
     KROK 1b: zadani e-mailu
     --------------------------------------------------------- */
  function renderStep1b(){
    clearResendTimer(); clearExpiryTimer();
    const lastEmail = msGetLastLoginEmail();
    sheet(`
      <div style="display:flex;align-items:center;margin-bottom:6px;gap:10px">
        <button id="plBack" title="Zpět na výběr metody" style="width:28px;height:28px;border:1.5px solid var(--line);display:grid;place-items:center;color:var(--accent);cursor:pointer;background:transparent;flex:0 0 auto">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <span style="font:700 10px/1 var(--font-mono);color:var(--muted);text-transform:uppercase;letter-spacing:.06em">Krok 2 ze 2 · e-mail</span>
      </div>
      <h2 style="font-family:var(--font-head);font-size:19px;line-height:1.25;margin:0 0 8px;text-align:left;color:var(--text-main)">Přihlas se e-mailem</h2>
      <p style="font-size:13px;line-height:1.55;color:var(--text-main);margin:0 0 18px;text-align:left">Pošleme ti na e-mail jednorázový odkaz k přihlášení.</p>
      <label style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);font-weight:800;margin:0 0 6px;display:block;text-align:left">E-mail</label>
      <input id="plEmailInput" type="email" placeholder="tvuj@email.cz" value="${(lastEmail||'').replace(/"/g,'&quot;')}" style="width:100%;box-sizing:border-box;border:1.5px solid var(--line);background:var(--card-bg);color:var(--text-main);padding:12px 13px;font-size:15px;font-family:inherit;margin-bottom:4px">
      <div id="plEmailErr" style="display:none;gap:8px;align-items:flex-start;color:var(--accent);font-size:12px;line-height:1.5;margin:8px 0 4px;text-align:left">
        <span>Zkontroluj prosím formát e-mailu, tenhle nevypadá platně.</span>
      </div>
      <button id="plSubmitEmail" class="btn-primary" style="margin-top:16px" disabled>Poslat přihlašovací odkaz</button>
    `);
    const input = overlayEl.querySelector('#plEmailInput');
    const err = overlayEl.querySelector('#plEmailErr');
    const submitBtn = overlayEl.querySelector('#plSubmitEmail');

    function isValidEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
    function refresh(){
      const ok = isValidEmail(input.value.trim());
      submitBtn.disabled = !ok;
      return ok;
    }
    input.addEventListener('input', ()=>{
      err.style.display = 'none';
      input.style.borderColor = 'var(--line)';
      refresh();
    });
    refresh();

    overlayEl.querySelector('#plBack').addEventListener('click', renderStep1);
    submitBtn.addEventListener('click', ()=>{
      const email = input.value.trim();
      if(!isValidEmail(email)){
        err.style.display = 'flex';
        input.style.borderColor = 'var(--accent)';
        return;
      }
      msSetLastLoginEmail(email);
      submitBtn.disabled = true;
      submitBtn.textContent = 'Odesílám…';
      MSAuth.sendMagicLink(email, flowMode, flowMode === 'identity' ? identityExtra : null).then(({error})=>{
        if(error){
          submitBtn.disabled = false;
          submitBtn.textContent = 'Poslat přihlašovací odkaz';
          err.querySelector('span').textContent = typeof error === 'string' ? error : (error.message || 'Odkaz se nepodařilo odeslat, zkus to prosím znovu.');
          err.style.display = 'flex';
          return;
        }
        renderStep1c(email);
      });
    });
  }

  /* ---------------------------------------------------------
     KROK 1c: cekani na potvrzeni magic linku
     --------------------------------------------------------- */
  function renderStep1c(email){
    let resendSeconds = 45;
    sheet(`
      <div style="display:flex;align-items:center;margin-bottom:6px;gap:10px">
        <button id="plBackC" title="Zpět, změnit e-mail" style="width:28px;height:28px;border:1.5px solid var(--line);display:grid;place-items:center;color:var(--accent);cursor:pointer;background:transparent;flex:0 0 auto">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <span style="font:700 10px/1 var(--font-mono);color:var(--muted);text-transform:uppercase;letter-spacing:.06em">Krok 2 ze 2 · e-mail</span>
      </div>
      <div style="width:60px;height:60px;border:1.5px solid var(--accent);display:grid;place-items:center;color:var(--accent);margin:14px auto 16px">
        <svg class="pl-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/></svg>
      </div>
      <h2 style="font-family:var(--font-head);font-size:19px;margin:0 0 8px;color:var(--text-main)">Zkontroluj svou schránku</h2>
      <p style="font-size:13px;color:var(--text-main);margin:0 0 4px">Poslali jsme přihlašovací odkaz na</p>
      <p style="font-size:13px;font-weight:700;color:var(--accent);margin:0 0 22px;word-break:break-all">${email}</p>
      <button id="plResend" disabled style="background:none;border:none;font-family:inherit;font-size:12.5px;color:var(--muted);text-decoration:underline;text-underline-offset:3px;cursor:pointer;padding:6px">Poslat znovu (45 s)</button>
      <button id="plCancelC" style="display:block;width:100%;text-align:center;background:none;border:none;color:var(--muted);font-size:12px;text-decoration:underline;text-underline-offset:3px;padding:16px 0 0;cursor:pointer;font-family:inherit">Zrušit přihlašování</button>
      <p style="font-size:10.5px;color:var(--muted);line-height:1.5;margin-top:18px;border-top:1px dashed var(--line);padding-top:10px;text-align:left">Appka na pozadí čeká, dokud odkaz nepotvrdíš. Funguje i když odkaz otevřeš v jiné záložce ve stejném prohlížeči.</p>
    `);
    injectSpin();

    overlayEl.querySelector('#plBackC').addEventListener('click', ()=>{ stopAuthListening(); renderStep1b(); });
    overlayEl.querySelector('#plCancelC').addEventListener('click', ()=>{ stopAuthListening(); close(); });

    // Skutecne cekani na potvrzeni (Krok 9) - viz bod 2.2 specifikace.
    // Spolehlive funguje ve stejnem prohlizeci/zarizeni (i jina zalozka),
    // protoze Supabase session se sdili pres localStorage. Skutecne
    // MEZI-ZARIZENI cekani (odkaz otevreny na jinem telefonu/pocitaci
    // nez appka) vyzaduje samostatnou polling infrastrukturu na serveru -
    // viz bod 2.5 specifikace, zatim NEimplementovano, zapsano jako
    // dalsi prace.
    authListenerUnsub = MSAuth.onAuthChange((event, session)=>{
      if(event === 'SIGNED_IN' && session){
        stopAuthListening();
        const providers = (session.user && session.user.app_metadata && session.user.app_metadata.providers) || [];
        const mergedWithGoogle = /@gmail\.com$/i.test(email) && providers.includes('google');
        renderSuccess({ mergedWithGoogle });
      }
    });

    const resendBtn = overlayEl.querySelector('#plResend');
    function startResendCountdown(){
      resendSeconds = 45;
      resendBtn.disabled = true;
      resendBtn.style.color = 'var(--muted)';
      resendBtn.style.fontWeight = 'normal';
      resendBtn.textContent = `Poslat znovu (${resendSeconds} s)`;
      clearResendTimer();
      resendTimer = setInterval(()=>{
        resendSeconds--;
        if(resendSeconds <= 0){
          resendBtn.disabled = false;
          resendBtn.style.color = 'var(--accent)';
          resendBtn.style.fontWeight = '700';
          resendBtn.textContent = 'Poslat znovu';
          clearResendTimer();
        } else {
          resendBtn.textContent = `Poslat znovu (${resendSeconds} s)`;
        }
      }, 1000);
    }
    resendBtn.addEventListener('click', ()=>{
      if(resendBtn.disabled) return;
      resendBtn.disabled = true;
      resendBtn.textContent = 'Posílám…';
      MSAuth.sendMagicLink(email, flowMode, flowMode === 'identity' ? identityExtra : null).then(()=>{ startResendCountdown(); });
    });
    startResendCountdown();

    clearExpiryTimer();
    expiryTimer = setTimeout(()=>{ stopAuthListening(); renderExpired(); }, 30 * 60 * 1000); // 30 minut, viz bod 2.2
  }

  /* ---------------------------------------------------------
     STAV: odkaz vyprsel (30 minut)
     --------------------------------------------------------- */
  function renderExpired(){
    clearResendTimer(); clearExpiryTimer();
    sheet(`
      <div style="width:60px;height:60px;border:1.5px solid var(--muted);display:grid;place-items:center;color:var(--muted);margin:14px auto 16px">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
      </div>
      <h2 style="font-family:var(--font-head);font-size:19px;margin:0 0 8px;color:var(--text-main)">Odkaz vypršel</h2>
      <div style="border:1.5px solid var(--line);background:var(--card-bg);padding:14px;margin-bottom:18px;text-align:left">
        <p style="margin:0;font-size:12.5px;color:var(--text-main);line-height:1.5">Odkaz vypršel po 30 minutách neaktivity. Nic se neděje — stačí to zkusit znovu.</p>
      </div>
      <button id="plRestart" class="btn-primary">Poslat nový odkaz</button>
      <button id="plCancelExp" style="display:block;width:100%;text-align:center;background:none;border:none;color:var(--muted);font-size:12px;text-decoration:underline;text-underline-offset:3px;padding:16px 0 0;cursor:pointer;font-family:inherit">Zrušit přihlašování</button>
    `);
    overlayEl.querySelector('#plRestart').addEventListener('click', renderStep1b);
    overlayEl.querySelector('#plCancelExp').addEventListener('click', close);
  }

  /* ---------------------------------------------------------
     STAV: uspech
     --------------------------------------------------------- */
  /* ---------------------------------------------------------
     STAV: uspech PRIHLASENI (jeste ne nakup - ten je dalsi krok)
     --------------------------------------------------------- */
  function renderSuccess(opts){
    clearResendTimer(); clearExpiryTimer();
    sheet(`
      <div style="width:60px;height:60px;border:1.5px solid var(--money-pos);display:grid;place-items:center;color:var(--money-pos);margin:14px auto 16px">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
      </div>
      <h2 style="font-family:var(--font-head);font-size:19px;margin:0 0 8px;color:var(--text-main)">Přihlášeno!</h2>
      <p style="font-size:13px;color:var(--muted)">Pokračujeme dál za okamžik…</p>
    `);
    if(opts && opts.mergedWithGoogle){
      showToast('Tenhle e-mail používá stejný účet jako tvé Google přihlášení.');
    }
    if(flowMode === 'identity'){
      // Prijeti pozvanky - zadny nakup, jen predame rizeni zpet volajicimu
      // (ten pak resi stahovani dat, viz specifikace 12.4).
      const cb = onSuccessCb;
      onSuccessCb = null;
      setTimeout(()=>{ close(); if(cb) cb(); }, 1200);
      return;
    }
    // ZMENA 29.7.2026: po prihlaseni uz appka rovnou needeluje Premium -
    // nasleduje krok nakupu (vyber obdobi), viz specifikace 11.2.
    setTimeout(renderPurchasePick, 1400);
  }

  /* ---------------------------------------------------------
     KROK NAKUPU 1: vyber obdobi (mesicne/rocne/natrvalo)
     Premium plati NA KONKRETNI STAVBU, ne na cely ucet - viz
     specifikace 11.1.
     --------------------------------------------------------- */
  function renderPurchasePick(){
    sheet(`
      <div style="display:flex;margin-bottom:4px">
        <button id="pkClose" title="Zavřít" style="width:26px;height:26px;border:1.5px solid var(--line);display:grid;place-items:center;color:var(--muted);margin-left:auto;background:transparent;cursor:pointer">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <h2 style="font-family:var(--font-head);font-size:19px;margin:0 0 6px;color:var(--text-main)">Aktivuješ Premium pro<br><span style="color:var(--accent)">${esc(projectName())}</span></h2>
      <p style="font-size:12.5px;line-height:1.55;color:var(--text-main);margin:0 0 16px;text-align:left">Premium platí jen pro tuhle stavbu — dostane cloudovou zálohu a půjde ji sdílet. Ostatní tvoje stavby zůstávají, jak jsou; Premium jim aktivuješ zvlášť, jen když budeš chtít.</p>
      <div id="planOpts" style="display:flex;flex-direction:column;gap:10px;margin-bottom:18px">
        ${planOptRow('monthly','Měsíčně','69 Kč / měsíc')}
        ${planOptRow('yearly','Ročně','599 Kč / rok (49,90 Kč/měsíc)','Ušetříš 229 Kč')}
        ${planOptRow('lifetime','Natrvalo','1499 Kč jednorázově, žádné další platby')}
      </div>
      <button class="btn-primary" id="pkBuy" style="width:100%">Koupit za ${PLAN_PRICES[chosenPeriod]}</button>
      <p style="font-size:10px;color:var(--muted);line-height:1.5;margin:14px 4px 0;text-align:left">${chosenPeriod==='lifetime' ? 'Jednorázová platba přes Google Play, žádné opakované strhávání.' : 'Platba probíhá přes Google Play. Předplatné jde kdykoli zrušit v nastavení účtu Google.'}</p>
    `);
    overlayEl.querySelector('#pkClose').addEventListener('click', close);
    overlayEl.querySelectorAll('.plan-opt-row').forEach(row=>{
      row.addEventListener('click', ()=>{ chosenPeriod = row.dataset.p; renderPurchasePick(); });
    });
    overlayEl.querySelector('#pkBuy').addEventListener('click', renderPurchaseProcessing);
  }
  function planOptRow(key, title, desc, saveTag){
    const sel = chosenPeriod === key;
    return `
      <div class="plan-opt-row" data-p="${key}" style="border:1.5px solid ${sel?'var(--accent)':'var(--line)'};background:var(--card-bg);padding:13px 14px;text-align:left;cursor:pointer;display:flex;align-items:center;gap:12px;${sel?'box-shadow:2px 2px 0 rgba(29,30,28,.12)':''}">
        <div style="width:18px;height:18px;border-radius:50%;border:1.5px solid ${sel?'var(--accent)':'var(--line)'};flex:0 0 auto;display:grid;place-items:center">${sel?'<div style="width:9px;height:9px;border-radius:50%;background:var(--accent)"></div>':''}</div>
        <div style="flex:1"><b style="display:block;font-size:13.5px;font-family:var(--font-head)">${title}</b><span style="font-size:11px;color:var(--muted)">${desc}</span></div>
        ${saveTag ? `<span style="font-size:9px;font-weight:800;color:var(--money-pos);border:1px solid var(--money-pos);padding:2px 6px;text-transform:uppercase;flex:0 0 auto">${saveTag}</span>` : ''}
      </div>
    `;
  }

  /* ---------------------------------------------------------
     KROK NAKUPU 2: zpracovani (mock)
     --------------------------------------------------------- */
  function renderPurchaseProcessing(){
    sheet(`
      <div style="width:60px;height:60px;border:1.5px solid var(--accent);display:grid;place-items:center;color:var(--accent);margin:14px auto 16px">
        <svg class="pl-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/></svg>
      </div>
      <h2 style="font-family:var(--font-head);font-size:19px;margin:0 0 8px;color:var(--text-main)">Zpracovávám platbu…</h2>
      <p style="font-size:12.5px;color:var(--muted)">(mock) Google Play by teď ukázal vlastní potvrzovací okno.</p>
    `);
    injectSpin();
    setTimeout(renderPurchaseDone, 1000);
  }

  /* ---------------------------------------------------------
     KROK NAKUPU 3: hotovo - tady se Premium OPRAVDU aktivuje,
     pak nasleduje realny postup nahravani do cloudu (bod 4
     specifikace - zadny tichy stav bez cisla).
     --------------------------------------------------------- */
  function renderPurchaseDone(){
    msSetPremiumMock(true);
    msSetPremiumPlanType(chosenPeriod);
    // MOCK simulace obnoveni predplatneho - viz specifikace 17/18: vrati
    // pristup jen lidem, ktere odeprela appka sama kvuli vyprseni, ne tem,
    // co vlastnik odepral rucne (ti zustavaji zamceni, dokud je neodemkne sam).
    msRestoreExpiredSharedPeople();
    // Krok 10a: skutecne zalozeni radku projektu v Supabase (potreba drive,
    // nez appka umi vytvaret realne pozvanky pro tuhle stavbu). Bezi na
    // pozadi, nic neblokuje - kdyby se to nepovedlo, "Sdilet stavbu" to
    // zkusi znovu pri pristim otevreni.
    if(typeof MSCloud !== 'undefined'){
      MSCloud.ensureProject().then(({error})=>{
        if(error){ console.error('ensureProject po nakupu selhalo', error); return; }
        // Krok 11: hned jak ma projekt cloudovy zaznam, posli i prvni
        // "snimek" zakladnich udaju o stavbe - at ho pripadny pozvany
        // clovek uvidi co nejdriv po prijeti pozvanky.
        MSCloud.uploadSnapshot().then(({error:snapErr})=>{ if(snapErr) console.error('uploadSnapshot po nakupu selhalo', snapErr); });
      }).catch(e=> console.error('ensureProject po nakupu selhalo', e));
    }
    sheet(`
      <div style="width:60px;height:60px;border:1.5px solid var(--money-pos);display:grid;place-items:center;color:var(--money-pos);margin:14px auto 16px">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
      </div>
      <h2 style="font-family:var(--font-head);font-size:19px;margin:0 0 8px;color:var(--text-main)">Premium aktivováno!</h2>
      <p style="font-size:13px;color:var(--muted)">Teď appka nahraje ${esc(projectName())} do cloudu…</p>
    `);
    setTimeout(renderCloudUpload, 1200);
  }

  /* ---------------------------------------------------------
     ZALOHOVANI DO CLOUDU - realny postup s cislem, ne tichy
     spinner. Pocty tahne ze skutecnych dat projektu, aby to
     pusobilo autenticky, i kdyz se realne nikam nenahrava.
     --------------------------------------------------------- */
  function renderCloudUpload(){
    const categories = [
      { label:'fotky', count: safeCount(typeof msPhotos==='function' && msPhotos()) },
      { label:'dokumenty', count: safeCount(typeof msDocuments==='function' && msDocuments()) },
      { label:'zápisy do deníku', count: safeCount(typeof msDiary==='function' && msDiary()) },
      { label:'výdaje', count: safeCount(typeof msExpenses==='function' && msExpenses()) },
    ].filter(c=> c.count > 0);

    sheet(`
      <div style="width:60px;height:60px;border:1.5px solid var(--accent);display:grid;place-items:center;color:var(--accent);margin:14px auto 16px">
        <svg class="pl-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/></svg>
      </div>
      <h2 style="font-family:var(--font-head);font-size:19px;margin:0 0 8px;color:var(--text-main)">Zálohuji do cloudu…</h2>
      <p id="cuText" style="font-size:12.5px;color:var(--text-main);margin:0 0 12px;min-height:18px">Připravuji zálohu…</p>
      <div style="height:6px;background:var(--card-bg);border:1px solid var(--line);overflow:hidden;margin-bottom:8px">
        <div id="cuBarFill" style="height:100%;background:var(--accent);width:0%;transition:width .18s"></div>
      </div>
      <p style="font-size:10.5px;color:var(--muted);line-height:1.5">Appka nahrává fotky, dokumenty i zápisy z deníku, aby šly bezpečně sdílet. U větších projektů to chvíli trvá — appka zůstává použitelná, klidně ji přepni na pozadí.</p>
    `);
    injectSpin();

    const cuText = overlayEl.querySelector('#cuText');
    const cuBar = overlayEl.querySelector('#cuBarFill');

    if(!categories.length){
      cuText.textContent = 'Připravuji nastavení projektu…';
      setTimeout(()=>{ cuBar.style.width = '100%'; setTimeout(renderCloudUploadDone, 500); }, 800);
      return;
    }

    let ci = 0;
    function stepCategory(){
      if(ci >= categories.length){
        cuBar.style.width = '100%';
        setTimeout(renderCloudUploadDone, 400);
        return;
      }
      const cat = categories[ci];
      const ticks = Math.min(cat.count, 10);
      let t = 0;
      function tick(){
        t++;
        const shown = Math.max(1, Math.min(cat.count, Math.round(cat.count * t / ticks)));
        cuText.textContent = `Nahrávám ${cat.label} ${shown} z ${cat.count}…`;
        cuBar.style.width = Math.round(((ci + t/ticks) / categories.length) * 100) + '%';
        if(t < ticks){ setTimeout(tick, 160); }
        else { ci++; setTimeout(stepCategory, 200); }
      }
      tick();
    }
    stepCategory();
  }
  function safeCount(arr){ return Array.isArray(arr) ? arr.length : 0; }

  function renderCloudUploadDone(){
    sheet(`
      <div style="width:60px;height:60px;border:1.5px solid var(--money-pos);display:grid;place-items:center;color:var(--money-pos);margin:14px auto 16px">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
      </div>
      <h2 style="font-family:var(--font-head);font-size:19px;margin:0 0 8px;color:var(--text-main)">Záloha hotová</h2>
      <p style="font-size:13px;color:var(--muted)">${esc(projectName())} je v cloudu a připravená ke sdílení.</p>
    `);
    const cb = onSuccessCb;
    onSuccessCb = null;
    setTimeout(()=>{ close(); if(cb) cb(); }, 1400);
  }

  /* ---------------------------------------------------------
     TOAST (kratke ozameni dole, samo zmizi)
     --------------------------------------------------------- */
  function showToast(text){
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:99;background:#1d1e1c;color:#f2efe6;padding:12px 14px;font-size:12.5px;line-height:1.4;display:flex;gap:10px;align-items:flex-start;box-shadow:2px 2px 0 rgba(0,0,0,.2)';
    toast.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c8562f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:0 0 auto;margin-top:1px"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg><span>${text}</span>`;
    document.body.appendChild(toast);
    setTimeout(()=>{ if(toast.parentNode) toast.parentNode.removeChild(toast); }, 3400);
  }

  function clearResendTimer(){ if(resendTimer){ clearInterval(resendTimer); resendTimer = null; } }
  function clearExpiryTimer(){ if(expiryTimer){ clearTimeout(expiryTimer); expiryTimer = null; } }

  function injectSpin(){
    if(document.getElementById('plSpinStyle')) return;
    const st = document.createElement('style');
    st.id = 'plSpinStyle';
    st.textContent = '.pl-spin{animation:plSpin 1.6s linear infinite;transform-origin:center}@keyframes plSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}';
    document.head.appendChild(st);
  }

  /* ---------------------------------------------------------
     OBNOVENI PO NAVRATU Z PRESMEROVANI (Krok 9)
     Google i magic-link presmeruji appku pryc a appka se pri
     navratu cela znovu nacte - proto si pred odchodem appka
     ulozila (MSAuth.setPendingFlow), ve kterem rezimu byla.
     Volano z main.js hned pri startu appky, driv nez cokoli
     jineho vykresli.
     --------------------------------------------------------- */
  async function checkAuthResume(){
    if(typeof MSAuth === 'undefined') return;
    let session = null;
    try{ session = await MSAuth.getSession(); }catch(e){}
    const pending = MSAuth.takePendingFlow(); // { flow, extra } | null
    if(!session || !pending || !pending.flow) return;

    if(pending.flow === 'purchase'){
      if(isOverlayLive()) return;
      flowMode = 'purchase';
      onSuccessCb = null;
      overlayEl = document.createElement('div');
      overlayEl.className = 'ms-overlay';
      overlayEl.style.cssText = 'position:fixed;inset:0;background:rgba(29,30,28,.55);z-index:95;display:flex;align-items:flex-end;justify-content:center';
      document.body.appendChild(overlayEl);
      renderSuccess({ mergedWithGoogle:false });
      return;
    }

    if(pending.flow === 'identity'){
      // Krok 10c: navrat z presmerovani po prijeti pozvanky - appka uz vi,
      // ze prihlaseni uspelo, a ma ulozeny token pozvanky (extra). Appka
      // uz neni na puvodni obrazovce "Byl jsi pozvan" (URL hash se pri
      // presmerovani ztratil), takze pozvanku prijmeme na pozadi a
      // vysledek ukazeme jednoduchym oznamenim.
      const token = pending.extra;
      window.dispatchEvent(new CustomEvent('ms-identity-auth-resumed', { detail: { session, token } }));
      if(!token || typeof MSCloud === 'undefined') return;
      const { error, member } = await MSCloud.redeemInvite(token);
      if(error){
        alert('Pozvánku se nepodařilo přijmout: ' + (typeof error === 'string' ? error : (error.message || 'neznámá chyba')));
        return;
      }
      const localProject = await MSCloud.materializeSharedProject(member);
      if(localProject){
        msSetActiveProjectId(localProject.id);
        Router.go('dashboard');
      }
      alert('Pozvánka přijata! Tvůj přístup je teď aktivní a appka stahuje etapy, finance, deník i fotky na pozadí.');
    }
  }

  return { open, openIdentityOnly, checkAuthResume };
})();
