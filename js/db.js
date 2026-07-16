// js/db.js
// Couche base de données avec support hors-ligne

const DB = (() => {
  const OFFLINE_KEY = 'cahier_bons_offline_queue';
  const CACHE_KEY = 'cahier_bons_cache';

  // ---- Utilitaires cache local ----
  function getCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
  }
  function setCache(data) {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  }
  function getOfflineQueue() {
    try { return JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]'); } catch { return []; }
  }
  function addToOfflineQueue(op) {
    const q = getOfflineQueue();
    q.push({ ...op, id: Date.now(), timestamp: new Date().toISOString() });
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(q));
  }
  function clearOfflineQueue() {
    localStorage.removeItem(OFFLINE_KEY);
  }

  function isOnline() { return navigator.onLine; }

  // ---- Auth ----
  async function signUp(email, password, nomBoutique, telephone) {
    const { data, error } = await window.supabaseClient.auth.signUp({ email, password });
    if (error) throw error;
    // Créer la boutique après inscription
    if (data.user) {
      await window.supabaseClient.from('boutiques').insert({
        user_id: data.user.id,
        nom: nomBoutique,
        telephone
      });
    }
    return data;
  }

  async function signIn(identifiant, password, isEmail) {
    const credentials = isEmail 
      ? { email: identifiant, password: password }
      : { phone: identifiant, password: password };

    const { data, error } = await window.supabaseClient.auth.signInWithPassword(credentials);
    if (error) throw error;
    return data;
  }

  async function resetPassword(email) {
    const { error } = await window.supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) throw error;
  }

  async function signOut() {
    const { error } = await window.supabaseClient.auth.signOut();
    if (error) throw error;
    localStorage.removeItem(CACHE_KEY);
  }

  async function getSession() {
    const { data } = await window.supabaseClient.auth.getSession();
    return data.session;
  }

  async function getBoutique() {
    const { data, error } = await window.supabaseClient
      .from('boutiques').select('*').single();
    if (error) throw error;
    return data;
  }

  // ---- Clients ----
  async function getClients() {
    if (!isOnline()) {
      const cache = getCache();
      return cache.clients || [];
    }
    const { data, error } = await window.supabaseClient
      .from('clients').select('*').order('nom');
    if (error) throw error;
    const cache = getCache();
    cache.clients = data;
    setCache(cache);
    return data;
  }

  async function addClient(client) {
    const boutique = await getBoutiqueId();
    const payload = { ...client, boutique_id: boutique };
    if (!isOnline()) {
      // Mode offline : sauvegarde locale temporaire
      const tempId = 'temp_' + Date.now();
      const cache = getCache();
      cache.clients = [...(cache.clients || []), { ...payload, id: tempId, _offline: true }];
      setCache(cache);
      addToOfflineQueue({ type: 'INSERT', table: 'clients', data: payload, tempId });
      return { ...payload, id: tempId };
    }
    const { data, error } = await window.supabaseClient
      .from('clients').insert(payload).select().single();
    if (error) throw error;
    const cache = getCache();
    cache.clients = [...(cache.clients || []), data];
    setCache(cache);
    return data;
  }

  async function updateClient(id, updates) {
    if (!isOnline()) {
      const cache = getCache();
      cache.clients = (cache.clients || []).map(c => c.id === id ? { ...c, ...updates } : c);
      setCache(cache);
      addToOfflineQueue({ type: 'UPDATE', table: 'clients', id, data: updates });
      return { id, ...updates };
    }
    const { data, error } = await window.supabaseClient
      .from('clients').update(updates).eq('id', id).select().single();
    if (error) throw error;
    const cache = getCache();
    cache.clients = (cache.clients || []).map(c => c.id === id ? data : c);
    setCache(cache);
    return data;
  }

  async function deleteClient(id) {
    if (!isOnline()) {
      const cache = getCache();
      cache.clients = (cache.clients || []).filter(c => c.id !== id);
      cache.bons = (cache.bons || []).filter(b => b.client_id !== id);
      setCache(cache);
      addToOfflineQueue({ type: 'DELETE', table: 'clients', id });
      return;
    }
    const { error } = await window.supabaseClient.from('clients').delete().eq('id', id);
    if (error) throw error;
    const cache = getCache();
    cache.clients = (cache.clients || []).filter(c => c.id !== id);
    cache.bons = (cache.bons || []).filter(b => b.client_id !== id);
    setCache(cache);
  }

  // ---- Bons ----
  async function getBons(clientId = null) {
    if (!isOnline()) {
      const cache = getCache();
      let bons = cache.bons || [];
      if (clientId) bons = bons.filter(b => b.client_id === clientId);
      return bons;
    }
    let query = window.supabaseClient
      .from('bons').select('*, clients(nom, prenom, telephone)').order('date_bon', { ascending: false });
    if (clientId) query = query.eq('client_id', clientId);
    const { data, error } = await query;
    if (error) throw error;
    const cache = getCache();
    if (!clientId) { cache.bons = data; setCache(cache); }
    return data;
  }

  async function addBon(bon) {
    const boutique = await getBoutiqueId();
    const payload = { ...bon, boutique_id: boutique };
    if (!isOnline()) {
      const tempId = 'temp_' + Date.now();
      const cache = getCache();
      cache.bons = [...(cache.bons || []), { ...payload, id: tempId, montant_paye: 0, _offline: true }];
      setCache(cache);
      addToOfflineQueue({ type: 'INSERT', table: 'bons', data: payload, tempId });
      return { ...payload, id: tempId, montant_paye: 0 };
    }
    const { data, error } = await window.supabaseClient
      .from('bons').insert(payload).select('*, clients(nom, prenom)').single();
    if (error) throw error;
    const cache = getCache();
    cache.bons = [data, ...(cache.bons || [])];
    setCache(cache);
    return data;
  }

  async function updateBon(id, updates) {
    if (!isOnline()) {
      const cache = getCache();
      cache.bons = (cache.bons || []).map(b => b.id === id ? { ...b, ...updates } : b);
      setCache(cache);
      addToOfflineQueue({ type: 'UPDATE', table: 'bons', id, data: updates });
      return { id, ...updates };
    }
    const { data, error } = await window.supabaseClient
      .from('bons').update(updates).eq('id', id).select('*, clients(nom, prenom)').single();
    if (error) throw error;
    const cache = getCache();
    cache.bons = (cache.bons || []).map(b => b.id === id ? data : b);
    setCache(cache);
    return data;
  }

  async function deleteBon(id) {
    if (!isOnline()) {
      const cache = getCache();
      cache.bons = (cache.bons || []).filter(b => b.id !== id);
      setCache(cache);
      addToOfflineQueue({ type: 'DELETE', table: 'bons', id });
      return;
    }
    const { error } = await window.supabaseClient.from('bons').delete().eq('id', id);
    if (error) throw error;
    const cache = getCache();
    cache.bons = (cache.bons || []).filter(b => b.id !== id);
    setCache(cache);
  }

  // ---- Paiements ----
  async function addPaiement(bonId, montant, note = '') {
    const boutique = await getBoutiqueId();
    const payload = { bon_id: bonId, boutique_id: boutique, montant, note, date_paiement: new Date().toISOString().split('T')[0] };

    // Mettre à jour montant_paye sur le bon
    const bon = (getCache().bons || []).find(b => b.id === bonId);
    const nouveauPaye = parseFloat(bon?.montant_paye || 0) + parseFloat(montant);

    if (!isOnline()) {
      const tempId = 'temp_' + Date.now();
      const cache = getCache();
      cache.paiements = [...(cache.paiements || []), { ...payload, id: tempId }];
      cache.bons = (cache.bons || []).map(b => b.id === bonId ? { ...b, montant_paye: nouveauPaye } : b);
      setCache(cache);
      addToOfflineQueue({ type: 'PAYMENT', bonId, montant, note, boutique_id: boutique });
      return { ...payload, id: tempId };
    }

    const { data, error } = await window.supabaseClient
      .from('paiements').insert(payload).select().single();
    if (error) throw error;

    // Mettre à jour le bon
    await updateBon(bonId, { montant_paye: nouveauPaye });

    const cache = getCache();
    cache.paiements = [...(cache.paiements || []), data];
    setCache(cache);
    return data;
  }

  async function getPaiements(bonId) {
    if (!isOnline()) {
      const cache = getCache();
      return (cache.paiements || []).filter(p => p.bon_id === bonId);
    }
    const { data, error } = await window.supabaseClient
      .from('paiements').select('*').eq('bon_id', bonId).order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  // ---- Synchronisation offline ----
  async function syncOfflineQueue() {
    const queue = getOfflineQueue();
    if (!queue.length) return { synced: 0 };
    const boutique = await getBoutiqueId();
    let synced = 0;
    const tempIdMap = {};

    for (const op of queue) {
      try {
        if (op.type === 'INSERT') {
          const payload = { ...op.data, boutique_id: boutique };
          delete payload.id;
          const { data } = await window.supabaseClient.from(op.table).insert(payload).select().single();
          if (op.tempId) tempIdMap[op.tempId] = data.id;
          synced++;
        } else if (op.type === 'UPDATE') {
          const realId = tempIdMap[op.id] || op.id;
          if (!realId.startsWith('temp_')) {
            await window.supabaseClient.from(op.table).update(op.data).eq('id', realId);
          }
          synced++;
        } else if (op.type === 'DELETE') {
          const realId = tempIdMap[op.id] || op.id;
          if (!realId.startsWith('temp_')) {
            await window.supabaseClient.from(op.table).delete().eq('id', realId);
          }
          synced++;
        } else if (op.type === 'PAYMENT') {
          const realBonId = tempIdMap[op.bonId] || op.bonId;
          if (!realBonId.startsWith('temp_')) {
            await window.supabaseClient.from('paiements').insert({
              bon_id: realBonId, boutique_id: boutique,
              montant: op.montant, note: op.note,
              date_paiement: new Date().toISOString().split('T')[0]
            });
          }
          synced++;
        }
      } catch (e) { console.error('Sync error:', e); }
    }

    clearOfflineQueue();
    // Rafraîchir le cache depuis Supabase
    localStorage.removeItem(CACHE_KEY);
    return { synced };
  }

  // ---- Utilitaire ID boutique ----
  let _boutiqueId = null;
  async function getBoutiqueId() {
    if (_boutiqueId) return _boutiqueId;
    if (!isOnline()) {
      const cache = getCache();
      return cache.boutiqueId || null;
    }
    const b = await getBoutique();
    _boutiqueId = b.id;
    const cache = getCache();
    cache.boutiqueId = b.id;
    setCache(cache);
    return b.id;
  }

  function resetBoutiqueId() { _boutiqueId = null; }

  function getOfflineQueueCount() { return getOfflineQueue().length; }

  return {
    signUp, signIn, signOut, getSession, getBoutique, resetPassword,
    getClients, addClient, updateClient, deleteClient,
    getBons, addBon, updateBon, deleteBon,
    addPaiement, getPaiements,
    syncOfflineQueue, getOfflineQueueCount, resetBoutiqueId,
    isOnline
  };
})();

window.DB = DB;
