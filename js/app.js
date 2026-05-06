// js/app.js — Cahier de Bons Digital
// Logique principale de l'application

const App = (() => {

  // ---- État global ----
  let state = {
    clients: [],
    bons: [],
    boutique: null,
    currentPage: 'dashboard',
    bonFilter: 'all',   // all | pending | paid
    editingClientId: null,
    editingBonId: null,
    viewingClientId: null,
    payingBonId: null,
    loading: false,
  };

  // ---- Utilitaires ----
  function fmt(n) {
    return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA';
  }
  function fmtShort(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(0) + 'k';
    return String(Math.round(n));
  }
  function fmtDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' });
  }
  function today() { return new Date().toISOString().split('T')[0]; }
  function initials(name, prenom) {
    const parts = [prenom, name].filter(Boolean);
    return parts.map(w => w[0]).slice(0, 2).join('').toUpperCase();
  }
  function clientFullName(c) { return [c.prenom, c.nom].filter(Boolean).join(' '); }
  function clientDebt(clientId) {
    return state.bons
      .filter(b => b.client_id === clientId)
      .reduce((s, b) => s + parseFloat(b.montant) - parseFloat(b.montant_paye), 0);
  }
  function el(id) { return document.getElementById(id); }
  function qs(sel) { return document.querySelector(sel); }

  // ---- Toast ----
  function toast(msg, type = '') {
    const t = el('toast');
    t.textContent = msg;
    t.className = 'toast show ' + type;
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2800);
  }

  // ---- Loading ----
  function setLoading(on) {
    state.loading = on;
    document.querySelectorAll('.btn-save').forEach(b => b.disabled = on);
  }

  // ---- Modals ----
  function openModal(id) { el('modal-' + id).classList.add('show'); }
  function closeModal(id) { el('modal-' + id).classList.remove('show'); }

  // ---- Auth ----
  async function init() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
      navigator.serviceWorker.addEventListener('message', e => {
        if (e.data?.type === 'SYNC_OFFLINE') syncOffline();
      });
    }

    // Connectivity listeners
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    updateConnectivity();

    // Check session
    const session = await DB.getSession();
    if (session) {
      await loadApp();
    } else {
      showAuth();
    }
  }

  function showAuth() {
    el('auth-screen').style.display = 'flex';
    el('app').classList.remove('visible');
    el('tabSignin').click();
  }

  async function loadApp() {
    try {
      state.boutique = await DB.getBoutique();
      el('boutiqueName').textContent = state.boutique.nom;
    } catch (e) {
      console.warn('Boutique non trouvée:', e);
    }
    el('auth-screen').style.display = 'none';
    el('app').classList.add('visible');
    el('headerDate').textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
    await loadData();
    showPage('dashboard');
  }

  async function loadData() {
    try {
      [state.clients, state.bons] = await Promise.all([DB.getClients(), DB.getBons()]);
    } catch (e) {
      toast('Chargement depuis le cache local', 'warning');
    }
    updateStats();
    checkSyncBanner();
  }

  // ---- Connectivity ----
  function updateConnectivity() {
    const offline = !navigator.onLine;
    el('offlineBadge').classList.toggle('show', offline);
  }
  function onOnline() {
    updateConnectivity();
    if (DB.getOfflineQueueCount() > 0) {
      el('syncBanner').classList.add('show');
      el('syncCount').textContent = DB.getOfflineQueueCount();
    }
  }
  function onOffline() { updateConnectivity(); }
  function checkSyncBanner() {
    const count = DB.getOfflineQueueCount();
    el('syncBanner').classList.toggle('show', count > 0);
    if (count > 0) el('syncCount').textContent = count;
  }
  async function syncOffline() {
    try {
      const { synced } = await DB.syncOfflineQueue();
      if (synced > 0) {
        toast(`✅ ${synced} opération(s) synchronisée(s)`, 'success');
        el('syncBanner').classList.remove('show');
        await loadData();
        renderCurrentPage();
      }
    } catch (e) { toast('Erreur de synchronisation', 'error'); }
  }

  // ---- Navigation ----
  function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    el('page-' + page).classList.add('active');
    el('tab-' + page).classList.add('active');
    state.currentPage = page;
    renderCurrentPage();
  }
  function renderCurrentPage() {
    if (state.currentPage === 'dashboard') renderDashboard();
    if (state.currentPage === 'clients')   renderClients();
    if (state.currentPage === 'bons')      renderBons();
    updateStats();
  }

  // ---- Stats bar ----
  function updateStats() {
    const totalDu = state.bons.reduce((s, b) => s + parseFloat(b.montant) - parseFloat(b.montant_paye), 0);
    const activeBons = state.bons.filter(b => parseFloat(b.montant_paye) < parseFloat(b.montant)).length;
    el('statTotal').textContent = fmtShort(totalDu);
    el('statClients').textContent = state.clients.length;
    el('statBons').textContent = activeBons;
  }

  // ---- DASHBOARD ----
  function renderDashboard() {
    const totalDu   = state.bons.reduce((s, b) => s + parseFloat(b.montant) - parseFloat(b.montant_paye), 0);
    const totalPaye = state.bons.reduce((s, b) => s + parseFloat(b.montant_paye), 0);
    const totalBons = state.bons.reduce((s, b) => s + parseFloat(b.montant), 0);

    el('dashTotalDebt').textContent  = fmt(totalDu);
    el('dashTotalPaid').textContent  = fmt(totalPaye);
    el('dashBonCount').textContent   = state.bons.length;
    el('dashClientCount').textContent = state.clients.length;

    // Top débiteurs
    const topData = state.clients
      .map(c => ({ c, du: clientDebt(c.id) }))
      .filter(x => x.du > 0)
      .sort((a, b) => b.du - a.du)
      .slice(0, 5);

    el('topDebtors').innerHTML = topData.length
      ? topData.map((x, i) => `
          <div class="top-debtor">
            <div class="rank ${i === 0 ? 'gold' : ''}">${i + 1}</div>
            <div style="flex:1">
              <div style="font-size:14px;font-weight:600">${clientFullName(x.c)}</div>
              <div style="font-size:11px;color:var(--text-muted)">${x.c.telephone || ''}</div>
            </div>
            <div style="font-size:14px;font-weight:700;color:var(--danger)">${fmt(x.du)}</div>
          </div>`).join('')
      : '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px">Aucune dette active 🎉</div>';

    // Bons récents
    const recent = [...state.bons].sort((a, b) => new Date(b.date_bon) - new Date(a.date_bon)).slice(0, 5);
    el('recentBons').innerHTML = recent.length
      ? recent.map(b => bonCardHTML(b, true)).join('')
      : '<div class="empty-state"><div class="empty-icon">📖</div><div class="empty-text">Aucun bon enregistré</div><div class="empty-sub">Créez vos premiers clients et bons</div></div>';
  }

  // ---- CLIENTS ----
  function renderClients(filter = '') {
    const q = (el('clientSearch')?.value || filter).toLowerCase();
    const list = state.clients.filter(c =>
      !q || clientFullName(c).toLowerCase().includes(q) || (c.telephone || '').includes(q)
    );

    el('clientsList').innerHTML = list.length
      ? list.map(c => {
          const du = clientDebt(c.id);
          return `
            <div class="client-card" onclick="App.openClientDetail('${c.id}')">
              <div class="avatar">${initials(c.nom, c.prenom)}</div>
              <div class="client-info">
                <div class="client-name">${clientFullName(c)}</div>
                <div class="client-phone">📱 ${c.telephone || 'Pas de téléphone'}</div>
              </div>
              <div class="client-debt">
                <div class="debt-amount ${du > 0 ? 'red' : 'green'}">${fmt(du)}</div>
                <div class="debt-label">${du > 0 ? 'doit' : '✓ soldé'}</div>
              </div>
            </div>`;
        }).join('')
      : '<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-text">Aucun client trouvé</div></div>';
  }

  // ---- BONS ----
  function renderBons(filter = '') {
    const q = (el('bonSearch')?.value || filter).toLowerCase();
    let list = state.bons.filter(b => {
      if (!q) return true;
      const c = state.clients.find(x => x.id === b.client_id);
      return (c && clientFullName(c).toLowerCase().includes(q)) || (b.description || '').toLowerCase().includes(q);
    });

    if (state.bonFilter === 'pending') list = list.filter(b => parseFloat(b.montant_paye) < parseFloat(b.montant));
    if (state.bonFilter === 'paid')    list = list.filter(b => parseFloat(b.montant_paye) >= parseFloat(b.montant));

    list.sort((a, b) => new Date(b.date_bon) - new Date(a.date_bon));

    el('bonsList').innerHTML = list.length
      ? list.map(b => bonCardHTML(b)).join('')
      : '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">Aucun bon trouvé</div></div>';
  }

  // ---- Bon card HTML ----
  function bonCardHTML(b, compact = false) {
    const c = state.clients.find(x => x.id === b.client_id);
    if (!c) return '';
    const remaining = parseFloat(b.montant) - parseFloat(b.montant_paye);
    const isPaid = remaining <= 0;
    const isPartial = parseFloat(b.montant_paye) > 0 && !isPaid;
    const cls = isPaid ? 'paid' : isPartial ? 'partial' : '';
    const pct = Math.round((parseFloat(b.montant_paye) / parseFloat(b.montant)) * 100);

    let statusBadge = isPaid
      ? '<span class="status-badge paid">✓ Remboursé</span>'
      : isPartial
      ? `<span class="status-badge partial">Reste ${fmt(remaining)}</span>`
      : '<span class="status-badge due">Non payé</span>';

    const actions = compact ? '' : `
      <div class="action-row">
        ${!isPaid ? `<button class="btn btn-sm pay" onclick="App.openPayment('${b.id}')">💳 Payer</button>` : ''}
        <button class="btn btn-sm pdf" onclick="App.exportClientPDF('${c.id}')">📄 PDF</button>
        <button class="btn btn-sm edit" onclick="App.openEditBon('${b.id}')">✏️</button>
        <button class="btn btn-sm del" onclick="App.deleteBon('${b.id}')">🗑️</button>
      </div>`;

    return `
      <div class="bon-card ${cls}">
        <div class="bon-header">
          <div class="bon-client">${clientFullName(c)}</div>
          <div class="bon-amount">${fmt(b.montant)}</div>
        </div>
        <span class="bon-desc">${b.description}</span>
        ${isPartial ? `<div class="progress-wrap"><div class="progress-fill" style="width:${pct}%"></div></div>` : ''}
        <div class="bon-footer" style="margin-top:8px">
          <span>📅 ${fmtDate(b.date_bon)}</span>
          ${statusBadge}
        </div>
        ${actions}
      </div>`;
  }

  // ---- Client Detail ----
  async function openClientDetail(clientId) {
    state.viewingClientId = clientId;
    const c = state.clients.find(x => x.id === clientId);
    if (!c) return;
    const du = clientDebt(clientId);
    el('detailAvatar').textContent = initials(c.nom, c.prenom);
    el('detailName').textContent = clientFullName(c);
    el('detailPhone').textContent = '📱 ' + (c.telephone || 'Pas de téléphone');
    el('detailTotalDebt').textContent = fmt(du);

    const clientBons = state.bons
      .filter(b => b.client_id === clientId)
      .sort((a, b) => new Date(b.date_bon) - new Date(a.date_bon));

    el('clientBonsList').innerHTML = clientBons.length
      ? clientBons.map(b => {
          const remaining = parseFloat(b.montant) - parseFloat(b.montant_paye);
          const isPaid = remaining <= 0;
          const isPartial = parseFloat(b.montant_paye) > 0 && !isPaid;
          const cls = isPaid ? 'paid' : isPartial ? 'partial' : '';
          let badge = isPaid ? '<span class="status-badge paid">✓ Remboursé</span>'
            : isPartial ? `<span class="status-badge partial">Reste ${fmt(remaining)}</span>`
            : '<span class="status-badge due">Non payé</span>';
          return `
            <div class="bon-card ${cls}">
              <div class="bon-header">
                <div class="bon-client">${b.description}</div>
                <div class="bon-amount">${fmt(b.montant)}</div>
              </div>
              <div class="bon-footer">
                <span>📅 ${fmtDate(b.date_bon)}</span>
                ${badge}
              </div>
              ${!isPaid ? `<div class="action-row"><button class="btn btn-sm pay" onclick="App.openPayment('${b.id}')">💳 Payer</button></div>` : ''}
            </div>`;
        }).join('')
      : '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px">Aucun bon pour ce client</div>';

    el('detailEditBtn').onclick = () => { closeModal('clientDetail'); openEditClient(clientId); };
    el('detailDeleteBtn').onclick = () => deleteClient(clientId);
    el('detailAddBonBtn').onclick = () => {
      closeModal('clientDetail');
      openAddBon(clientId);
    };
    el('detailExportBtn').onclick = () => exportClientPDF(clientId);

    openModal('clientDetail');
  }

  // ---- CRUD Clients ----
  function openAddClient() {
    state.editingClientId = null;
    el('clientModalTitle').textContent = 'Nouveau client';
    el('inputClientName').value = '';
    el('inputClientPrenom').value = '';
    el('inputClientPhone').value = '';
    openModal('addClient');
    setTimeout(() => el('inputClientPrenom').focus(), 100);
  }

  function openEditClient(id) {
    const c = state.clients.find(x => x.id === id);
    if (!c) return;
    state.editingClientId = id;
    el('clientModalTitle').textContent = 'Modifier le client';
    el('inputClientPrenom').value = c.prenom || '';
    el('inputClientName').value   = c.nom || '';
    el('inputClientPhone').value  = c.telephone || '';
    openModal('addClient');
  }

  async function saveClient() {
    const nom    = el('inputClientName').value.trim();
    const prenom = el('inputClientPrenom').value.trim();
    const telephone = el('inputClientPhone').value.trim();
    if (!nom) { toast('Veuillez entrer un nom', 'error'); return; }
    setLoading(true);
    try {
      if (state.editingClientId) {
        const updated = await DB.updateClient(state.editingClientId, { nom, prenom, telephone });
        state.clients = state.clients.map(c => c.id === state.editingClientId ? { ...c, ...updated } : c);
        toast('Client modifié ✓', 'success');
      } else {
        const newClient = await DB.addClient({ nom, prenom, telephone });
        state.clients.push(newClient);
        toast('Client ajouté ✓', 'success');
      }
      closeModal('addClient');
      renderCurrentPage();
    } catch (e) { toast('Erreur : ' + e.message, 'error'); }
    setLoading(false);
  }

  async function deleteClient(id) {
    if (!confirm('Supprimer ce client et tous ses bons ? Cette action est irréversible.')) return;
    try {
      await DB.deleteClient(id);
      state.clients = state.clients.filter(c => c.id !== id);
      state.bons = state.bons.filter(b => b.client_id !== id);
      closeModal('clientDetail');
      toast('Client supprimé', 'success');
      renderCurrentPage();
    } catch (e) { toast('Erreur : ' + e.message, 'error'); }
  }

  // ---- CRUD Bons ----
  function populateClientSelect(selectedId = null) {
    const sel = el('inputBonClient');
    sel.innerHTML = '<option value="">Choisir un client...</option>' +
      state.clients.map(c => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${clientFullName(c)}</option>`).join('');
  }

  function openAddBon(preselectedClientId = null) {
    state.editingBonId = null;
    el('bonModalTitle').textContent = 'Nouveau bon';
    populateClientSelect(preselectedClientId);
    el('inputBonAmount').value = '';
    el('inputBonDesc').value   = '';
    el('inputBonDate').value   = today();
    openModal('addBon');
    setTimeout(() => el('inputBonDesc').focus(), 100);
  }

  function openEditBon(id) {
    const b = state.bons.find(x => x.id === id);
    if (!b) return;
    state.editingBonId = id;
    el('bonModalTitle').textContent = 'Modifier le bon';
    populateClientSelect(b.client_id);
    el('inputBonAmount').value = b.montant;
    el('inputBonDesc').value   = b.description;
    el('inputBonDate').value   = b.date_bon;
    openModal('addBon');
  }

  async function saveBon() {
    const client_id   = el('inputBonClient').value;
    const montant     = parseFloat(el('inputBonAmount').value);
    const description = el('inputBonDesc').value.trim();
    const date_bon    = el('inputBonDate').value;
    if (!client_id || !montant || !description || !date_bon) { toast('Remplissez tous les champs', 'error'); return; }
    if (montant <= 0) { toast('Montant invalide', 'error'); return; }
    setLoading(true);
    try {
      if (state.editingBonId) {
        const updated = await DB.updateBon(state.editingBonId, { client_id, montant, description, date_bon });
        state.bons = state.bons.map(b => b.id === state.editingBonId ? { ...b, ...updated } : b);
        toast('Bon modifié ✓', 'success');
      } else {
        const newBon = await DB.addBon({ client_id, montant, description, date_bon });
        state.bons.unshift(newBon);
        toast('Bon enregistré ✓', 'success');
      }
      closeModal('addBon');
      renderCurrentPage();
    } catch (e) { toast('Erreur : ' + e.message, 'error'); }
    setLoading(false);
  }

  async function deleteBon(id) {
    if (!confirm('Supprimer ce bon ?')) return;
    try {
      await DB.deleteBon(id);
      state.bons = state.bons.filter(b => b.id !== id);
      toast('Bon supprimé', 'success');
      renderCurrentPage();
    } catch (e) { toast('Erreur : ' + e.message, 'error'); }
  }

  // ---- Paiements ----
  function openPayment(bonId) {
    const b = state.bons.find(x => x.id === bonId);
    if (!b) return;
    state.payingBonId = bonId;
    const remaining = parseFloat(b.montant) - parseFloat(b.montant_paye);
    const pct = Math.round((parseFloat(b.montant_paye) / parseFloat(b.montant)) * 100);
    el('payRemaining').textContent = fmt(remaining);
    el('payProgressFill').style.width = pct + '%';
    el('inputPayAmount').value = '';
    el('inputPayAmount').max = remaining;
    openModal('payment');
    setTimeout(() => el('inputPayAmount').focus(), 100);
  }

  async function savePayment() {
    const montant = parseFloat(el('inputPayAmount').value);
    if (!montant || montant <= 0) { toast('Montant invalide', 'error'); return; }
    const b = state.bons.find(x => x.id === state.payingBonId);
    const remaining = parseFloat(b.montant) - parseFloat(b.montant_paye);
    if (montant > remaining + 0.01) { toast('Montant supérieur au reste dû', 'error'); return; }
    setLoading(true);
    try {
      await DB.addPaiement(state.payingBonId, montant);
      const newPaye = parseFloat(b.montant_paye) + montant;
      state.bons = state.bons.map(x => x.id === state.payingBonId ? { ...x, montant_paye: newPaye } : x);
      closeModal('payment');
      const isFullyPaid = newPaye >= parseFloat(b.montant);
      toast(isFullyPaid ? '🎉 Bon entièrement remboursé !' : 'Paiement enregistré ✓', 'success');
      if (state.viewingClientId) openClientDetail(state.viewingClientId);
      renderCurrentPage();
    } catch (e) { toast('Erreur : ' + e.message, 'error'); }
    setLoading(false);
  }

  // ---- Export PDF ----
  async function exportClientPDF(clientId) {
    const c = state.clients.find(x => x.id === clientId);
    if (!c) return;
    const bons = state.bons.filter(b => b.client_id === clientId);
    if (!bons.length) { toast('Ce client n\'a aucun bon', 'warning'); return; }
    try {
      toast('Génération du PDF...', '');
      const filename = await PDFExport.exportClientReleve(c, bons, state.boutique);
      toast('📄 PDF téléchargé : ' + filename, 'success');
    } catch (e) { toast('Erreur PDF : ' + e.message, 'error'); }
  }

  async function exportRapportGlobal() {
    if (!state.bons.length) { toast('Aucun bon à exporter', 'warning'); return; }
    try {
      toast('Génération du rapport...', '');
      const filename = await PDFExport.exportRapportGlobal(state.clients, state.bons, state.boutique);
      toast('📄 Rapport téléchargé : ' + filename, 'success');
    } catch (e) { toast('Erreur PDF : ' + e.message, 'error'); }
  }

  // ---- Auth handlers ----
  async function handleSignIn() {
    const email    = el('signInEmail').value.trim();
    const password = el('signInPassword').value;
    if (!email || !password) { toast('Remplissez tous les champs', 'error'); return; }
    setLoading(true);
    try {
      await DB.signIn(email, password);
      await loadApp();
      toast('Bienvenue !', 'success');
    } catch (e) { toast('Email ou mot de passe incorrect', 'error'); }
    setLoading(false);
  }

  async function handleSignUp() {
    const prenom   = el('signUpPrenom').value.trim();
    const boutique = el('signUpBoutique').value.trim();
    const tel      = el('signUpTel').value.trim();
    const email    = el('signUpEmail').value.trim();
    const password = el('signUpPassword').value;
    const confirm  = el('signUpConfirm').value;
    if (!prenom || !boutique || !email || !password) { toast('Remplissez tous les champs', 'error'); return; }
    if (password !== confirm) { toast('Les mots de passe ne correspondent pas', 'error'); return; }
    if (password.length < 6) { toast('Mot de passe trop court (min 6 caractères)', 'error'); return; }
    setLoading(true);
    try {
      await DB.signUp(email, password, boutique, tel);
      toast('Compte créé ! Vérifiez votre email.', 'success');
      el('tabSignin').click();
    } catch (e) { toast('Erreur : ' + e.message, 'error'); }
    setLoading(false);
  }

  async function handleSignOut() {
    if (!confirm('Déconnexion ?')) return;
    await DB.signOut();
    DB.resetBoutiqueId();
    state = { clients: [], bons: [], boutique: null, currentPage: 'dashboard', bonFilter: 'all', editingClientId: null, editingBonId: null, viewingClientId: null, payingBonId: null, loading: false };
    showAuth();
  }

  // ---- Filter bons ----
  function setBonFilter(f) {
    state.bonFilter = f;
    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    el('pill-' + f).classList.add('active');
    renderBons();
  }

  // Exposer les méthodes publiques
  return {
    init,
    showPage,
    openAddClient,
    openEditClient,
    saveClient,
    deleteClient,
    openAddBon,
    openEditBon,
    saveBon,
    deleteBon,
    openPayment,
    savePayment,
    openClientDetail,
    exportClientPDF,
    exportRapportGlobal,
    handleSignIn,
    handleSignUp,
    handleSignOut,
    syncOffline,
    setBonFilter,
    filterClients: () => renderClients(),
    filterBons: () => renderBons(),
    closeModal,
  };
})();

window.App = App;
document.addEventListener('DOMContentLoaded', App.init);
