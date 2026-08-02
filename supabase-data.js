/* ==========================================================
   MSCloud - realna data pro sdileni (Krok 10a)

   Nahrazuje cast mocku v screen-shareStavba.js (msLoadSharedPeople /
   msSaveSharedPeople) skutecnymi volanimi Supabase - viz tabulky
   projects / project_members / invites a funkce create_invite,
   zalozene v Kroku 3-6 (SQL Editor).

   ZATIM HOTOVO (Krok 10a): vytvoreni pozvanky (create_invite) a
   nacteni seznamu "Pozvani lide" (skutecni clenove + cekajici
   pozvanky) z backendu.

   JESTE NEHOTOVO (Krok 10b - priste): editace prava existujiciho
   cloveka, odepreni/odebrani pristupu, zruseni cekajici pozvanky,
   a skutecne prijeti pozvanky pozvanym (redeem_invite) - viz
   ms-identity-auth-resumed udalost v main.js/screen-premiumLogin.js.
   ========================================================== */
const MSCloud = (function(){

  let lastFileSyncDebug = null;
  // OPRAVA (2.8.2026): pojistka proti zdvojenemu odeslani - kdyz appka
  // zacala neco posilat na pozadi (bez cekani na dokonceni) a mezitim
  // stihlo probehnout pravidelne kolo, ktere hleda "neodeslane" polozky
  // (jeste bez cloudId), mohlo to omylem poslat TU SAMOU polozku
  // podruhe, nez se to prvni odeslani stihlo zapsat. Presne tohle
  // zpusobilo zdvojenou poznamku v "Důležité". Sleduje se podle
  // LOKALNIHO id polozky, ktere je znamo uz pred zahajenim odesilani.
  const _msInFlightPushIds = new Set();

  function getFileSyncDebugInfo(){ return lastFileSyncDebug; }

  function getActiveLocalProject(){
    try{
      const id = msGetActiveProjectId();
      const list = msLoadProjects();
      return list.find(p=> p.id === id) || null;
    }catch(e){ return null; }
  }

  function cloudIdKey(localId){ return 'ms_cloud_project_id_v1__' + localId; }
  function getCachedCloudId(localId){
    try{ return localStorage.getItem(cloudIdKey(localId)) || null; }catch(e){ return null; }
  }
  function setCachedCloudId(localId, cloudId){
    try{ localStorage.setItem(cloudIdKey(localId), cloudId); }catch(e){}
  }

  /* ---------------------------------------------------------
     Zajisti, ze aktivni projekt ma svuj radek v Supabase tabulce
     "projects" (viz bod 11 specifikace - Premium/sdileni je vazane
     na KONKRETNI stavbu, ne na cely ucet). Pokud uz existuje (podle
     ulozeneho cloud ID, nebo podle shody local_id+vlastnik - napr.
     appka znovu nainstalovana), pouzije ho. Jinak zalozi novy.
     Vraci cloud "projects.id" (uuid), nebo null (neni prihlaseny/a,
     nebo zadny aktivni projekt).
     --------------------------------------------------------- */
  async function ensureProject(){
    try{
      const c = MSAuth.get();
      if(!c) return { error: 'Supabase klient se nepodařilo vytvořit (chybí anon klíč?).' };
      const session = await MSAuth.getSession();
      if(!session) return { error: 'Nejsi přihlášen/a (chybí platná Supabase session).' };

      const local = getActiveLocalProject();
      if(!local) return { error: 'Appka nenašla žádný aktivní projekt na telefonu.' };

      const cached = getCachedCloudId(local.id);
      if(cached) return { projectId: cached };

      const { data: existing, error: findErr } = await c
        .from('projects')
        .select('id')
        .eq('local_id', local.id)
        .eq('owner_id', session.user.id)
        .maybeSingle();
      if(findErr){
        console.error('MSCloud.ensureProject select', findErr);
        return { error: 'Vyhledání projektu selhalo: ' + (findErr.message || findErr.code || JSON.stringify(findErr)) };
      }
      if(existing && existing.id){
        setCachedCloudId(local.id, existing.id);
        return { projectId: existing.id };
      }

      const { data: created, error: insErr } = await c
        .from('projects')
        .insert({
          owner_id: session.user.id,
          local_id: local.id,
          name: local.name || 'Stavba',
          location: local.location || null
        })
        .select('id')
        .single();
      if(insErr){
        console.error('MSCloud.ensureProject insert', insErr);
        return { error: 'Založení projektu selhalo: ' + (insErr.message || insErr.code || JSON.stringify(insErr)) };
      }
      setCachedCloudId(local.id, created.id);
      return { projectId: created.id };
    }catch(e){
      // Sitovy vypadek/jina neocekavana chyba - nikdy nenechame vyjimku
      // "uniknout" ven nezachycenou, jinak by volajici tlacitko/seznam
      // zustalo navzdy zaseklé (viz zpetna vazba z testovani na mobilu).
      console.error('MSCloud.ensureProject neocekavana chyba', e);
      return { error: 'Neočekávaná chyba: ' + (e && e.message ? e.message : String(e)) };
    }
  }

  /* Vytvori skutecnou pozvanku pro aktivni projekt - viz funkce
     create_invite (Krok 6). Vraci { invite } nebo { error }. */
  async function createInvite(role, canAdd, sections){
    try{
      const c = MSAuth.get();
      if(!c) return { error: 'Supabase neni pripojene' };
      const { projectId, error: ensureErr } = await ensureProject();
      if(!projectId) return { error: ensureErr || 'Projekt zatím nemá cloudový záznam.' };
      const { data, error } = await c.rpc('create_invite', {
        p_project_id: projectId,
        p_role: role,
        p_can_add: !!canAdd,
        p_sections: sections
      });
      if(error){ console.error('MSCloud.createInvite', error); return { error }; }
      return { invite: data };
    }catch(e){
      console.error('MSCloud.createInvite neocekavana chyba', e);
      return { error: 'Nepodařilo se spojit se serverem: ' + (e && e.message ? e.message : String(e)) };
    }
  }

  /* Nacte spolecny seznam "Pozvani lide" - skutecni clenove
     (project_members) + jeste neprijate pozvanky (invites,
     status='pending') - ve tvaru, jaky obrazovka Sdilet stavbu
     cekala od puvodniho mocku. */
  async function listPeople(){
    try{
      const c = MSAuth.get();
      if(!c) return { error: 'Supabase neni pripojene', people: [] };
      const { projectId, error: ensureErr } = await ensureProject();
      if(!projectId){
        return { error: ensureErr || null, people: [] };
      }

      const [membersRes, invitesRes] = await Promise.all([
        c.from('project_members').select('*').eq('project_id', projectId),
        c.from('invites').select('*').eq('project_id', projectId).eq('status', 'pending')
      ]);
      if(membersRes.error) console.error('MSCloud.listPeople members', membersRes.error);
      if(invitesRes.error) console.error('MSCloud.listPeople invites', invitesRes.error);

      const members = (membersRes.data || []).map(m=>({
        id: 'member:' + m.id,
        name: m.name,
        email: m.email,
        role: m.role,
        status: m.status,
        deniedReason: m.denied_reason,
        canAdd: m.can_add,
        sections: m.sections,
        isPending: false
      }));
      const invites = (invitesRes.data || []).map(iv=>({
        id: 'invite:' + iv.id,
        name: 'Nová pozvánka',
        email: '',
        role: iv.role,
        status: 'pending',
        deniedReason: null,
        canAdd: iv.can_add,
        sections: iv.sections,
        token: iv.token,
        isPending: true
      }));
      return { error: null, people: members.concat(invites) };
    }catch(e){
      console.error('MSCloud.listPeople neocekavana chyba', e);
      return { error: 'Nepodařilo se spojit se serverem: ' + (e && e.message ? e.message : String(e)), people: [] };
    }
  }

  function inviteLink(token){
    return window.location.origin + window.location.pathname + '#/prijmout-pozvanku?token=' + encodeURIComponent(token);
  }

  /* ---------------------------------------------------------
     KROK 10b - detail a editace jednoho konkretniho cloveka
     (obrazovka "Upravit pristup"). ID ma tvar "member:<uuid>"
     nebo "invite:<uuid>" - viz listPeople() vyse.
     --------------------------------------------------------- */
  function parsePersonId(id){
    if(typeof id !== 'string') return null;
    if(id.indexOf('member:') === 0) return { kind:'member', rawId: id.slice(7) };
    if(id.indexOf('invite:') === 0) return { kind:'invite', rawId: id.slice(7) };
    return null;
  }

  // Zjisti VLASTNI prava (sections + can_add) pro sdileny projekt -
  // pouziva se na pozvanem zarizeni k rozhodnuti, co appka ukaze/schova.
  async function fetchMyPermissions(remoteProjectId){
    try{
      const c = MSAuth.get();
      if(!c) return { error: 'Supabase neni pripojene' };
      const session = await MSAuth.getSession();
      const myUserId = (session && session.user && session.user.id) ? session.user.id : null;
      if(!myUserId) return { error: 'Nejsi přihlášen' };
      const { data, error } = await c.from('project_members').select('sections, can_add, status').eq('project_id', remoteProjectId).eq('user_id', myUserId).maybeSingle();
      if(error) return { error };
      if(!data) return { error: null, sections: null, canAdd: false };
      // OPRAVA (bod 3, 2.8.2026): drive "Odepřít přístup" jen nastavilo
      // status='denied' v databazi, ale fetchMyPermissions se na status
      // vubec neptalo - takze se to na pozvanem zarizeni nikdy neprojevilo
      // (porad melo puvodni sections/can_add). Reseni: kdyz je status
      // 'denied', appka vrati prazdna prava - vyuzije uz existujici a
      // overeny zamkovy mechanismus (msCanViewSection/msCanAddSection),
      // stejny jako u jednotlivych sekci (bod 16), misto stavet novy system.
      if(data.status === 'denied') return { error: null, sections: {}, canAdd: false };
      return { error: null, sections: data.sections || null, canAdd: !!data.can_add };
    }catch(e){
      console.error('MSCloud.fetchMyPermissions neocekavana chyba', e);
      return { error: 'Nepodařilo se spojit se serverem. Zkontroluj prosím připojení k internetu.' };
    }
  }

  async function getPerson(id){
    try{
      const c = MSAuth.get();
      if(!c) return { error: 'Supabase neni pripojene' };
      const parsed = parsePersonId(id);
      if(!parsed) return { error: 'Neplatné ID' };

      if(parsed.kind === 'member'){
        const { data, error } = await c.from('project_members').select('*').eq('id', parsed.rawId).maybeSingle();
        if(error) return { error };
        if(!data) return { error: null, person: null };
        return { error: null, kind: 'member', rawId: parsed.rawId, person: {
          id, name: data.name, email: data.email, role: data.role,
          status: data.status, deniedReason: data.denied_reason, canAdd: data.can_add, sections: data.sections
        }};
      } else {
        const { data, error } = await c.from('invites').select('*').eq('id', parsed.rawId).maybeSingle();
        if(error) return { error };
        if(!data || data.status !== 'pending') return { error: null, person: null };
        return { error: null, kind: 'invite', rawId: parsed.rawId, person: {
          id, name: 'Nová pozvánka', email: '', role: data.role,
          status: 'pending', deniedReason: null, canAdd: data.can_add, sections: data.sections, token: data.token
        }};
      }
    }catch(e){
      console.error('MSCloud.getPerson neocekavana chyba', e);
      return { error: 'Nepodařilo se spojit se serverem. Zkontroluj prosím připojení k internetu.' };
    }
  }

  /* patch = objekt se sloupci project_members ke zmene, napr.
     { name, sections, can_add, status, denied_reason } */
  async function updateMember(rawId, patch){
    try{
      const c = MSAuth.get();
      if(!c) return { error: 'Supabase neni pripojene' };
      // OPRAVA (2.8.2026): .update() sama o sobe NEVRATI chybu, kdyz
      // nenajde/nesmi upravit zadny radek (napr. RLS pravidlo ho tise
      // odfiltruje) - appka to drive vyhodnotila jako "uspech", i kdyz
      // se ve skutecnosti nic nezmenilo (presne tohle bylo za "Odepřít
      // přístup" tlacitkem, co vypadalo, ze nic nedela). Pridanim
      // .select() appka pozna, kolik radku se doopravdy upravilo.
      const { data, error } = await c.from('project_members').update(patch).eq('id', rawId).select();
      if(error) return { error };
      if(!data || data.length===0) return { error: 'Změna se neuložila (appka nenašla odpovídající záznam, nebo na to nemáš oprávnění).' };
      return { error: null };
    }catch(e){
      console.error('MSCloud.updateMember neocekavana chyba', e);
      return { error: 'Nepodařilo se spojit se serverem. Zkontroluj prosím připojení k internetu.' };
    }
  }

  /* Nevratne odebrani sdileni - smaze radek v project_members (bod 3.2). */
  async function removeMember(rawId){
    try{
      const c = MSAuth.get();
      if(!c) return { error: 'Supabase neni pripojene' };
      const { error } = await c.from('project_members').delete().eq('id', rawId);
      if(error) return { error };
      return { error: null };
    }catch(e){
      console.error('MSCloud.removeMember neocekavana chyba', e);
      return { error: 'Nepodařilo se spojit se serverem. Zkontroluj prosím připojení k internetu.' };
    }
  }

  /* Zruseni cekajici pozvanky - VZDY update na 'cancelled', nikdy delete
     (viz bod 3.2 specifikace - historie zustava zachovana). */
  async function cancelInvite(rawId){
    try{
      const c = MSAuth.get();
      if(!c) return { error: 'Supabase neni pripojene' };
      const { error } = await c.from('invites').update({ status: 'cancelled' }).eq('id', rawId);
      if(error) return { error };
      return { error: null };
    }catch(e){
      console.error('MSCloud.cancelInvite neocekavana chyba', e);
      return { error: 'Nepodařilo se spojit se serverem. Zkontroluj prosím připojení k internetu.' };
    }
  }

  /* ---------------------------------------------------------
     KROK 10c - nahled a prijeti pozvanky STRANOU POZVANEHO
     (obrazovka "Byl jsi pozvan"). previewInvite funguje i BEZ
     prihlaseni (verejna security-definer funkce v Supabase -
     viz get_invite_preview, doplneno rucne v SQL Editoru) -
     staci znat token z odkazu. redeemInvite uz vyzaduje prihlaseni.
     --------------------------------------------------------- */
  async function previewInvite(token){
    try{
      const c = MSAuth.get();
      if(!c) return { error: 'Supabase neni pripojene' };
      const { data, error } = await c.rpc('get_invite_preview', { p_token: token });
      if(error){ console.error('MSCloud.previewInvite', error); return { error }; }
      const row = Array.isArray(data) ? data[0] : data;
      if(!row) return { error: null, preview: null };
      return { error: null, preview: row };
    }catch(e){
      console.error('MSCloud.previewInvite neocekavana chyba', e);
      return { error: 'Nepodařilo se spojit se serverem. Zkontroluj prosím připojení k internetu.' };
    }
  }

  async function redeemInvite(token){
    try{
      const c = MSAuth.get();
      if(!c) return { error: 'Supabase neni pripojene' };
      const { data, error } = await c.rpc('redeem_invite', { p_token: token });
      if(error){ console.error('MSCloud.redeemInvite', error); return { error }; }
      return { error: null, member: data };
    }catch(e){
      console.error('MSCloud.redeemInvite neocekavana chyba', e);
      return { error: 'Nepodařilo se spojit se serverem. Zkontroluj prosím připojení k internetu.' };
    }
  }

  /* ---------------------------------------------------------
     KROK 11 - "snimek" dat stavby (bod B z domluveneho postupu:
     jednorazovy/prubezny snimek, ne prubezna synchronizace kazde
     jednotlive zmeny). Zatim jen zakladni udaje o projektu (nazev,
     misto...) - obsah (etapy/finance/denik...) pribude v dalsim
     kroku. Ulozeno v samostatne tabulce project_snapshots (viz SQL).
     --------------------------------------------------------- */
  async function uploadSnapshot(){
    try{
      const c = MSAuth.get();
      if(!c) return { error: 'Supabase neni pripojene' };
      const { projectId, error: ensureErr } = await ensureProject();
      if(!projectId) return { error: ensureErr || 'Projekt zatím nemá cloudový záznam.' };
      const local = getActiveLocalProject();
      if(!local) return { error: 'Appka nenašla žádný aktivní projekt na telefonu.' };

      const snapshot = {
        meta: {
          name: local.name || 'Stavba',
          location: local.location || '',
          type: local.type || null,
          started: !!local.started,
          startDate: local.startDate || null,
          finished: !!local.finished,
          finishDate: local.finishDate || null,
          currentStage: local.currentStage || null
        },
        // Krok 12: etapy/finance/denik/kalendar/ukoly/dulezite/nabidky
        // (textova data, bez fotek/dokumentu - viz msCollectSnapshotData)
        data: (typeof msCollectSnapshotData === 'function') ? msCollectSnapshotData() : {}
      };

      const { error } = await c
        .from('project_snapshots')
        .upsert({ project_id: projectId, snapshot, updated_at: new Date().toISOString() });
      if(error){ console.error('MSCloud.uploadSnapshot', error); return { error }; }
      return { error: null };
    }catch(e){
      console.error('MSCloud.uploadSnapshot neocekavana chyba', e);
      return { error: 'Nepodařilo se spojit se serverem. Zkontroluj prosím připojení k internetu.' };
    }
  }

  async function getSnapshot(projectId){
    try{
      const c = MSAuth.get();
      if(!c) return { error: 'Supabase neni pripojene' };
      const { data, error } = await c
        .from('project_snapshots')
        .select('snapshot, updated_at')
        .eq('project_id', projectId)
        .maybeSingle();
      if(error){ console.error('MSCloud.getSnapshot', error); return { error }; }
      return { error: null, snapshot: data ? data.snapshot : null, updatedAt: data ? data.updated_at : null };
    }catch(e){
      console.error('MSCloud.getSnapshot neocekavana chyba', e);
      return { error: 'Nepodařilo se spojit se serverem. Zkontroluj prosím připojení k internetu.' };
    }
  }

  /* Po uspesnem redeemInvite() zkusi zalozit lokalni "zastupny" projekt
     (viz data.js - msCreateSharedProjectLocal) a stahnout do nej alespon
     zakladni udaje (nazev, misto) z posledniho snimku vlastnika. "member"
     je radek project_members, ktery redeemInvite() vraci (ma v sobe
     project_id a role). Nikdy nevyhodi vyjimku - v nejhorsim vrati null
     a appka jen neukaze predvyplneny nazev, coz neni fatalni. */
  async function materializeSharedProject(member){
    try{
      if(!member || !member.project_id) return null;
      if(typeof msCreateSharedProjectLocal !== 'function') return null;
      let name = null, location = null, snapData = null, snapMeta = null;
      try{
        const { snapshot } = await getSnapshot(member.project_id);
        if(snapshot && snapshot.meta){ name = snapshot.meta.name; location = snapshot.meta.location; snapMeta = snapshot.meta; }
        if(snapshot && snapshot.data) snapData = snapshot.data;
      }catch(e){ console.error('materializeSharedProject snapshot', e); }
      const localProject = msCreateSharedProjectLocal({
        remoteProjectId: member.project_id,
        name: name || member.name || 'Sdílená stavba',
        location: location || '',
        role: member.role
      });
      // OPRAVA (2.8.2026): "zahájeno/zkolaudováno" a aktuální etapa se
      // driv aplikovaly az pri prvnim pravidelnem obnoveni (par desitek
      // vterin pozdeji) - kratce po prijeti pozvanky tak appka na
      // chvili spatne ukazovala "nezahájeno", i kdyz vlastnik uz davno
      // zacal. Ted se to nastavi rovnou pri prvnim materializovani.
      if(localProject && snapMeta && typeof msUpdateProject === 'function'){
        msUpdateProject(localProject.id, {
          started: !!snapMeta.started, startDate: snapMeta.startDate || null,
          finished: !!snapMeta.finished, finishDate: snapMeta.finishDate || null,
          currentStage: snapMeta.currentStage || null,
        });
      }
      // Prava (1.8.2026): ulozit lokalne, jake sekce pozvany vidi a jestli
      // muze pridavat - appka podle toho schova/ukaze casti UI. Appka to
      // pak pravidelne obnovuje (viz refreshSharedProject nize), at se
      // zmena prav u vlastnika projevi i u pozvaneho.
      if(localProject){
        try{
          const { sections, canAdd } = await fetchMyPermissions(member.project_id);
          if(typeof msUpdateProject === 'function') msUpdateProject(localProject.id, { mySections: sections, myCanAdd: canAdd });
        }catch(e){ console.error('fetchMyPermissions po prijeti selhalo', e); }
      }
      // OPRAVA (1.8.2026): kdo appku pouziva JEN jako pozvany (nikdy
      // nezalozil vlastni prvni stavbu), by bez tohohle mel navzdy
      // priznak "jeste neprosel uvodnim nastavenim" - appka by pri
      // kazdem cerstvem otevreni poslala na "Zalozit dalsi projekt"
      // misto na jeho sdilenou stavbu, i kdyz uz ji davno ma.
      if(typeof msSetOnboarded === 'function') msSetOnboarded();
      // Vzdy prepsat aktualnimi daty ze snimku - jak pri prvnim prijeti,
      // tak pri opakovanem (viz refreshSharedProject nize) - jedina
      // cesta, jak se ke sdilenemu projektu dostanou noveji pridana
      // data od vlastnika (zadna prubezna synchronizace zatim neni).
      if(localProject && snapData && typeof msHydrateSharedProjectData === 'function'){
        msHydrateSharedProjectData(localProject.id, snapData);
        // Krok 14: hned potom stahnout i samotne fotky/dokumenty (jejich
        // metadata prave dorazila v snapData) - appka to dela hned pri
        // prijeti, at pozvany nemusi jeste sam kliknout na "Aktualizovat".
        syncSharedFiles(localProject.id, member.project_id).catch(e=> console.error('syncSharedFiles po prijeti selhal', e));
      }
      // Obousmerny Denik i Finance (1.8.2026) - stahnout hned pri
      // prijeti, at pozvany nevidi prazdno az do prvniho cyklu.
      if(localProject){
        try{
          const { rows } = await fetchAllDiaryEntries(member.project_id);
          const namedRows = await attachDisplayNames(member.project_id, rows);
          if(typeof msMergeCloudDiaryEntries === 'function') msMergeCloudDiaryEntries(localProject.id, namedRows);
        }catch(e){ console.error('denik po prijeti selhal', e); }
        try{
          const { rows: expenseRows } = await fetchAllExpenses(member.project_id);
          const namedExpenseRows = await attachDisplayNames(member.project_id, expenseRows);
          if(typeof msMergeCloudExpenses === 'function') msMergeCloudExpenses(localProject.id, namedExpenseRows);
        }catch(e){ console.error('finance po prijeti selhaly', e); }
        try{
          const { rows: photoRows } = await fetchAllPhotosMeta(member.project_id);
          const namedPhotoRows = await attachDisplayNames(member.project_id, photoRows);
          const { newEntries: newPhotoEntries } = (typeof msMergeCloudPhotosMeta === 'function') ? msMergeCloudPhotosMeta(localProject.id, namedPhotoRows) : { newEntries: [] };
          if(newPhotoEntries.length) await downloadNewPhotoContents(localProject.id, member.project_id, newPhotoEntries);
        }catch(e){ console.error('fotky po prijeti selhaly', e); }
        try{
          const { rows: folderRows } = await fetchAllProjectFolders(member.project_id);
          if(typeof msMergeCloudProjectFolders === 'function') msMergeCloudProjectFolders(localProject.id, folderRows);
          const { rows: itemRows } = await fetchAllProjectItems(member.project_id);
          const namedItemRows = await attachDisplayNames(member.project_id, itemRows);
          const { newEntries: newItemEntries } = (typeof msMergeCloudProjectItems === 'function') ? msMergeCloudProjectItems(localProject.id, namedItemRows) : { newEntries: [] };
          if(newItemEntries.length) await downloadNewProjectItemContents(localProject.id, member.project_id, newItemEntries);
        }catch(e){ console.error('slozky Projekt po prijeti selhaly', e); }
        try{
          const { rows: eventRows } = await fetchAllEvents(member.project_id);
          const namedEventRows = await attachDisplayNames(member.project_id, eventRows);
          if(typeof msMergeCloudEvents === 'function') msMergeCloudEvents(localProject.id, namedEventRows);
          const { rows: taskRows } = await fetchAllTasks(member.project_id);
          const namedTaskRows = await attachDisplayNames(member.project_id, taskRows);
          if(typeof msMergeCloudTasks === 'function') msMergeCloudTasks(localProject.id, namedTaskRows);
        }catch(e){ console.error('kalendar/ukoly po prijeti selhaly', e); }
        try{
          const { rows: stageDocRows } = await fetchAllStageDocuments(member.project_id);
          const namedStageDocRows = await attachDisplayNames(member.project_id, stageDocRows);
          const { newEntries: newStageDocEntries } = (typeof msMergeCloudStageDocuments === 'function') ? msMergeCloudStageDocuments(localProject.id, namedStageDocRows) : { newEntries: [] };
          if(newStageDocEntries.length) await downloadNewStageDocumentContents(localProject.id, member.project_id, newStageDocEntries);
        }catch(e){ console.error('dokumenty etap po prijeti selhaly', e); }
      }
      return localProject;
    }catch(e){
      console.error('materializeSharedProject neocekavana chyba', e);
      return null;
    }
  }

  /* Rucni "Aktualizovat data" pro uz drive prijaty sdileny projekt -
     znovu stahne posledni snimek a prepise jim lokalni data. Nevyzaduje
     redeem_invite znovu (clenstvi uz existuje), jen novy getSnapshot(). */
  async function refreshSharedProject(localProjectId, remoteProjectId){
    try{
      const { snapshot, error } = await getSnapshot(remoteProjectId);
      if(error) return { error };
      if(snapshot && snapshot.meta){
        if(typeof msUpdateProject === 'function'){
          // OPRAVA (2.8.2026): snimek uz "started"/"startDate"/"finished"/
          // "finishDate"/"currentStage" obsahoval (viz uploadSnapshot), ale
          // appka pri stazeni cetla jen jmeno/lokaci - "Den stavby" na
          // pozvanem zarizeni proto nikdy nezacal pocitat, i kdyz vlastnik
          // stavbu uz davno zahajil.
          msUpdateProject(localProjectId, {
            name: snapshot.meta.name, location: snapshot.meta.location,
            started: !!snapshot.meta.started, startDate: snapshot.meta.startDate || null,
            finished: !!snapshot.meta.finished, finishDate: snapshot.meta.finishDate || null,
            currentStage: snapshot.meta.currentStage || null,
          });
        }
      }
      if(snapshot && snapshot.data && typeof msHydrateSharedProjectData === 'function'){
        msHydrateSharedProjectData(localProjectId, snapshot.data);
      }
      // Prava (1.8.2026) - obnovit pri kazdem kole, at zmena prav u
      // vlastnika dorazi k pozvanemu bez nutnosti znovu prijimat pozvanku.
      try{
        const { sections, canAdd } = await fetchMyPermissions(remoteProjectId);
        if(typeof msUpdateProject === 'function') msUpdateProject(localProjectId, { mySections: sections, myCanAdd: canAdd });
      }catch(e){ console.error('fetchMyPermissions pri refreshSharedProject selhalo', e); }
      // Obousmerny Denik i Finance - sloucit (ne prepsat). DULEZITE:
      // slouceni (ktere ted umi i mazat) se vola jen kdyz fetch OPRAVDU
      // uspel (error===null) - jinak by prazdny vysledek kvuli vypadku
      // site appka omylem vylozila jako "vsechno bylo smazano" a
      // smazala by to i lokalne. Viz stejna pojistka v pollDiaryBothWays.
      try{
        const { rows, error: diaryErr } = await fetchAllDiaryEntries(remoteProjectId);
        if(!diaryErr){
          const namedRows = await attachDisplayNames(remoteProjectId, rows||[]);
          if(typeof msMergeCloudDiaryEntries === 'function') msMergeCloudDiaryEntries(localProjectId, namedRows);
        }
      }catch(e){ console.error('denik pri refreshSharedProject selhal', e); }
      try{
        const { rows: expenseRows, error: expenseErr } = await fetchAllExpenses(remoteProjectId);
        if(!expenseErr){
          const namedExpenseRows = await attachDisplayNames(remoteProjectId, expenseRows||[]);
          if(typeof msMergeCloudExpenses === 'function') msMergeCloudExpenses(localProjectId, namedExpenseRows);
        }
      }catch(e){ console.error('finance pri refreshSharedProject selhaly', e); }
      try{
        const { rows: photoRows, error: photoErr } = await fetchAllPhotosMeta(remoteProjectId);
        if(!photoErr){
          const namedPhotoRows = await attachDisplayNames(remoteProjectId, photoRows||[]);
          const { newEntries: newPhotoEntries } = (typeof msMergeCloudPhotosMeta === 'function') ? msMergeCloudPhotosMeta(localProjectId, namedPhotoRows) : { newEntries: [] };
          if(newPhotoEntries.length) await downloadNewPhotoContents(localProjectId, remoteProjectId, newPhotoEntries);
        }
      }catch(e){ console.error('fotky pri refreshSharedProject selhaly', e); }
      try{
        const { rows: folderRows, error: folderErr } = await fetchAllProjectFolders(remoteProjectId);
        if(!folderErr && typeof msMergeCloudProjectFolders === 'function') msMergeCloudProjectFolders(localProjectId, folderRows||[]);
        const { rows: itemRows, error: itemErr } = await fetchAllProjectItems(remoteProjectId);
        if(!itemErr){
          const namedItemRows = await attachDisplayNames(remoteProjectId, itemRows||[]);
          const { newEntries: newItemEntries } = (typeof msMergeCloudProjectItems === 'function') ? msMergeCloudProjectItems(localProjectId, namedItemRows) : { newEntries: [] };
          if(newItemEntries.length) await downloadNewProjectItemContents(localProjectId, remoteProjectId, newItemEntries);
        }
      }catch(e){ console.error('slozky Projekt pri refreshSharedProject selhaly', e); }
      try{
        const { rows: eventRows, error: eventErr } = await fetchAllEvents(remoteProjectId);
        if(!eventErr){
          const namedEventRows = await attachDisplayNames(remoteProjectId, eventRows||[]);
          if(typeof msMergeCloudEvents === 'function') msMergeCloudEvents(localProjectId, namedEventRows);
        }
        const { rows: taskRows, error: taskErr } = await fetchAllTasks(remoteProjectId);
        if(!taskErr){
          const namedTaskRows = await attachDisplayNames(remoteProjectId, taskRows||[]);
          if(typeof msMergeCloudTasks === 'function') msMergeCloudTasks(localProjectId, namedTaskRows);
        }
      }catch(e){ console.error('kalendar/ukoly pri refreshSharedProject selhaly', e); }
      try{
        const { rows: stageDocRows, error: stageDocErr } = await fetchAllStageDocuments(remoteProjectId);
        if(!stageDocErr){
          const namedStageDocRows = await attachDisplayNames(remoteProjectId, stageDocRows||[]);
          const { newEntries: newStageDocEntries } = (typeof msMergeCloudStageDocuments === 'function') ? msMergeCloudStageDocuments(localProjectId, namedStageDocRows) : { newEntries: [] };
          if(newStageDocEntries.length) await downloadNewStageDocumentContents(localProjectId, remoteProjectId, newStageDocEntries);
        }
      }catch(e){ console.error('dokumenty etap pri refreshSharedProject selhaly', e); }
      const fileResult = await syncSharedFiles(localProjectId, remoteProjectId);
      return { error: null, files: fileResult };
    }catch(e){
      console.error('refreshSharedProject neocekavana chyba', e);
      return { error: 'Nepodařilo se spojit se serverem. Zkontroluj prosím připojení k internetu.' };
    }
  }

  /* ---------------------------------------------------------
     KROK 13 - automaticka (ticha) synchronizace SOUBORU (fotky,
     dokumenty, uctenky) do Supabase Storage. Bezi vzdy na pozadi
     hned po lokalnim ulozeni - NEBLOKUJE UI a NEPRERUSUJE appku,
     kdyz se to nepovede (vypadek site na stavbe je bezny stav -
     appka ma dal fungovat lokalne, jen se to nenahraje).
     --------------------------------------------------------- */
  function dataUrlToBlob(dataUrl){
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const bin = atob(parts[1]);
    const arr = new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  // kind: 'photos' | 'documents' | 'receipts'. Cesta v Storage:
  // {cloud_project_id}/{kind}/{id} - podle stejneho cloud_project_id
  // se pak pozna, kam soubor patri (RLS politiky na storage.objects
  // ctou prvni cast cesty - viz SQL).
  async function uploadFile(kind, id, dataUrl){
    try{
      if(!dataUrl) return { error: null };
      const c = MSAuth.get();
      if(!c) return { error: null };
      // OPRAVA (1.8.2026): puvodne tady bylo vzdy ensureProject(), coz je
      // SPRAVNE jen pro vlastni projekt - kdyby fotku pridal POZVANY (s
      // pravem pridavat), zalozilo by to omylem uplne jiny, spatny
      // cloudovy zaznam vlastneny pozvanym. Stejna past, jakou uz resi
      // resolveCloudProjectIdForWrite() u Deniku/Financi.
      const projectId = await resolveCloudProjectIdForWrite();
      if(!projectId) return { error: null }; // bez Premium pro tenhle projekt se tise neuklada
      const blob = dataUrlToBlob(dataUrl);
      const path = `${projectId}/${kind}/${id}`;
      const { error } = await c.storage.from('project-files').upload(path, blob, { upsert: true, contentType: blob.type });
      if(error) console.error('MSCloud.uploadFile', kind, id, error);
      return { error: error || null };
    }catch(e){
      console.error('MSCloud.uploadFile neocekavana chyba', kind, id, e);
      return { error: null }; // ticha chyba - offline na stavbe je bezny stav
    }
  }

  async function deleteFile(kind, id){
    try{
      const c = MSAuth.get();
      if(!c) return { error: null };
      const projectId = await resolveCloudProjectIdForWrite();
      if(!projectId) return { error: null };
      const path = `${projectId}/${kind}/${id}`;
      const { error } = await c.storage.from('project-files').remove([path]);
      if(error) console.error('MSCloud.deleteFile', kind, id, error);
      return { error: error || null };
    }catch(e){
      console.error('MSCloud.deleteFile neocekavana chyba', kind, id, e);
      return { error: null };
    }
  }

  /* ---------------------------------------------------------
     KROK 14 - stazeni souboru NA STRANE POZVANEHO. Na rozdil od
     nahravani (Krok 13, tise na pozadi, appka o nem nic nerika),
     stazeni pro sdileny projekt vola appka VYSLOVNE (pri prijeti
     pozvanky a pri "Aktualizovat") a rovnou ulozi do IndexedDB pod
     spravny lokalni projekt (rucne sestavenym klicem, protoze
     msBlobKey() vzdy pracuje jen s AKTIVNIM projektem, coz nemusi
     byt ten, pro ktery prave stahujeme).
     --------------------------------------------------------- */
  async function downloadFile(kind, id, remoteProjectId){
    try{
      const c = MSAuth.get();
      if(!c) return { error: 'Supabase neni pripojene' };
      const path = `${remoteProjectId}/${kind}/${id}`;
      const { data, error } = await c.storage.from('project-files').download(path);
      if(error) return { error };
      const dataUrl = await new Promise((resolve, reject)=>{
        const reader = new FileReader();
        reader.onload = ()=> resolve(reader.result);
        reader.onerror = ()=> reject(new Error('cteni souboru selhalo'));
        reader.readAsDataURL(data);
      });
      return { error: null, dataUrl };
    }catch(e){
      console.error('MSCloud.downloadFile neocekavana chyba', kind, id, e);
      return { error: 'Nepodařilo se stáhnout soubor.' };
    }
  }

  // Stahne VSECHNY fotky a dokumenty, jejichz METADATA uz jsou stazena
  // (viz msHydrateSharedProjectData) pro dany lokalni projekt, a jejich
  // obrazek/soubor ulozi do IndexedDB + pametove keše pod spravnym klicem.
  // Bezi postupne (ne najednou) - bezpecnejsi na slabsim/nestabilnim
  // pripojeni na stavbe nez hromadne soubezne stahovani.
  async function syncSharedFiles(localProjectId, remoteProjectId){
    try{
      let photos = [], docs = [], expenses = [], folderTree = [];
      try{ photos = JSON.parse(localStorage.getItem('ms_photos_v1__' + localProjectId) || '[]'); }catch(e){}
      try{ docs = JSON.parse(localStorage.getItem('ms_documents_v1__' + localProjectId) || '[]'); }catch(e){}
      try{ expenses = JSON.parse(localStorage.getItem('ms_expenses_v1__' + localProjectId) || '[]'); }catch(e){}
      try{ folderTree = JSON.parse(localStorage.getItem('ms_folder_tree_v1__' + localProjectId) || '[]'); }catch(e){}
      const receipts = expenses.filter(t=> t.hasReceipt);

      // Obecne slozky "Projekt" jsou vnorene (slozky ve slozkach) - potreba
      // projit cely strom, ne jen jednu uroven, at se zadny soubor nevynecha.
      function collectFolderFileIds(nodes){
        let ids = [];
        (nodes||[]).forEach(n=>{
          if(n.type==='file' && n.id) ids.push(n.id);
          else if(n.type==='folder' && n.children) ids = ids.concat(collectFolderFileIds(n.children));
        });
        return ids;
      }
      const folderFileIds = collectFolderFileIds(folderTree);

      // OPRAVA: drive appka pri kazdem automatickem dotazu (kazdych ~45s)
      // ZNOVU stahovala UPLNE VSECHNY soubory, i ty, co uz davno ma - na
      // mobilnich datech na stavbe zbytecne drahe a pomale. Ted nejdriv
      // zkontroluje, jestli uz soubor lokalne nema (v pametove kesi nebo
      // v IndexedDB), a stahuje jen to, co opravdu chybi.
      async function alreadyHave(key){
        if(MS_BLOB_CACHE.has(key)) return true;
        try{
          const existing = await msIdbGet(key);
          if(existing){ MS_BLOB_CACHE.set(key, existing); return true; }
        }catch(e){}
        return false;
      }

      let ok = 0, fail = 0, skipped = 0;
      const failDetails = [];
      for(const p of photos){
        const key = 'photo_' + p.id + '__' + localProjectId;
        if(await alreadyHave(key)){ skipped++; continue; }
        const { error, dataUrl } = await downloadFile('photos', p.id, remoteProjectId);
        if(error || !dataUrl){ fail++; failDetails.push({ kind:'photos', id:p.id, error: (error && (error.message||JSON.stringify(error))) || 'prázdný výsledek' }); continue; }
        MS_BLOB_CACHE.set(key, dataUrl);
        const saved = await msIdbSet(key, dataUrl);
        // OPRAVA (1.8.2026): pokud zapis do IndexedDB selze/zamrzne (znamy
        // problem hlavne na iPhonu), NEPOCITAT to jako hotovo - jinak by
        // se to priste povazovalo za "uz mam" (viz alreadyHave nahore) a
        // nikdy by se to znovu nezkusilo, i kdyz soubor po restartu appky
        // fakticky chybi.
        if(saved) ok++; else fail++;
      }
      for(const d of docs){
        const key = 'doc_' + d.id + '__' + localProjectId;
        if(await alreadyHave(key)){ skipped++; continue; }
        const { error, dataUrl } = await downloadFile('documents', d.id, remoteProjectId);
        if(error || !dataUrl){ fail++; failDetails.push({ kind:'documents', id:d.id, error: (error && (error.message||JSON.stringify(error))) || 'prázdný výsledek' }); continue; }
        MS_BLOB_CACHE.set(key, dataUrl);
        const saved = await msIdbSet(key, dataUrl);
        // OPRAVA (1.8.2026): pokud zapis do IndexedDB selze/zamrzne (znamy
        // problem hlavne na iPhonu), NEPOCITAT to jako hotovo - jinak by
        // se to priste povazovalo za "uz mam" (viz alreadyHave nahore) a
        // nikdy by se to znovu nezkusilo, i kdyz soubor po restartu appky
        // fakticky chybi.
        if(saved) ok++; else fail++;
      }
      for(const t of receipts){
        const key = 'receipt_' + t.id + '__' + localProjectId;
        if(await alreadyHave(key)){ skipped++; continue; }
        const { error, dataUrl } = await downloadFile('receipts', t.id, remoteProjectId);
        if(error || !dataUrl){ fail++; failDetails.push({ kind:'receipts', id:t.id, error: (error && (error.message||JSON.stringify(error))) || 'prázdný výsledek' }); continue; }
        MS_BLOB_CACHE.set(key, dataUrl);
        const saved = await msIdbSet(key, dataUrl);
        // OPRAVA (1.8.2026): pokud zapis do IndexedDB selze/zamrzne (znamy
        // problem hlavne na iPhonu), NEPOCITAT to jako hotovo - jinak by
        // se to priste povazovalo za "uz mam" (viz alreadyHave nahore) a
        // nikdy by se to znovu nezkusilo, i kdyz soubor po restartu appky
        // fakticky chybi.
        if(saved) ok++; else fail++;
      }
      for(const id of folderFileIds){
        const key = 'file_' + id + '__' + localProjectId;
        if(await alreadyHave(key)){ skipped++; continue; }
        const { error, dataUrl } = await downloadFile('folderfiles', id, remoteProjectId);
        if(error || !dataUrl){ fail++; failDetails.push({ kind:'folderfiles', id, error: (error && (error.message||JSON.stringify(error))) || 'prázdný výsledek' }); continue; }
        MS_BLOB_CACHE.set(key, dataUrl);
        const saved = await msIdbSet(key, dataUrl);
        // OPRAVA (1.8.2026): pokud zapis do IndexedDB selze/zamrzne (znamy
        // problem hlavne na iPhonu), NEPOCITAT to jako hotovo - jinak by
        // se to priste povazovalo za "uz mam" (viz alreadyHave nahore) a
        // nikdy by se to znovu nezkusilo, i kdyz soubor po restartu appky
        // fakticky chybi.
        if(saved) ok++; else fail++;
      }
      // Ulozi posledni vysledek pro viditelnou diagnostiku v Nastaveni
      // (Martin testuje z telefonu, bez pristupu ke konzoli prohlizece).
      lastFileSyncDebug = { at: new Date().toISOString(), remoteProjectId, ok, fail, skipped, failDetails };
      return { error: null, ok, fail, skipped, total: photos.length + docs.length + receipts.length + folderFileIds.length };
    }catch(e){
      console.error('syncSharedFiles neocekavana chyba', e);
      lastFileSyncDebug = { at: new Date().toISOString(), remoteProjectId, error: String((e&&e.message)||e) };
      return { error: 'Nepodařilo se stáhnout soubory.' };
    }
  }

  /* ---------------------------------------------------------
     TICHA AUTOMATICKA OBNOVA - misto tlacitka "Aktualizovat".
     Zavola presne tu samou, jiz overenou funkci (refreshSharedProject),
     jen sama na pozadi, bez tlacitka.
     --------------------------------------------------------- */
  async function autoRefreshAllShared(){
    try{
      if(typeof msLoadProjects !== 'function') return false;
      const shared = msLoadProjects().filter(p=> p.isShared && p.remoteProjectId);
      if(!shared.length) return false; // nic sdileneho - klidne uplne preskocit
      for(const p of shared){
        try{
          await refreshSharedProject(p.id, p.remoteProjectId);
        }catch(e){ console.error('autoRefreshAllShared jednotlivy projekt selhal', p.id, e); }
      }
      return true;
    }catch(e){
      console.error('autoRefreshAllShared neocekavana chyba', e);
      return false;
    }
  }

  // Jednorazove ZPETNE odeslani VSECH existujicich fotek/dokumentu/
  // uctenek do cloudu - resi prakticky problem: kdyz nekdo stavi mesice
  // ve FREE rezimu a teprve pak aktivuje Premium a zacne sdilet, chce
  // aby pozvany videl i historii, ne jen veci pridane od aktivace dal.
  // Bezne prubezne nahravani (uploadFile v data.js) resi jen NOVE
  // pridane veci - tohle jednorazove dozene zbytek.
  async function backfillAllFiles(){
    try{
      const c = MSAuth.get();
      if(!c) return { error: null };
      const { projectId } = await ensureProject();
      if(!projectId) return { error: null };

      let ok = 0, fail = 0;

      const photos = (typeof msPhotos === 'function') ? msPhotos() : [];
      for(const p of photos){
        let thumb = p.thumb;
        if(!thumb && typeof msIdbGet === 'function' && typeof msBlobKey === 'function'){
          try{ thumb = await msIdbGet(msBlobKey('photo', p.id)); }catch(e){}
        }
        if(!thumb) continue;
        const { error } = await uploadFile('photos', p.id, thumb);
        if(error) fail++; else ok++;
      }

      const docs = (typeof msDocuments === 'function') ? msDocuments() : [];
      for(const d of docs){
        let content = d.content;
        if(!content && typeof msIdbGet === 'function' && typeof msBlobKey === 'function'){
          try{ content = await msIdbGet(msBlobKey('doc', d.id)); }catch(e){}
        }
        if(!content) continue;
        const { error } = await uploadFile('documents', d.id, content);
        if(error) fail++; else ok++;
      }

      const expenses = (typeof msExpenses === 'function') ? msExpenses() : [];
      for(const t of expenses.filter(t=>t.hasReceipt)){
        let content = null;
        try{ if(typeof msIdbGet === 'function' && typeof msBlobKey === 'function') content = await msIdbGet(msBlobKey('receipt', t.id)); }catch(e){}
        if(!content) continue;
        const { error } = await uploadFile('receipts', t.id, content);
        if(error) fail++; else ok++;
      }

      // "Projekt" slozky - nova plocha struktura (uz ne strom podle jmen).
      const projectItems = (typeof msLoadProjectItems === 'function') ? msLoadProjectItems() : [];
      for(const it of projectItems){
        let content = null;
        try{ if(typeof msIdbGet === 'function' && typeof msBlobKey === 'function') content = await msIdbGet(msBlobKey('pitem', it.id)); }catch(e){}
        if(!content) continue;
        const { error } = await uploadFile('projectitems', it.id, content);
        if(error) fail++; else ok++;
      }

      return { error: null, ok, fail };
    }catch(e){
      console.error('backfillAllFiles neocekavana chyba', e);
      return { error: 'Zpětné odeslání souborů selhalo.' };
    }
  }

  /* ---------------------------------------------------------
     OBOUSMERNE SDILENI DENIKU (1.8.2026) - stejny princip jako
     jednosmerny snimek (appka se sama, tise, pravidelne pta serveru),
     ale pres GRANULARNI tabulku (project_diary_entries, jeden radek =
     jeden zapis) - tak aby vlastnik i pozvany mohli PSAT nezavisle na
     sobe, bez rizika, ze si navzajem prepisi cely blok dat. Zadne
     WebSockety/Realtime (to se drive ukazalo nespolehlive) - jen
     obcasne normalni dotazy, presne jako u jednosmerneho snimku.
     --------------------------------------------------------- */

  // Cloud ID pro PUSH (zapis) - vlastni projekt pres ensureProject(),
  // sdileny projekt primo pres remoteProjectId (NIKDY ensureProject()
  // pro sdileny projekt - zalozilo by to omylem jiny/spatny zaznam).
  async function resolveCloudProjectIdForWrite(){
    const local = getActiveLocalProject();
    if(local && local.isShared && local.remoteProjectId) return local.remoteProjectId;
    const { projectId } = await ensureProject();
    return projectId;
  }

  async function pushDiaryEntry(entry){
    try{
      const c = MSAuth.get();
      if(!c) return { error: null };
      const projectId = await resolveCloudProjectIdForWrite();
      if(!projectId) return { error: null }; // FREE projekt - tise se nic neodesila
      let myLabel = null;
      try{
        const session = await MSAuth.getSession();
        myLabel = (session && session.user && session.user.email) ? session.user.email : null;
      }catch(e){}
      const { data, error } = await c.from('project_diary_entries').insert({
        project_id: projectId, local_id: entry.id, added_by_label: myLabel,
        date: entry.date, time: entry.time || null, author: entry.author || null,
        stage: entry.stage || null, content: entry.text || null,
        worker: entry.worker || null, material: entry.material || null,
        issue: entry.issue || null, important: !!entry.important,
        photos: entry.photos || null, items: entry.items || null,
      }).select().single();
      if(error) console.error('MSCloud.pushDiaryEntry', error);
      return { error: error || null, row: data || null };
    }catch(e){
      console.error('MSCloud.pushDiaryEntry neocekavana chyba', e);
      return { error: null };
    }
  }

  async function fetchAllDiaryEntries(remoteProjectId){
    try{
      const c = MSAuth.get();
      if(!c) return { error: 'Supabase neni pripojene', rows: [] };
      const { data, error } = await c.from('project_diary_entries').select('*').eq('project_id', remoteProjectId);
      if(error){ console.error('MSCloud.fetchAllDiaryEntries', error); return { error, rows: [] }; }
      return { error: null, rows: data || [] };
    }catch(e){
      console.error('MSCloud.fetchAllDiaryEntries neocekavana chyba', e);
      return { error: 'Nepodařilo se stáhnout deník.', rows: [] };
    }
  }

  async function resolveDisplayName(cloudProjectId, userId, fallbackLabel){
    try{
      if(!userId) return fallbackLabel || 'Sdíleno';
      const c = MSAuth.get();
      if(!c) return fallbackLabel || 'Sdíleno';
      const { data, error } = await c.from('project_members').select('name').eq('project_id', cloudProjectId).eq('user_id', userId).maybeSingle();
      if(error || !data || !data.name) return fallbackLabel || 'Sdíleno';
      return data.name;
    }catch(e){
      return fallbackLabel || 'Sdíleno';
    }
  }

  async function attachDisplayNames(cloudProjectId, rows){
    if(!rows || !rows.length) return rows;
    try{
      const c = MSAuth.get();
      if(!c) return rows;
      // OPRAVA (1.8.2026, kriticka): vlastni polozky (pridane PRAVE
      // TIMHLE zarizenim) nemaji mit ZADNY odznak "kdo pridal" - appka
      // to jinde pozna podle 'Stavebník'. Bez tohohle se pri kazdem
      // dalsim kole omylem "opravilo" na vlastni e-mail, jakmile appka
      // jednou stahla zpet svuj vlastni prave odeslany zaznam (a to se
      // deje pravidelne - kazdy poll stahuje VSECHNY radky, vcetne
      // vlastnich). Tyka se to vsech sesti sekci najednou, protoze
      // vsechny čerpají z teto jedne funkce.
      let myUserId = null;
      try{
        const session = await MSAuth.getSession();
        myUserId = (session && session.user && session.user.id) ? session.user.id : null;
      }catch(e){}
      // OPRAVA (2.8.2026, druha cast): predchozi oprava pokryla jen
      // "moje vlastni polozky na mem vlastnim zarizeni" - ale vlastnik
      // NEMA vlastni radek v project_members (tam jsou jen POZVANI), takze
      // kdyz POZVANY zarizeni divalo na VLASTNIKOVY polozky, jmeno se
      // nikdy nedohledalo a spadlo zpet na vlastnikuv e-mail. Ted appka
      // navic dohledva primo vlastnika projektu a stejne tak ho oznaci
      // jako 'Stavebník', at se divate z ktereho zarizeni chcete.
      let ownerId = null;
      try{
        const { data: projRow } = await c.from('projects').select('owner_id').eq('id', cloudProjectId).maybeSingle();
        ownerId = (projRow && projRow.owner_id) ? projRow.owner_id : null;
      }catch(e){}
      const { data } = await c.from('project_members').select('user_id, name').eq('project_id', cloudProjectId);
      const nameMap = {};
      (data||[]).forEach(m=>{ if(m.name) nameMap[m.user_id] = m.name; });
      return rows.map(r=>{
        if((myUserId && r.added_by === myUserId) || (ownerId && r.added_by === ownerId)) return Object.assign({}, r, { added_by_label: 'Stavebník' });
        return Object.assign({}, r, { added_by_label: nameMap[r.added_by] || r.added_by_label });
      });
    }catch(e){
      console.error('attachDisplayNames neocekavana chyba', e);
      return rows;
    }
  }

  async function retryUnsyncedDiary(){
    try{
      if(typeof msDiary !== 'function') return;
      const list = msDiary();
      for(const e of list){
        if(e.cloudId) continue;
        const { error, row } = await pushDiaryEntry(e);
        if(!error && row && row.id){
          const cur = msDiary();
          const idx = cur.findIndex(x=>x.id===e.id);
          if(idx>-1){ cur[idx] = Object.assign({}, cur[idx], { cloudId: row.id }); msSave(MS_KEYS.diary, cur); }
        }
      }
    }catch(e){ console.error('retryUnsyncedDiary neocekavana chyba', e); }
  }

  async function pushExpense(entry){
    try{
      const c = MSAuth.get();
      if(!c) return { error: null };
      const projectId = await resolveCloudProjectIdForWrite();
      if(!projectId) return { error: null };
      let myLabel = null;
      try{
        const session = await MSAuth.getSession();
        myLabel = (session && session.user && session.user.email) ? session.user.email : null;
      }catch(e){}
      const { data, error } = await c.from('project_expenses').insert({
        project_id: projectId, local_id: entry.id, added_by_label: myLabel,
        type: entry.type, title: entry.title || null, amount: entry.amount, date: entry.date,
        stage: entry.stage || null, category: entry.category || null,
      }).select().single();
      if(error) console.error('MSCloud.pushExpense', error);
      return { error: error || null, row: data || null };
    }catch(e){
      console.error('MSCloud.pushExpense neocekavana chyba', e);
      return { error: null };
    }
  }

  async function fetchAllExpenses(remoteProjectId){
    try{
      const c = MSAuth.get();
      if(!c) return { error: 'Supabase neni pripojene', rows: [] };
      const { data, error } = await c.from('project_expenses').select('*').eq('project_id', remoteProjectId);
      if(error){ console.error('MSCloud.fetchAllExpenses', error); return { error, rows: [] }; }
      return { error: null, rows: data || [] };
    }catch(e){
      console.error('MSCloud.fetchAllExpenses neocekavana chyba', e);
      return { error: 'Nepodařilo se stáhnout finance.', rows: [] };
    }
  }

  async function retryUnsyncedExpenses(){
    try{
      if(typeof msExpenses !== 'function') return;
      const list = msExpenses();
      for(const e of list){
        if(e.cloudId) continue;
        const { error, row } = await pushExpense(e);
        if(!error && row && row.id){
          const cur = msExpenses();
          const idx = cur.findIndex(x=>x.id===e.id);
          if(idx>-1){ cur[idx] = Object.assign({}, cur[idx], { cloudId: row.id }); msSave(MS_KEYS.expenses, cur); }
        }
      }
    }catch(e){ console.error('retryUnsyncedExpenses neocekavana chyba', e); }
  }

  async function pollDiaryBothWays(){
    try{
      const local = getActiveLocalProject();
      if(!local) return false;
      let cloudId = null;
      if(local.isShared && local.remoteProjectId){
        cloudId = local.remoteProjectId;
      } else if(typeof msIsPremiumMock === 'function' && msIsPremiumMock()){
        const { projectId } = await ensureProject();
        cloudId = projectId;
      }
      if(!cloudId) return false;

      await retryUnsyncedDiary();
      await retryUnsyncedExpenses();
      await retryUnsyncedPhotosMeta();
      await retryUnsyncedProjectFolders();
      await retryUnsyncedProjectItems();
      await retryUnsyncedEvents();
      await retryUnsyncedTasks();
      await retryUnsyncedStageDocuments();

      let changed = false;

      // DULEZITE (1.8.2026, mazani): slouceni se ted vola VZDY, i kdyz
      // je "rows" prazdne pole - jinak by appka nikdy nepoznala "vsechno
      // bylo smazano". Ale POUZE pokud fetch OPRAVDU uspel (error===null) -
      // kdyby appka prazdny vysledek zamenila za "nic tam neni" kvuli
      // vypadku site, omylem by smazala vsechno lokalne. Proto se pri
      // chybe slouceni preskoci uplne (nic se neprida, nic se nesmaze,
      // zkusi se to znovu priste).
      const { rows, error: diaryErr } = await fetchAllDiaryEntries(cloudId);
      if(!diaryErr){
        const namedRows = await attachDisplayNames(cloudId, rows||[]);
        const changedCount = (typeof msMergeCloudDiaryEntries === 'function') ? msMergeCloudDiaryEntries(local.id, namedRows) : 0;
        if(changedCount) changed = true;
      }

      const { rows: expenseRows, error: expenseErr } = await fetchAllExpenses(cloudId);
      if(!expenseErr){
        const namedExpenseRows = await attachDisplayNames(cloudId, expenseRows||[]);
        const changedExpCount = (typeof msMergeCloudExpenses === 'function') ? msMergeCloudExpenses(local.id, namedExpenseRows) : 0;
        if(changedExpCount) changed = true;
      }

      const { rows: photoRows, error: photoErr } = await fetchAllPhotosMeta(cloudId);
      if(!photoErr){
        const namedPhotoRows = await attachDisplayNames(cloudId, photoRows||[]);
        const { newEntries: newPhotoEntries, removed: removedPhotoCount } = (typeof msMergeCloudPhotosMeta === 'function') ? msMergeCloudPhotosMeta(local.id, namedPhotoRows) : { newEntries: [], removed: 0 };
        if(newPhotoEntries.length || removedPhotoCount){
          changed = true;
          if(newPhotoEntries.length) await downloadNewPhotoContents(local.id, cloudId, newPhotoEntries);
        }
      }

      // "Projekt" slozky MUSI se sloucit PRED soubory (soubory potrebuji
      // znat lokalni ID slozky, do ktere patri).
      const { rows: folderRows, error: folderErr } = await fetchAllProjectFolders(cloudId);
      if(!folderErr){
        const changedFolderCount = (typeof msMergeCloudProjectFolders === 'function') ? msMergeCloudProjectFolders(local.id, folderRows||[]) : 0;
        if(changedFolderCount) changed = true;
      }
      const { rows: itemRows, error: itemErr } = await fetchAllProjectItems(cloudId);
      if(!itemErr){
        const namedItemRows = await attachDisplayNames(cloudId, itemRows||[]);
        const { newEntries: newItemEntries, removed: removedItemCount } = (typeof msMergeCloudProjectItems === 'function') ? msMergeCloudProjectItems(local.id, namedItemRows) : { newEntries: [], removed: 0 };
        if(newItemEntries.length || removedItemCount){
          changed = true;
          if(newItemEntries.length) await downloadNewProjectItemContents(local.id, cloudId, newItemEntries);
        }
      }

      const { rows: eventRows, error: eventErr } = await fetchAllEvents(cloudId);
      if(!eventErr){
        const namedEventRows = await attachDisplayNames(cloudId, eventRows||[]);
        const changedEventCount = (typeof msMergeCloudEvents === 'function') ? msMergeCloudEvents(local.id, namedEventRows) : 0;
        if(changedEventCount) changed = true;
      }
      const { rows: taskRows, error: taskErr } = await fetchAllTasks(cloudId);
      if(!taskErr){
        const namedTaskRows = await attachDisplayNames(cloudId, taskRows||[]);
        const changedTaskCount = (typeof msMergeCloudTasks === 'function') ? msMergeCloudTasks(local.id, namedTaskRows) : 0;
        if(changedTaskCount) changed = true;
      }

      const { rows: stageDocRows, error: stageDocErr } = await fetchAllStageDocuments(cloudId);
      if(!stageDocErr){
        const namedStageDocRows = await attachDisplayNames(cloudId, stageDocRows||[]);
        const { newEntries: newStageDocEntries, removed: removedStageDocCount } = (typeof msMergeCloudStageDocuments === 'function') ? msMergeCloudStageDocuments(local.id, namedStageDocRows) : { newEntries: [], removed: 0 };
        if(newStageDocEntries.length || removedStageDocCount){
          changed = true;
          if(newStageDocEntries.length) await downloadNewStageDocumentContents(local.id, cloudId, newStageDocEntries);
        }
      }

      return changed;
    }catch(e){
      console.error('pollDiaryBothWays neocekavana chyba', e);
      return false;
    }
  }

  // Mazani (1.8.2026) - jen vlastnik smi mazat (pozvany nema pravo
  // mazat v zadne konfiguraci prav), takze staci jednosmerny smer:
  // vlastnik smaze lokalne -> appka smaze cloudovy zaznam -> pozvany
  // pri dalsim kole pozna, ze uz tam neni, a smaze ho i u sebe (viz
  // msMergeCloudDiaryEntries/msMergeCloudExpenses/msMergeCloudPhotosMeta).
  async function deleteDiaryEntryCloud(cloudId){
    try{
      const c = MSAuth.get();
      if(!c || !cloudId) return { error: null };
      const { error } = await c.from('project_diary_entries').delete().eq('id', cloudId);
      if(error) console.error('MSCloud.deleteDiaryEntryCloud', error);
      return { error: error || null };
    }catch(e){ console.error('MSCloud.deleteDiaryEntryCloud neocekavana chyba', e); return { error: null }; }
  }
  async function deleteExpenseCloud(cloudId){
    try{
      const c = MSAuth.get();
      if(!c || !cloudId) return { error: null };
      const { error } = await c.from('project_expenses').delete().eq('id', cloudId);
      if(error) console.error('MSCloud.deleteExpenseCloud', error);
      return { error: error || null };
    }catch(e){ console.error('MSCloud.deleteExpenseCloud neocekavana chyba', e); return { error: null }; }
  }
  async function deletePhotoMetaCloud(cloudId){
    try{
      const c = MSAuth.get();
      if(!c || !cloudId) return { error: null };
      const { error } = await c.from('project_photos_meta').delete().eq('id', cloudId);
      if(error) console.error('MSCloud.deletePhotoMetaCloud', error);
      return { error: error || null };
    }catch(e){ console.error('MSCloud.deletePhotoMetaCloud neocekavana chyba', e); return { error: null }; }
  }

  async function updateProjectFolderCloud(cloudId, name){
    try{
      const c = MSAuth.get();
      if(!c || !cloudId) return { error: null };
      const { error } = await c.from('project_folders').update({ name }).eq('id', cloudId);
      if(error) console.error('MSCloud.updateProjectFolderCloud', error);
      return { error: error || null };
    }catch(e){ console.error('MSCloud.updateProjectFolderCloud neocekavana chyba', e); return { error: null }; }
  }
  async function updateProjectItemCloud(cloudId, name){
    try{
      const c = MSAuth.get();
      if(!c || !cloudId) return { error: null };
      const { error } = await c.from('project_folder_items').update({ name }).eq('id', cloudId);
      if(error) console.error('MSCloud.updateProjectItemCloud', error);
      return { error: error || null };
    }catch(e){ console.error('MSCloud.updateProjectItemCloud neocekavana chyba', e); return { error: null }; }
  }

  async function pushEvent(entry){
    try{
      const c = MSAuth.get();
      if(!c) return { error: null };
      const projectId = await resolveCloudProjectIdForWrite();
      if(!projectId) return { error: null };
      let myLabel = null;
      try{
        const session = await MSAuth.getSession();
        myLabel = (session && session.user && session.user.email) ? session.user.email : null;
      }catch(e){}
      const { data, error } = await c.from('project_calendar_events').insert({
        project_id: projectId, local_id: entry.id, added_by_label: myLabel,
        title: entry.title, date: entry.date, time: entry.time || null,
      }).select().single();
      if(error) console.error('MSCloud.pushEvent', error);
      return { error: error || null, row: data || null };
    }catch(e){ console.error('MSCloud.pushEvent neocekavana chyba', e); return { error: null }; }
  }
  async function fetchAllEvents(remoteProjectId){
    try{
      const c = MSAuth.get();
      if(!c) return { error: 'Supabase neni pripojene', rows: [] };
      const { data, error } = await c.from('project_calendar_events').select('*').eq('project_id', remoteProjectId);
      if(error){ console.error('MSCloud.fetchAllEvents', error); return { error, rows: [] }; }
      return { error: null, rows: data || [] };
    }catch(e){ console.error('MSCloud.fetchAllEvents neocekavana chyba', e); return { error: 'Nepodařilo se stáhnout kalendář.', rows: [] }; }
  }
  async function deleteEventCloud(cloudId){
    try{
      const c = MSAuth.get();
      if(!c || !cloudId) return { error: null };
      const { error } = await c.from('project_calendar_events').delete().eq('id', cloudId);
      if(error) console.error('MSCloud.deleteEventCloud', error);
      return { error: error || null };
    }catch(e){ console.error('MSCloud.deleteEventCloud neocekavana chyba', e); return { error: null }; }
  }
  async function updateEventCloud(cloudId, patch){
    try{
      const c = MSAuth.get();
      if(!c || !cloudId) return { error: null };
      const { error } = await c.from('project_calendar_events').update(patch).eq('id', cloudId);
      if(error) console.error('MSCloud.updateEventCloud', error);
      return { error: error || null };
    }catch(e){ console.error('MSCloud.updateEventCloud neocekavana chyba', e); return { error: null }; }
  }
  async function retryUnsyncedEvents(){
    try{
      if(typeof msEvents !== 'function') return;
      const list = msEvents();
      for(const e of list){
        if(e.cloudId) continue;
        const { error, row } = await pushEvent(e);
        if(!error && row && row.id){
          const cur = msEvents();
          const idx = cur.findIndex(x=>x.id===e.id);
          if(idx>-1){ cur[idx] = Object.assign({}, cur[idx], { cloudId: row.id }); msSave(MS_KEYS.events, cur); }
        }
      }
    }catch(e){ console.error('retryUnsyncedEvents neocekavana chyba', e); }
  }

  async function pushTask(entry){
    try{
      const c = MSAuth.get();
      if(!c) return { error: null };
      const projectId = await resolveCloudProjectIdForWrite();
      if(!projectId) return { error: null };
      let myLabel = null;
      try{
        const session = await MSAuth.getSession();
        myLabel = (session && session.user && session.user.email) ? session.user.email : null;
      }catch(e){}
      const { data, error } = await c.from('project_task_items').insert({
        project_id: projectId, local_id: entry.id, added_by_label: myLabel,
        title: entry.title, date: entry.date || null, date_mode: entry.dateMode || null, done: !!entry.done, done_date: entry.doneDate || null,
      }).select().single();
      if(error) console.error('MSCloud.pushTask', error);
      return { error: error || null, row: data || null };
    }catch(e){ console.error('MSCloud.pushTask neocekavana chyba', e); return { error: null }; }
  }
  async function fetchAllTasks(remoteProjectId){
    try{
      const c = MSAuth.get();
      if(!c) return { error: 'Supabase neni pripojene', rows: [] };
      const { data, error } = await c.from('project_task_items').select('*').eq('project_id', remoteProjectId);
      if(error){ console.error('MSCloud.fetchAllTasks', error); return { error, rows: [] }; }
      return { error: null, rows: data || [] };
    }catch(e){ console.error('MSCloud.fetchAllTasks neocekavana chyba', e); return { error: 'Nepodařilo se stáhnout úkoly.', rows: [] }; }
  }
  async function deleteTaskCloud(cloudId){
    try{
      const c = MSAuth.get();
      if(!c || !cloudId) return { error: null };
      const { error } = await c.from('project_task_items').delete().eq('id', cloudId);
      if(error) console.error('MSCloud.deleteTaskCloud', error);
      return { error: error || null };
    }catch(e){ console.error('MSCloud.deleteTaskCloud neocekavana chyba', e); return { error: null }; }
  }
  async function updateTaskCloud(cloudId, patch){
    try{
      const c = MSAuth.get();
      if(!c || !cloudId) return { error: null };
      const { error } = await c.from('project_task_items').update(patch).eq('id', cloudId);
      if(error) console.error('MSCloud.updateTaskCloud', error);
      return { error: error || null };
    }catch(e){ console.error('MSCloud.updateTaskCloud neocekavana chyba', e); return { error: null }; }
  }
  async function retryUnsyncedTasks(){
    try{
      if(typeof msTasks !== 'function') return;
      const list = msTasks();
      for(const t of list){
        if(t.cloudId) continue;
        const { error, row } = await pushTask(t);
        if(!error && row && row.id){
          const cur = msTasks();
          const idx = cur.findIndex(x=>x.id===t.id);
          if(idx>-1){ cur[idx] = Object.assign({}, cur[idx], { cloudId: row.id }); msSave('ms_tasks_v1', cur); }
        }
      }
    }catch(e){ console.error('retryUnsyncedTasks neocekavana chyba', e); }
  }

  async function pushStageDocument(entry){
    try{
      const c = MSAuth.get();
      if(!c) return { error: null };
      const projectId = await resolveCloudProjectIdForWrite();
      if(!projectId) return { error: null };
      let myLabel = null;
      try{
        const session = await MSAuth.getSession();
        myLabel = (session && session.user && session.user.email) ? session.user.email : null;
      }catch(e){}
      const { data, error } = await c.from('project_stage_documents').insert({
        project_id: projectId, local_id: entry.id, added_by_label: myLabel,
        stage_key: entry.stage, name: entry.name, mime: entry.mime || null, is_note: !!entry.isNote,
      }).select().single();
      if(error) console.error('MSCloud.pushStageDocument', error);
      return { error: error || null, row: data || null };
    }catch(e){ console.error('MSCloud.pushStageDocument neocekavana chyba', e); return { error: null }; }
  }
  async function fetchAllStageDocuments(remoteProjectId){
    try{
      const c = MSAuth.get();
      if(!c) return { error: 'Supabase neni pripojene', rows: [] };
      const { data, error } = await c.from('project_stage_documents').select('*').eq('project_id', remoteProjectId);
      if(error){ console.error('MSCloud.fetchAllStageDocuments', error); return { error, rows: [] }; }
      return { error: null, rows: data || [] };
    }catch(e){ console.error('MSCloud.fetchAllStageDocuments neocekavana chyba', e); return { error: 'Nepodařilo se stáhnout dokumenty etap.', rows: [] }; }
  }
  async function deleteStageDocumentCloud(cloudId){
    try{
      const c = MSAuth.get();
      if(!c || !cloudId) return { error: null };
      const { error } = await c.from('project_stage_documents').delete().eq('id', cloudId);
      if(error) console.error('MSCloud.deleteStageDocumentCloud', error);
      return { error: error || null };
    }catch(e){ console.error('MSCloud.deleteStageDocumentCloud neocekavana chyba', e); return { error: null }; }
  }
  async function updateStageDocumentCloud(cloudId, patch){
    try{
      const c = MSAuth.get();
      if(!c || !cloudId) return { error: null };
      const { error } = await c.from('project_stage_documents').update(patch).eq('id', cloudId);
      if(error) console.error('MSCloud.updateStageDocumentCloud', error);
      return { error: error || null };
    }catch(e){ console.error('MSCloud.updateStageDocumentCloud neocekavana chyba', e); return { error: null }; }
  }
  async function retryUnsyncedStageDocuments(){
    try{
      if(typeof msDocuments !== 'function') return;
      const list = msDocuments();
      for(const d of list){
        if(d.cloudId) continue;
        const { error, row } = await pushStageDocument(d);
        if(!error && row && row.id){
          const cur = msLoad(MS_KEYS.documents, ()=>[]);
          const idx = cur.findIndex(x=>x.id===d.id);
          if(idx>-1){ cur[idx] = Object.assign({}, cur[idx], { cloudId: row.id }); msSave(MS_KEYS.documents, cur); }
        }
      }
    }catch(e){ console.error('retryUnsyncedStageDocuments neocekavana chyba', e); }
  }
  async function downloadNewStageDocumentContents(localProjectId, remoteProjectId, newEntries){
    for(const entry of newEntries){
      try{
        const key = 'doc_' + entry.id + '__' + localProjectId;
        if(MS_BLOB_CACHE.has(key)) continue;
        const storageId = entry.sourceLocalId || entry.cloudId;
        const { error, dataUrl } = await downloadFile('documents', storageId, remoteProjectId);
        if(error || !dataUrl){
          if(!lastFileSyncDebug) lastFileSyncDebug = { at: new Date().toISOString(), remoteProjectId, ok:0, fail:0, skipped:0, failDetails:[] };
          lastFileSyncDebug.failDetails = (lastFileSyncDebug.failDetails||[]).concat([{ kind:'documents (obousmerne)', id: storageId, error: (error && (error.message||JSON.stringify(error))) || 'prázdný výsledek' }]).slice(-30);
          continue;
        }
        MS_BLOB_CACHE.set(key, dataUrl);
        await msIdbSet(key, dataUrl);
      }catch(e){ console.error('downloadNewStageDocumentContents jednotlivy soubor selhal', e); }
    }
  }

  async function pushProjectFolder(entry){
    if(_msInFlightPushIds.has('f:'+entry.id)) return { error: null };
    _msInFlightPushIds.add('f:'+entry.id);
    try{
      const c = MSAuth.get();
      if(!c) return { error: null };
      const projectId = await resolveCloudProjectIdForWrite();
      if(!projectId) return { error: null };
      // parentId je LOKALNI ID - potrebujeme poslat CLOUD ID rodicovske
      // slozky (nebo null pro korenovou uroven).
      let parentCloudId = null;
      if(entry.parentId){
        const parentFolder = (typeof msLoadProjectFolders === 'function') ? msLoadProjectFolders().find(f=>f.id===entry.parentId) : null;
        parentCloudId = parentFolder ? parentFolder.cloudId : null;
      }
      const { data, error } = await c.from('project_folders').insert({
        project_id: projectId, parent_id: parentCloudId, name: entry.name,
        scope: entry.scope || 'projekt', stage_key: entry.stageKey || null,
      }).select().single();
      if(error) console.error('MSCloud.pushProjectFolder', error);
      return { error: error || null, row: data || null };
    }catch(e){
      console.error('MSCloud.pushProjectFolder neocekavana chyba', e);
      return { error: null };
    }finally{
      _msInFlightPushIds.delete('f:'+entry.id);
    }
  }

  async function fetchAllProjectFolders(remoteProjectId){
    try{
      const c = MSAuth.get();
      if(!c) return { error: 'Supabase neni pripojene', rows: [] };
      const { data, error } = await c.from('project_folders').select('*').eq('project_id', remoteProjectId);
      if(error){ console.error('MSCloud.fetchAllProjectFolders', error); return { error, rows: [] }; }
      return { error: null, rows: data || [] };
    }catch(e){
      console.error('MSCloud.fetchAllProjectFolders neocekavana chyba', e);
      return { error: 'Nepodařilo se stáhnout složky.', rows: [] };
    }
  }

  async function deleteProjectFolderCloud(cloudId){
    try{
      const c = MSAuth.get();
      if(!c || !cloudId) return { error: null };
      const { error } = await c.from('project_folders').delete().eq('id', cloudId);
      if(error) console.error('MSCloud.deleteProjectFolderCloud', error);
      return { error: error || null };
    }catch(e){ console.error('MSCloud.deleteProjectFolderCloud neocekavana chyba', e); return { error: null }; }
  }

  async function pushProjectItem(entry){
    if(_msInFlightPushIds.has(entry.id)) return { error: null }; // uz se to prave odesila odjinud
    _msInFlightPushIds.add(entry.id);
    try{
      const c = MSAuth.get();
      if(!c) return { error: null };
      const projectId = await resolveCloudProjectIdForWrite();
      if(!projectId) return { error: null };
      let folderCloudId = null;
      if(entry.folderId){
        const folder = (typeof msLoadProjectFolders === 'function') ? msLoadProjectFolders().find(f=>f.id===entry.folderId) : null;
        folderCloudId = folder ? folder.cloudId : null;
      }
      let myLabel = null;
      try{
        const session = await MSAuth.getSession();
        myLabel = (session && session.user && session.user.email) ? session.user.email : null;
      }catch(e){}
      const { data, error } = await c.from('project_folder_items').insert({
        project_id: projectId, folder_id: folderCloudId, local_id: entry.id, added_by_label: myLabel,
        name: entry.name, mime: entry.mime || null, is_note: !!entry.isNote,
        scope: entry.scope || 'projekt', stage_key: entry.stageKey || null,
      }).select().single();
      if(error) console.error('MSCloud.pushProjectItem', error);
      return { error: error || null, row: data || null };
    }catch(e){
      console.error('MSCloud.pushProjectItem neocekavana chyba', e);
      return { error: null };
    }finally{
      _msInFlightPushIds.delete(entry.id);
    }
  }

  async function fetchAllProjectItems(remoteProjectId){
    try{
      const c = MSAuth.get();
      if(!c) return { error: 'Supabase neni pripojene', rows: [] };
      const { data, error } = await c.from('project_folder_items').select('*').eq('project_id', remoteProjectId);
      if(error){ console.error('MSCloud.fetchAllProjectItems', error); return { error, rows: [] }; }
      return { error: null, rows: data || [] };
    }catch(e){
      console.error('MSCloud.fetchAllProjectItems neocekavana chyba', e);
      return { error: 'Nepodařilo se stáhnout soubory z Projektu.', rows: [] };
    }
  }

  async function deleteProjectItemCloud(cloudId){
    try{
      const c = MSAuth.get();
      if(!c || !cloudId) return { error: null };
      const { error } = await c.from('project_folder_items').delete().eq('id', cloudId);
      if(error) console.error('MSCloud.deleteProjectItemCloud', error);
      return { error: error || null };
    }catch(e){ console.error('MSCloud.deleteProjectItemCloud neocekavana chyba', e); return { error: null }; }
  }

  // Pro NOVE domergovane soubory z "Projekt" stahne i samotny obsah.
  async function downloadNewProjectItemContents(localProjectId, remoteProjectId, newEntries){
    for(const entry of newEntries){
      try{
        const key = 'pitem_' + entry.id + '__' + localProjectId;
        if(MS_BLOB_CACHE.has(key)) continue;
        const storageId = entry.sourceLocalId || entry.cloudId;
        const { error, dataUrl } = await downloadFile('projectitems', storageId, remoteProjectId);
        if(error || !dataUrl){
          if(!lastFileSyncDebug) lastFileSyncDebug = { at: new Date().toISOString(), remoteProjectId, ok:0, fail:0, skipped:0, failDetails:[] };
          lastFileSyncDebug.failDetails = (lastFileSyncDebug.failDetails||[]).concat([{ kind:'projectitems', id: storageId, error: (error && (error.message||JSON.stringify(error))) || 'prázdný výsledek' }]).slice(-30);
          continue;
        }
        MS_BLOB_CACHE.set(key, dataUrl);
        await msIdbSet(key, dataUrl);
      }catch(e){ console.error('downloadNewProjectItemContents jednotlivy soubor selhal', e); }
    }
  }

  async function retryUnsyncedProjectFolders(){
    try{
      if(typeof msLoadProjectFolders !== 'function') return;
      const list = msLoadProjectFolders();
      let changed = false;
      for(const f of list){
        if(f.cloudId) continue;
        const { error, row } = await pushProjectFolder(f);
        if(!error && row && row.id){ f.cloudId = row.id; changed = true; }
      }
      if(changed) msSaveProjectFolders(list);
    }catch(e){ console.error('retryUnsyncedProjectFolders neocekavana chyba', e); }
  }
  async function retryUnsyncedProjectItems(){
    try{
      if(typeof msLoadProjectItems !== 'function') return;
      const list = msLoadProjectItems();
      let changed = false;
      for(const it of list){
        if(it.cloudId) continue;
        const { error, row } = await pushProjectItem(it);
        if(!error && row && row.id){ it.cloudId = row.id; changed = true; }
      }
      if(changed) msSaveProjectItems(list);
    }catch(e){ console.error('retryUnsyncedProjectItems neocekavana chyba', e); }
  }

  async function pushPhotoMeta(entry){
    try{
      const c = MSAuth.get();
      if(!c) return { error: null };
      const projectId = await resolveCloudProjectIdForWrite();
      if(!projectId) return { error: null };
      let myLabel = null;
      try{
        const session = await MSAuth.getSession();
        myLabel = (session && session.user && session.user.email) ? session.user.email : null;
      }catch(e){}
      const { data, error } = await c.from('project_photos_meta').insert({
        project_id: projectId, local_id: entry.id, added_by_label: myLabel,
        date: entry.date || null, stage: entry.stage || null, caption: entry.caption || null,
      }).select().single();
      if(error) console.error('MSCloud.pushPhotoMeta', error);
      return { error: error || null, row: data || null };
    }catch(e){
      console.error('MSCloud.pushPhotoMeta neocekavana chyba', e);
      return { error: null };
    }
  }

  async function fetchAllPhotosMeta(remoteProjectId){
    try{
      const c = MSAuth.get();
      if(!c) return { error: 'Supabase neni pripojene', rows: [] };
      const { data, error } = await c.from('project_photos_meta').select('*').eq('project_id', remoteProjectId);
      if(error){ console.error('MSCloud.fetchAllPhotosMeta', error); return { error, rows: [] }; }
      return { error: null, rows: data || [] };
    }catch(e){
      console.error('MSCloud.fetchAllPhotosMeta neocekavana chyba', e);
      return { error: 'Nepodařilo se stáhnout popisky fotek.', rows: [] };
    }
  }

  async function retryUnsyncedPhotosMeta(){
    try{
      if(typeof msLoad !== 'function' || typeof MS_KEYS === 'undefined') return;
      const list = msLoad(MS_KEYS.photos, ()=>[]);
      for(const p of list){
        if(p.cloudId) continue;
        const { error, row } = await pushPhotoMeta(p);
        if(!error && row && row.id){
          const cur = msLoad(MS_KEYS.photos, ()=>[]);
          const idx = cur.findIndex(x=>x.id===p.id);
          if(idx>-1){ cur[idx] = Object.assign({}, cur[idx], { cloudId: row.id }); msSave(MS_KEYS.photos, cur); }
        }
      }
    }catch(e){ console.error('retryUnsyncedPhotosMeta neocekavana chyba', e); }
  }

  // Pro NOVE domergovane popisky fotek stahne i samotny obrazek (Storage,
  // stejna cesta jako uz existujici syncSharedFiles) a ulozi ho pod
  // SPRAVNYM lokalnim projektem (nemusi byt ten prave aktivni).
  async function downloadNewPhotoContents(localProjectId, remoteProjectId, newEntries){
    for(const entry of newEntries){
      try{
        const key = 'photo_' + entry.id + '__' + localProjectId;
        if(MS_BLOB_CACHE.has(key)) continue;
        // OPRAVA (1.8.2026): soubor v Storage je ulozeny pod PUVODNIM
        // local_id z appky, co ho nahrala - ne pod cloudId (to je jen
        // ID databazoveho radku). Bez tohohle appka hledala soubor na
        // spatne "adrese" a nikdy ho nenasla (odtud prazdne ctverecky).
        const storageId = entry.sourceLocalId || entry.cloudId;
        const { error, dataUrl } = await downloadFile('photos', storageId, remoteProjectId);
        if(error || !dataUrl){
          if(!lastFileSyncDebug) lastFileSyncDebug = { at: new Date().toISOString(), remoteProjectId, ok:0, fail:0, skipped:0, failDetails:[] };
          lastFileSyncDebug.failDetails = (lastFileSyncDebug.failDetails||[]).concat([{ kind:'photos (obousmerne)', id: storageId, error: (error && (error.message||JSON.stringify(error))) || 'prázdný výsledek' }]).slice(-30);
          continue;
        }
        MS_BLOB_CACHE.set(key, dataUrl);
        await msIdbSet(key, dataUrl);
      }catch(e){ console.error('downloadNewPhotoContents jednotliva fotka selhala', e); }
    }
  }

  return { ensureProject, createInvite, listPeople, inviteLink, getPerson, updateMember, removeMember, cancelInvite, previewInvite, redeemInvite, uploadSnapshot, getSnapshot, materializeSharedProject, refreshSharedProject, uploadFile, deleteFile, downloadFile, syncSharedFiles, autoRefreshAllShared, getFileSyncDebugInfo, backfillAllFiles, pushDiaryEntry, fetchAllDiaryEntries, pushExpense, fetchAllExpenses, pushPhotoMeta, fetchAllPhotosMeta, pollDiaryBothWays, deleteDiaryEntryCloud, deleteExpenseCloud, deletePhotoMetaCloud, pushProjectFolder, fetchAllProjectFolders, deleteProjectFolderCloud, pushProjectItem, fetchAllProjectItems, deleteProjectItemCloud, updateProjectFolderCloud, updateProjectItemCloud, pushEvent, fetchAllEvents, deleteEventCloud, updateEventCloud, pushTask, fetchAllTasks, deleteTaskCloud, updateTaskCloud, pushStageDocument, fetchAllStageDocuments, deleteStageDocumentCloud, updateStageDocumentCloud, fetchMyPermissions };
})();
