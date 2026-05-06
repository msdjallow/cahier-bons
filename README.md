# 📒 Cahier de Bons Digital

Application web progressive (PWA) de gestion des dettes clients pour boutiquiers au Sénégal.

---

## ✅ Fonctionnalités

- 👥 **Gestion des clients** — Ajouter, modifier, supprimer, rechercher
- 📋 **Gestion des bons (dettes)** — Enregistrer, modifier, supprimer
- 💳 **Paiements partiels ou totaux** — Avec historique et barre de progression
- 📊 **Tableau de bord** — Résumé financier, clients les plus endettés, bons récents
- 📄 **Export PDF** — Relevé par client + rapport global
- 📴 **Mode hors-ligne (PWA)** — Fonctionne sans internet, synchronisation automatique
- 🔐 **Authentification sécurisée** — Chaque boutiquier a ses propres données

---

## 🚀 Déploiement en 4 étapes

### Étape 1 — Créer votre base de données Supabase (GRATUIT)

1. Allez sur [supabase.com](https://supabase.com) et créez un compte gratuit
2. Cliquez **"New Project"** → choisissez un nom (ex: `cahier-bons`) et un mot de passe fort
3. Attendez ~2 minutes que le projet se crée
4. Allez dans **SQL Editor** (menu gauche) et copiez-collez tout le contenu du fichier `supabase-schema.sql`
5. Cliquez **"Run"** → vous verrez "Success"
6. Allez dans **Settings → API** et notez :
   - **Project URL** → ressemble à `https://abcdefgh.supabase.co`
   - **anon / public key** → longue clé commençant par `eyJ...`

### Étape 2 — Configurer vos clés Supabase

Ouvrez le fichier `js/supabase.js` et remplacez :

```javascript
const SUPABASE_URL = 'https://VOTRE_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'VOTRE_ANON_KEY';
```

Par vos vraies valeurs copiées à l'étape 1.

### Étape 3 — Déployer sur Netlify (GRATUIT)

**Option A — Via GitHub (recommandé) :**
1. Créez un compte sur [github.com](https://github.com) si vous n'en avez pas
2. Créez un nouveau dépôt (repository) et uploadez tous les fichiers du projet
3. Allez sur [netlify.com](https://netlify.com) → **"Add new site" → "Import from Git"**
4. Connectez votre compte GitHub et choisissez le dépôt
5. Laissez les paramètres par défaut → cliquez **"Deploy site"**
6. Votre site est en ligne en ~1 minute ! Vous recevez un lien du type `https://votre-site.netlify.app`

**Option B — Drag & Drop (plus simple) :**
1. Allez sur [netlify.com](https://netlify.com) et connectez-vous
2. Dans le tableau de bord, faites glisser le dossier entier du projet dans la zone de dépôt
3. C'est tout ! Votre site est en ligne immédiatement

### Étape 4 — Installer sur votre téléphone (PWA)

**Sur Android (Chrome) :**
1. Ouvrez le lien de votre site dans Chrome
2. Appuyez sur les 3 points en haut à droite
3. **"Ajouter à l'écran d'accueil"**
4. L'application s'installe comme une vraie app !

**Sur iPhone (Safari) :**
1. Ouvrez le lien dans Safari
2. Appuyez sur le bouton Partager (carré avec flèche)
3. **"Sur l'écran d'accueil"**

---

## 📁 Structure des fichiers

```
cahier-bons/
├── index.html              ← Page principale (HTML)
├── manifest.json           ← Configuration PWA
├── sw.js                   ← Service Worker (mode hors-ligne)
├── netlify.toml            ← Configuration déploiement
├── supabase-schema.sql     ← Schéma base de données
├── css/
│   └── app.css             ← Styles de l'application
├── js/
│   ├── supabase.js         ← ⚠️ Mettez vos clés ici
│   ├── db.js               ← Couche base de données + offline
│   ├── pdf-export.js       ← Export PDF (jsPDF)
│   └── app.js              ← Logique principale
└── icons/
    ├── icon-192.png        ← Icône PWA (à créer)
    └── icon-512.png        ← Icône PWA grande (à créer)
```

---

## 🎨 Créer les icônes PWA

Vous avez besoin de 2 images PNG pour l'icône de l'application :
- `icons/icon-192.png` (192×192 pixels)
- `icons/icon-512.png` (512×512 pixels)

Vous pouvez utiliser [favicon.io](https://favicon.io) ou [realfavicongenerator.net](https://realfavicongenerator.net) pour les générer gratuitement.

En attendant, créez un fichier `icons/icon-192.png` vide ou utilisez n'importe quelle image carrée de 192px.

---

## 🗄️ Modèle de base de données

```
boutiques         → Une boutique par compte utilisateur
  └── clients     → Les clients de la boutique
        └── bons  → Les dettes (bons) de chaque client
              └── paiements → Historique des remboursements
```

### Sécurité (Row Level Security)
Chaque boutiquier ne peut voir et modifier **que ses propres données**. Cela est géré automatiquement par Supabase grâce aux politiques RLS définies dans le schéma SQL.

---

## 🔧 Dépannage

| Problème | Solution |
|---|---|
| "Erreur de connexion" | Vérifiez vos clés dans `js/supabase.js` |
| Données non sauvegardées | Vérifiez que le schéma SQL a bien été exécuté |
| L'app ne s'installe pas | Utilisez Chrome sur Android ou Safari sur iPhone |
| Mode hors-ligne ne fonctionne pas | Ouvrez l'app une première fois en ligne pour mettre en cache |

---

## 📞 Support

Pour toute question sur le déploiement, consultez :
- [Supabase Docs](https://supabase.com/docs)
- [Netlify Docs](https://docs.netlify.com)

---

*Cahier de Bons Digital — Conçu pour les boutiquiers sénégalais* 🇸🇳
