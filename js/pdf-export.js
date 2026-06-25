// js/pdf-export.js
// Export PDF des relevés clients

const PDFExport = (() => {

  function fmtAmount(n) {
    // Ajoute un espace simple tous les 3 chiffres pour éviter les slashes
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + ' FCFA';
  }

  function fmtDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  // ---- Relevé d'un client ----
  async function exportClientReleve(client, bons, boutique) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const W = 210, margin = 20;
    let y = margin;

    // Couleurs
    const GREEN = [26, 107, 74];
    const LIGHT_GREEN = [232, 245, 238];
    const RED = [214, 64, 69];
    const ORANGE = [244, 165, 38];
    const GRAY = [107, 114, 128];
    const DARK = [28, 28, 28];

    // ---- En-tête boutique ----
    doc.setFillColor(...GREEN);
    doc.rect(0, 0, W, 45, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(boutique?.nom || 'Ma Boutique', margin, 18);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (boutique?.telephone) doc.text('Tél: ' + boutique.telephone, margin, 26);
    if (boutique?.adresse) doc.text(boutique.adresse, margin, 32);

    doc.setFontSize(11);
    doc.text('RELEVÉ DE COMPTE CLIENT', W - margin, 18, { align: 'right' });
    doc.setFontSize(9);
    doc.text('Édité le ' + fmtDate(new Date()), W - margin, 26, { align: 'right' });

    y = 55;

    // ---- Infos client ----
    doc.setFillColor(...LIGHT_GREEN);
    doc.roundedRect(margin, y, W - margin * 2, 28, 3, 3, 'F');

    doc.setTextColor(...DARK);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    const fullName = [client.prenom, client.nom].filter(Boolean).join(' ');
    doc.text(fullName, margin + 8, y + 10);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    if (client.telephone) doc.text('Tél : ' + client.telephone, margin + 8, y + 18);

    // Solde total
    const totalDu = bons.reduce((s, b) => s + (parseFloat(b.montant) - parseFloat(b.montant_paye)), 0);
    const totalBons = bons.reduce((s, b) => s + parseFloat(b.montant), 0);
    const totalPaye = bons.reduce((s, b) => s + parseFloat(b.montant_paye), 0);

    doc.setTextColor(...(totalDu > 0 ? RED : GREEN));
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(fmtAmount(totalDu), W - margin - 8, y + 10, { align: 'right' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text('Solde dû', W - margin - 8, y + 18, { align: 'right' });

    y += 38;

    // ---- Résumé chiffres ----
    const colW = (W - margin * 2) / 3;
    const metrics = [
      { label: 'Total emprunté', value: fmtAmount(totalBons), color: DARK },
      { label: 'Total remboursé', value: fmtAmount(totalPaye), color: GREEN },
      { label: 'Reste à payer', value: fmtAmount(totalDu), color: totalDu > 0 ? RED : GREEN }
    ];

    metrics.forEach((m, i) => {
      const x = margin + i * colW;
      doc.setFillColor(248, 247, 245);
      doc.rect(x, y, colW - 4, 20, 'F');
      doc.setTextColor(...m.color);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(m.value, x + colW / 2 - 2, y + 9, { align: 'center' });
      doc.setTextColor(...GRAY);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(m.label, x + colW / 2 - 2, y + 16, { align: 'center' });
    });

    y += 30;

    // ---- Tableau des bons ----
    doc.setTextColor(...DARK);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Détail des bons', margin, y);
    y += 6;

    // En-tête tableau
    doc.setFillColor(...GREEN);
    doc.rect(margin, y, W - margin * 2, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');

    const cols = [
      { label: 'Date', x: margin + 3, w: 25 },
      { label: 'Description', x: margin + 28, w: 60 },
      { label: 'Montant', x: margin + 88, w: 30, alignRight: true },
      { label: 'Payé', x: margin + 118, w: 28, alignRight: true },
      { label: 'Reste', x: margin + 146, w: 28, alignRight: true },
      { label: 'Statut', x: margin + 175, w: 15 }
    ];

    cols.forEach(c => {
      if (c.alignRight) {
        doc.text(c.label, c.x + c.w, y + 5.5, { align: 'right' });
      } else {
        doc.text(c.label, c.x, y + 5.5);
      }
    });
    y += 8;

    // Lignes
    bons.sort((a, b) => new Date(b.date_bon) - new Date(a.date_bon)).forEach((bon, idx) => {
      if (y > 265) {
        doc.addPage();
        y = margin;
      }
      const remaining = parseFloat(bon.montant) - parseFloat(bon.montant_paye);
      const isFullyPaid = remaining <= 0;
      const isPartial = parseFloat(bon.montant_paye) > 0 && !isFullyPaid;

      // Alternance de couleur
      if (idx % 2 === 0) {
        doc.setFillColor(248, 247, 245);
        doc.rect(margin, y, W - margin * 2, 9, 'F');
      }

      doc.setTextColor(...DARK);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(fmtDate(bon.date_bon).replace(' 2025', '').replace(' 2024', '').replace(' 2026', ''), cols[0].x, y + 6);

      const desc = bon.description.length > 30 ? bon.description.substring(0, 28) + '...' : bon.description;
      doc.text(desc, cols[1].x, y + 6);

      doc.text(fmtAmount(bon.montant), cols[2].x + cols[2].w, y + 6, { align: 'right' });

      doc.setTextColor(...GREEN);
      doc.text(fmtAmount(bon.montant_paye), cols[3].x + cols[3].w, y + 6, { align: 'right' });

      doc.setTextColor(...(isFullyPaid ? GREEN : RED));
      doc.text(fmtAmount(remaining), cols[4].x + cols[4].w, y + 6, { align: 'right' });

      // Badge statut
      if (isFullyPaid) {
        doc.setFillColor(...GREEN);
        doc.setTextColor(255, 255, 255);
        doc.text('✓', cols[5].x + 4, y + 6);
      } else if (isPartial) {
        doc.setTextColor(...ORANGE);
        doc.text('~', cols[5].x + 4, y + 6);
      } else {
        doc.setTextColor(...RED);
        doc.text('✗', cols[5].x + 4, y + 6);
      }

      y += 9;
    });

    // Ligne totale
    y += 4;
    doc.setFillColor(...GREEN);
    doc.rect(margin, y, W - margin * 2, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL', margin + 3, y + 7);
    doc.text(fmtAmount(totalBons), cols[2].x + cols[2].w, y + 7, { align: 'right' });
    doc.text(fmtAmount(totalPaye), cols[3].x + cols[3].w, y + 7, { align: 'right' });
    doc.text(fmtAmount(totalDu), cols[4].x + cols[4].w, y + 7, { align: 'right' });

    y += 20;

    // ---- Pied de page ----
    doc.setTextColor(...GRAY);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Cahier de Bons Digital — Document généré automatiquement', W / 2, 287, { align: 'center' });
    doc.text('Page 1', W - margin, 287, { align: 'right' });

    // Sauvegarde
    const filename = `releve_${client.nom}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
    return filename;
  }

  // ---- Rapport global boutique ----
  async function exportRapportGlobal(clients, bons, boutique) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const W = 210, margin = 20;
    let y = margin;
    const GREEN = [26, 107, 74];
    const RED = [214, 64, 69];
    const GRAY = [107, 114, 128];
    const DARK = [28, 28, 28];

    // En-tête
    doc.setFillColor(...GREEN);
    doc.rect(0, 0, W, 45, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(boutique?.nom || 'Ma Boutique', margin, 18);
    doc.setFontSize(12);
    doc.text('RAPPORT GLOBAL DES DETTES', W - margin, 18, { align: 'right' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Édité le ' + fmtDate(new Date()), W - margin, 26, { align: 'right' });

    y = 55;

    // Stats globales
    const totalDu = bons.reduce((s, b) => s + (parseFloat(b.montant) - parseFloat(b.montant_paye)), 0);
    const totalBons = bons.reduce((s, b) => s + parseFloat(b.montant), 0);
    const totalPaye = bons.reduce((s, b) => s + parseFloat(b.montant_paye), 0);
    const clientsEndettes = clients.filter(c =>
      bons.some(b => b.client_id === c.id && parseFloat(b.montant) - parseFloat(b.montant_paye) > 0)
    ).length;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text('Vue d\'ensemble', margin, y);
    y += 8;

    const colW = (W - margin * 2) / 4;
    [
      { label: 'Total dettes', value: fmtAmount(totalBons) },
      { label: 'Total remboursé', value: fmtAmount(totalPaye) },
      { label: 'Reste dû', value: fmtAmount(totalDu) },
      { label: 'Clients endettés', value: clientsEndettes + ' clients' }
    ].forEach((m, i) => {
      const x = margin + i * colW;
      doc.setFillColor(232, 245, 238);
      doc.rect(x, y, colW - 3, 18, 'F');
      doc.setTextColor(...GREEN);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(m.value, x + colW / 2 - 2, y + 8, { align: 'center' });
      doc.setTextColor(...GRAY);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(m.label, x + colW / 2 - 2, y + 14, { align: 'center' });
    });
    y += 28;

    // Tableau clients
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text('Détail par client', margin, y);
    y += 6;

    doc.setFillColor(...GREEN);
    doc.rect(margin, y, W - margin * 2, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Client', margin + 3, y + 5.5);
    doc.text('Téléphone', margin + 60, y + 5.5);
    doc.text('Bons', margin + 105, y + 5.5);
    doc.text('Total dû', margin + 135, y + 5.5, { align: 'right' });
    doc.text('Payé', margin + 160, y + 5.5, { align: 'right' });
    doc.text('Reste', margin + 180, y + 5.5, { align: 'right' });
    y += 8;

    const clientsSorted = clients
      .map(c => {
        const cBons = bons.filter(b => b.client_id === c.id);
        const du = cBons.reduce((s, b) => s + parseFloat(b.montant) - parseFloat(b.montant_paye), 0);
        const total = cBons.reduce((s, b) => s + parseFloat(b.montant), 0);
        const paye = cBons.reduce((s, b) => s + parseFloat(b.montant_paye), 0);
        return { ...c, du, total, paye, nbBons: cBons.length };
      })
      .filter(c => c.nbBons > 0)
      .sort((a, b) => b.du - a.du);

    clientsSorted.forEach((c, idx) => {
      if (y > 265) { doc.addPage(); y = margin; }
      if (idx % 2 === 0) {
        doc.setFillColor(248, 247, 245);
        doc.rect(margin, y, W - margin * 2, 8, 'F');
      }
      doc.setTextColor(...DARK);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const name = [c.prenom, c.nom].filter(Boolean).join(' ');
      doc.text(name.substring(0, 22), margin + 3, y + 5.5);
      doc.text(c.telephone || '-', margin + 60, y + 5.5);
      doc.text(String(c.nbBons), margin + 105, y + 5.5);
      doc.text(fmtAmount(c.total), margin + 135, y + 5.5, { align: 'right' });
      
      doc.setTextColor(...GREEN);
      doc.text(fmtAmount(c.paye), margin + 160, y + 5.5, { align: 'right' });
      
      doc.setTextColor(...(c.du > 0 ? RED : GREEN));
      doc.text(fmtAmount(c.du), margin + 180, y + 5.5, { align: 'right' });
      y += 8;
    });

    doc.setTextColor(...GRAY);
    doc.setFontSize(7);
    doc.text('Cahier de Bons Digital — Rapport généré automatiquement', W / 2, 287, { align: 'center' });

    const filename = `rapport_global_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
    return filename;
  }

  return { exportClientReleve, exportRapportGlobal };
})();

window.PDFExport = PDFExport;
