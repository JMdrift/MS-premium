/* ==========================================================
   LAYOUT
   Vsechno, co je spolecne pro (skoro) kazdou obrazovku, na
   jednom miste: spodni navigace, radialni rychle pridani a
   potvrzovaci dialog (nahrazuje prohlizecovy confirm() - stejny
   vzhled a chovani uplne vsude, misto ruzneho confirm() textu
   kopirovaneho do kazde obrazovky zvlast).
   ========================================================== */
const Layout = (function(){
  const nav = document.getElementById('bottom-nav');

  nav.querySelectorAll('.nav-item[data-route]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if(btn.dataset.locked === '1'){ if(typeof msShowAccessDenied === 'function') msShowAccessDenied(); return; }
      setQaOpen(false);
      Router.go(btn.dataset.route);
    });
  });

  function applyNav(activeTab, show){
    nav.hidden = !show;
    nav.querySelectorAll('.nav-item[data-route]').forEach(btn=>{
      btn.classList.toggle('active', btn.dataset.route === activeTab);
      // Prava (2.8.2026) - "zamek misto mizeni": polozky dolni navigace,
      // do kterych pozvany nema pristup, zustavaji na miste (appka bez
      // nich vypada rozbite/nekompletni), ale jsou ztlumene a kliknuti
      // na ne appka nikam neposle, jen ukaze hlasku (viz vyse). Etapy a
      // Domu zustavaji vzdy plne funkcni.
      const routeToSection = { diary:'denik', project:'projekt' };
      const sec = routeToSection[btn.dataset.route];
      if(sec && typeof msCanViewSection === 'function'){
        const locked = !msCanViewSection(sec);
        btn.dataset.locked = locked ? '1' : '0';
        btn.style.opacity = locked ? '.35' : '';
        let badge = btn.querySelector('.nav-lock-badge');
        if(locked && !badge){
          btn.style.position = 'relative';
          badge = document.createElement('span');
          badge.className = 'nav-lock-badge';
          badge.style.cssText = 'position:absolute;top:-2px;right:6px;width:12px;height:12px;color:var(--muted);display:grid;place-items:center';
          badge.innerHTML = (typeof msLockIconSvg === 'function') ? msLockIconSvg(12) : '';
          btn.appendChild(badge);
        } else if(!locked && badge){
          badge.remove();
        }
      }
    });
  }

  /* ---------- rychle pridani (radialni menu) ---------- */
  const qaBackdrop = document.getElementById('quick-add-backdrop');
  const qaRadial = document.getElementById('quick-add-radial');
  const qaSats = [...qaRadial.querySelectorAll('.qa-sat')];
  const R = 108, ANGLES = [-72,-36,0,36,72];
  qaSats.forEach((el,i)=>{
    const rad = ANGLES[i] * Math.PI/180;
    el.style.setProperty('--tx', (R*Math.sin(rad)) + 'px');
    el.style.setProperty('--ty', (-R*Math.cos(rad)) + 'px');
    el.style.transitionDelay = (i*0.03) + 's';
  });
  let qaOpen = false;
  const QA_TARGET_TO_SECTION = { 'expense-add':'finance', 'diary-add':'denik', 'event-add':'kalendar', 'photo-add':'fotky', 'task-add':'kalendar' };
  function setQaOpen(v){
    qaOpen = v;
    qaBackdrop.hidden = false; qaRadial.hidden = false;
    qaBackdrop.classList.toggle('open', v);
    qaRadial.classList.toggle('open', v);
    if(v){
      // Prava (2.8.2026) - "zamek misto mizeni": satelity bez prava
      // pridavat zustavaji na miste, jen ztlumene s male znackou zamku,
      // klik ukaze hlasku misto aby appka poslala na formular, ktery
      // by stejne pri ulozeni tise selhal.
      qaSats.forEach(el=>{
        const sec = QA_TARGET_TO_SECTION[el.dataset.target];
        const allowed = !sec || typeof msCanAddSection !== 'function' || msCanAddSection(sec);
        el.dataset.locked = allowed ? '0' : '1';
        el.style.opacity = allowed ? '' : '.35';
        let badge = el.querySelector('.qa-lock-badge');
        if(!allowed && !badge){
          // OPRAVA (2.8.2026): drivejsi "el.style.position = 'relative'"
          // tady prepisovalo CSS pravidlo .qa-sat{position:absolute},
          // ktere satelitu drzi jeho misto ve vejiri (pocitane pres
          // --tx/--ty). Jakmile appka jednou nastavila 'relative', satelit
          // vypadl z vejire do normalniho toku obsahu - a protoze se to
          // nikde nevracelo zpet, zustal rozbity i po pozdejsim odemknuti.
          // .qa-sat uz ma position:absolute z CSS, takze zamkova ikonka
          // (sama position:absolute) se srovna spravne bez jakehokoli
          // zasahu do pozice samotneho satelitu.
          //
          // VYLEPSENI (2.8.2026): zamek drive byl jen maly odznak v rohu
          // (spatne citelny, tezko rozpoznatelny symbol). Ted prekryva
          // CELE kolecko tlacitko (.qa-btn) - polozen jako jeho DITE (ne
          // ditě .qa-sat), takze nijak neovlivnuje pozici satelitu ve
          // vejiri. .qa-btn samo o sobe nema position:relative v CSS, ale
          // nastavit ho tady je bezpecne - na rozdil od .qa-sat nedrzi
          // .qa-btn zadnou vlastni absolutni pozici, ktera by se tim dala
          // rozbit.
          const btnEl = el.querySelector('.qa-btn');
          if(btnEl) btnEl.style.position = 'relative';
          badge = document.createElement('span');
          badge.className = 'qa-lock-badge';
          badge.style.cssText = 'position:absolute;inset:0;border-radius:50%;background:rgba(2,4,10,.8);color:#fff;display:grid;place-items:center';
          badge.innerHTML = (typeof msLockIconSvg === 'function') ? msLockIconSvg(22) : '';
          (btnEl || el).appendChild(badge);
        } else if(allowed && badge){
          badge.remove();
        }
      });
    }
    qaSats.forEach(el=>{
      el.style.transform = v
        ? 'translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(1)'
        : 'translate(-50%,-50%) scale(.3)';
    });
  }
  document.getElementById('navAddBtn').addEventListener('click', ()=> setQaOpen(!qaOpen));
  qaBackdrop.addEventListener('click', ()=> setQaOpen(false));
  qaSats.forEach(el=>{
    el.addEventListener('click', ()=>{
      if(el.dataset.locked === '1'){ if(typeof msShowAccessDenied === 'function') msShowAccessDenied(); return; }
      setQaOpen(false);
      Router.go(el.dataset.target);
    });
  });

  /* ---------- potvrzovaci dialog (misto prohlizeoveho confirm()) ---------- */
  const confirmOverlay = document.getElementById('confirm-overlay');
  const confirmMessage = document.getElementById('confirm-message');
  const confirmOkBtn = document.getElementById('confirm-ok-btn');
  const confirmCancelBtn = document.getElementById('confirm-cancel-btn');

  function confirmDialog(message, okLabel, cancelLabel){
    return new Promise(resolve=>{
      confirmMessage.textContent = message;
      confirmOkBtn.textContent = okLabel || 'Potvrdit';
      confirmCancelBtn.textContent = cancelLabel || 'Zrušit';
      confirmOverlay.classList.add('open');
      function cleanup(result){
        confirmOverlay.classList.remove('open');
        confirmOkBtn.removeEventListener('click', onOk);
        confirmCancelBtn.removeEventListener('click', onCancel);
        resolve(result);
      }
      function onOk(){ cleanup(true); }
      function onCancel(){ cleanup(false); }
      confirmOkBtn.addEventListener('click', onOk);
      confirmCancelBtn.addEventListener('click', onCancel);
    });
  }

  function getTheme(){
    // Docasny prepinac pro otestovani noveho nocniho motivu (sketch-dark) -
    // az bude appka hotova pro vydani, tohle se opet uzamkne na 'sketch'.
    let saved = null;
    try{ saved = localStorage.getItem('ms_theme_v1'); }catch(e){}
    return (saved === 'sketch-dark') ? 'sketch-dark' : 'sketch';
  }
  function applyTheme(theme){
    const root = document.documentElement;
    if(theme === 'sketch' || theme === 'sketch-dark'){ root.setAttribute('data-theme', theme); }
    else { root.removeAttribute('data-theme'); }
    localStorage.setItem('ms_theme_v1', theme);
  }

  // Sdilena "sourodá paleta" pro Skica motiv: cerna -> cihlova -> bila
  // podle pozice v rade (idx/total). Puvodne existovala jen na kolotoci
  // etap (screen-stagesWheel.js); ted ji pouziva i seznam etap a mrizka
  // pri zakladani nove etapy, aby vsechny obrazovky s etapami pusobily
  // jako jeden sourody celek a barva se "netrhala" az u fotky v detailu.
  function hexToRgb(hex){ const n=parseInt(hex.replace('#',''),16); return {r:(n>>16)&255,g:(n>>8)&255,b:n&255}; }
  function mixRgb(c1,c2,t){ return `rgb(${Math.round(c1.r+(c2.r-c1.r)*t)},${Math.round(c1.g+(c2.g-c1.g)*t)},${Math.round(c1.b+(c2.b-c1.b)*t)})`; }
  // svetla Skica konci v bile, nocni Skica (zatim skryta, viz app.css)
  // konci v teple jantarove - bila by na tmavem pozadi pusobila cize
  const GRAD_STOPS_LIGHT = ['#1d1e1c', '#a8503c', '#ffffff'].map(hexToRgb);
  const GRAD_STOPS_DARK = ['#1d1a17', '#c8562f', '#e0a05a'].map(hexToRgb);
  function themedGradientColor(idx, total){
    const stops = document.documentElement.dataset.theme === 'sketch-dark' ? GRAD_STOPS_DARK : GRAD_STOPS_LIGHT;
    if(total<=1) return `rgb(${stops[1].r},${stops[1].g},${stops[1].b})`;
    const t = idx/(total-1);
    return t<0.5 ? mixRgb(stops[0], stops[1], t*2) : mixRgb(stops[1], stops[2], (t-0.5)*2);
  }

  return { applyNav, confirmDialog, closeQuickAdd(){ setQaOpen(false); }, getTheme, applyTheme, themedGradientColor };
})();
