/* ==========================================================
   SUPABASE - KLIENT A PRIHLASOVACI POMOCNE FUNKCE (Krok 9)

   Nahrazuje UI mock v screen-premiumLogin.js skutecnym volanim
   Supabase Auth - Google OAuth a e-mail magic link, viz bod 2
   specifikace.

   DULEZITE - PKCE flow: Google i magic-link presmerovani se
   vraceji do appky s "?code=..." v ADRESE (query), NE v #hashi.
   Appka pouziva hash-based routovani (#/obrazovka), takze kdyby
   Supabase pouzival hash pro navratovy kod (starsi "implicit"
   zpusob), rozbilo by se to o Router (viz router.js). Proto je
   dole vyslovne nastaveno flowType:'pkce'.

   CEKANI NA JINEM ZARIZENI (bod 2.5 specifikace - odkaz otevreny
   na jinem telefonu/pocitaci nez appka): tohle zatim NENI reseno.
   To, co appka umi ted: pozna potvrzeni, pokud se odkaz otevre ve
   STEJNEM prohlizeci (i v jine zalozce) - Supabase session se mezi
   zalozkami stejneho prohlizece sdili automaticky pres localStorage.
   Skutecne mezi-zarizeni cekani vyzaduje samostatnou tabulku +
   pravidelne dotazovani serveru - samostatna prace na pozdeji.
   ========================================================== */
const MSAuth = (function(){
  let client = null;

  function get(){
    if(!client){
      if(typeof supabase === 'undefined'){
        console.error('Supabase JS knihovna neni nactena - zkontroluj poradi <script> tagu v index.html');
        return null;
      }
      if(!MS_SUPABASE_ANON_KEY || MS_SUPABASE_ANON_KEY === 'SEM_VLOZ_SVUJ_ANON_KLIC'){
        console.error('Chybi anon klic - dopln MS_SUPABASE_ANON_KEY v supabase-config.js');
        return null;
      }
      client = supabase.createClient(MS_SUPABASE_URL, MS_SUPABASE_ANON_KEY, {
        auth: {
          flowType: 'pkce',
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true
        }
      });
    }
    return client;
  }

  // Adresa, kam se ma appka po prihlaseni vratit - schvalne BEZ #hashe
  // (appkova "trasa"/route se resi zvlast, viz ms_auth_pending_flow nize),
  // aby se v Supabase dala nastavit jedna pevna Redirect URL, ne zavisla
  // na tom, na jake obrazovce appky se zrovna prihlasovani spustilo.
  function redirectUrl(){
    return window.location.origin + window.location.pathname;
  }

  async function getSession(){
    const c = get(); if(!c) return null;
    const { data, error } = await c.auth.getSession();
    if(error){ console.error('MSAuth.getSession', error); return null; }
    return data ? data.session : null;
  }

  // event bude typicky 'SIGNED_IN', 'SIGNED_OUT', 'TOKEN_REFRESHED'...
  // vraci funkci na odhlaseni odberu (zavolej pri zavreni obrazovky)
  function onAuthChange(cb){
    const c = get(); if(!c) return function(){};
    const { data } = c.auth.onAuthStateChange((event, session)=>{ cb(event, session); });
    return function unsubscribe(){ try{ data.subscription.unsubscribe(); }catch(e){} };
  }

  // "Pamatuje si", ze appka po navratu z presmerovani (Google/magic link)
  // ma pokracovat v puvodnim rezimu (nakup Premium / prijeti pozvanky) -
  // appka se totiz pri presmerovani cela znovu nacte a beznou JS promennou
  // (flowMode v screen-premiumLogin.js) by tak ztratila. Cte se v main.js
  // pres PremiumLogin.checkAuthResume() hned pri startu appky. "extra" je
  // volitelny dodatecny kontext (napr. token pozvanky u rezimu 'identity').
  function setPendingFlow(flow, extra){
    try{ localStorage.setItem('ms_auth_pending_flow', JSON.stringify({ flow, extra: extra || null })); }catch(e){}
  }
  function takePendingFlow(){
    try{
      const raw = localStorage.getItem('ms_auth_pending_flow');
      if(!raw) return null;
      localStorage.removeItem('ms_auth_pending_flow');
      const parsed = JSON.parse(raw);
      // zpetna kompatibilita: starsi verze ukladala jen holy retezec
      return (parsed && typeof parsed === 'object') ? parsed : { flow: parsed, extra: null };
    }catch(e){ return null; }
  }

  async function signInWithGoogle(flow, extra){
    const c = get(); if(!c) return { error: 'Supabase neni pripojene (chybi anon klic?)' };
    setPendingFlow(flow, extra);
    const { error } = await c.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl() }
    });
    return { error };
  }

  async function sendMagicLink(email, flow, extra){
    const c = get(); if(!c) return { error: 'Supabase neni pripojene (chybi anon klic?)' };
    setPendingFlow(flow, extra);
    const { error } = await c.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl(),
        shouldCreateUser: true
      }
    });
    return { error };
  }

  async function signOut(){
    const c = get(); if(!c) return;
    try{ await c.auth.signOut(); }catch(e){}
  }

  return { get, getSession, onAuthChange, signInWithGoogle, sendMagicLink, signOut, setPendingFlow, takePendingFlow };
})();
