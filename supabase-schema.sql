-- ============================================
-- CAHIER DE BONS DIGITAL - Schéma Supabase
-- Copiez et exécutez dans Supabase SQL Editor
-- ============================================

-- 1. Table boutiques (un compte = une boutique)
CREATE TABLE boutiques (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nom TEXT NOT NULL,
  telephone TEXT,
  adresse TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table clients
CREATE TABLE clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  boutique_id UUID REFERENCES boutiques(id) ON DELETE CASCADE NOT NULL,
  nom TEXT NOT NULL,
  prenom TEXT,
  telephone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Table bons (dettes)
CREATE TABLE bons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  boutique_id UUID REFERENCES boutiques(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  montant DECIMAL(12,2) NOT NULL CHECK (montant > 0),
  montant_paye DECIMAL(12,2) DEFAULT 0 CHECK (montant_paye >= 0),
  description TEXT NOT NULL,
  date_bon DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Table paiements (historique)
CREATE TABLE paiements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bon_id UUID REFERENCES bons(id) ON DELETE CASCADE NOT NULL,
  boutique_id UUID REFERENCES boutiques(id) ON DELETE CASCADE NOT NULL,
  montant DECIMAL(12,2) NOT NULL CHECK (montant > 0),
  date_paiement DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SÉCURITÉ : Row Level Security (RLS)
-- Chaque boutiquier ne voit QUE ses données
-- ============================================

ALTER TABLE boutiques ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE bons ENABLE ROW LEVEL SECURITY;
ALTER TABLE paiements ENABLE ROW LEVEL SECURITY;

-- Policies boutiques
CREATE POLICY "Voir sa propre boutique" ON boutiques
  FOR ALL USING (auth.uid() = user_id);

-- Policies clients
CREATE POLICY "Voir clients de sa boutique" ON clients
  FOR ALL USING (
    boutique_id IN (SELECT id FROM boutiques WHERE user_id = auth.uid())
  );

-- Policies bons
CREATE POLICY "Voir bons de sa boutique" ON bons
  FOR ALL USING (
    boutique_id IN (SELECT id FROM boutiques WHERE user_id = auth.uid())
  );

-- Policies paiements
CREATE POLICY "Voir paiements de sa boutique" ON paiements
  FOR ALL USING (
    boutique_id IN (SELECT id FROM boutiques WHERE user_id = auth.uid())
  );

-- ============================================
-- TRIGGER : mise à jour automatique updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bons_updated_at
  BEFORE UPDATE ON bons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- INDEX pour performance
-- ============================================
CREATE INDEX idx_clients_boutique ON clients(boutique_id);
CREATE INDEX idx_bons_boutique ON bons(boutique_id);
CREATE INDEX idx_bons_client ON bons(client_id);
CREATE INDEX idx_paiements_bon ON paiements(bon_id);
