/* ==========================================================
   ONBOARDING - zalozeni projektu (prvniho i dalsiho).
   Stary staticky uvitaci carousel (slidy + zadost o oznameni) byl
   nahrazen novym interaktivnim pruvodcem primo v appce - viz tour.js
   (TourWelcomeScreen + Tour engine) a screen-appLock.js.
   ========================================================== */


const OnboardingProjectScreen = (function(){
  // Vyber typu stavby (Rodinny dum/Chata/Byt/Rekonstrukce/Komercni objekt/Jine)
  // je docasne schovany - momentalne je vsechno "Rodinny dum". Puvodni seznam
  // necham tu jen jako poznamku, kdyby se vyber v budoucnu zase vratil:
  // const TYPES = ['Rodinný dům','Chata','Byt','Rekonstrukce','Komerční objekt','Jiné'];
  const FIXED_TYPE = 'Rodinný dům';

  function render(container, params){
    const isAdditional = msLoadProjects().length > 0;
    // MOCK/test: normalne se tenhle banner objevi sam, kdyz appce po
    // smazani sdileneho projektu vlastnikem zbyde 0 projektu (viz main.js
    // boot logika) - pro otestovani bez skutecneho druheho zarizeni jde
    // vyvolat i primo pres parametr routy, viz Premium-sdileni-specifikace.md
    // sekce 18.2.
    const removedProjectName = params && params.removedProject;

    function draw(){
      // mode === 'create' - puvodni formular na zalozeni vlastniho projektu
      container.innerHTML = `
        <div style="padding:calc(14px + env(safe-area-inset-top)) 16px 6px">
          ${removedProjectName ? `
            <div style="border:1.5px solid var(--accent);background:var(--card-bg);padding:14px;margin-bottom:16px;text-align:left">
              <p style="margin:0;font-size:12.5px;color:var(--text-main);line-height:1.55"><b>Projekt "${removedProjectName}" byl vlastníkem odstraněn.</b> Můžeš si založit vlastní stavbu níže, nebo počkat, až dostaneš jinou pozvánku.</p>
            </div>
          ` : ''}
          <p style="font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);font-weight:800;margin:0 0 4px">${isAdditional?'Nový projekt':'Poslední krok'}</p>
          <h1 style="margin:0;font-size:21px">${isAdditional?'Založ další projekt':'Založ svůj první projekt'}</h1>
          <p style="margin:8px 0 0;font-size:12px;color:var(--muted);line-height:1.5">${isAdditional?'Vyplň základní údaje o dalším projektu.':'Appka bez projektu neví, co má sledovat. Další projekty pak přidáš kdykoliv v nastavení.'}</p>
        </div>
        <div class="screen-scroll">
          <div class="field-block"><p class="f-label">Název projektu *</p><input class="f-input" id="fName" placeholder="Např. Rodinný dům"/></div>
          <div class="field-block"><p class="f-label">Místo stavby *</p><input class="f-input" id="fLocation" placeholder="Např. Malé Březno u Mostu"/></div>
        </div>
        <div style="padding:12px 16px calc(20px + env(safe-area-inset-bottom))">
          <button class="btn-primary" id="continueBtn" style="background:linear-gradient(90deg,#25e8ff,#b34cff);color:#04070f;border:0">${isAdditional?'Vytvořit projekt':'Vytvořit projekt a spustit appku'}</button>
          ${isAdditional?'<p style="text-align:center;font-size:11px;color:var(--muted);margin-top:8px;text-decoration:underline;cursor:pointer" id="cancelLink">Zrušit a vrátit se do nastavení</p>':''}
        </div>
      `;

      if(isAdditional){
        container.querySelector('#cancelLink').addEventListener('click', ()=> Router.go('settings'));
      }
      container.querySelector('#continueBtn').addEventListener('click', ()=>{
        const name = container.querySelector('#fName').value.trim();
        const location_ = container.querySelector('#fLocation').value.trim();
        if(!name || !location_){
          alert('Vyplň prosím název projektu a místo.');
          return;
        }
        // Typ stavby je docasne uzamceny na "Rodinny dum" (vyber Chata/Byt/
        // Rekonstrukce/apod. je schovany, viz komentar u TYPES vyse) - az se
        // bude vyber zase chtit zapnout, staci vratit typeGrid do HTML sablony.
        msCreateProject({ name, type:FIXED_TYPE, location:location_ });
        // POZOR: drive se tu automaticky nasadila cela predvolena sada etap
        // (MS_TYPE_STAGE_PRESETS['Rodinný dům']) - nova instalace tak vypadala
        // "napulku hotova". Ted novy projekt zacina bez jedine etapy a
        // uzivatel si zaklada jen ty, co doopravdy potrebuje, pres "Nová etapa".
        msSetOnboarded();
        Router.go(isAdditional ? 'dashboard' : 'tour-welcome');
      });
    }

    draw();
    return { showNav:false };
  }
  return { render };
})();
Router.register('onboarding-project', OnboardingProjectScreen);
