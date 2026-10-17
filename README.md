# Golf handicaps

Mini web app privée pour le groupe : import des photos de carte GSPro (OCR Tesseract, sans IA), historique des rounds, index « simulateur » de chaque joueur et coups à donner avant une partie.

Next.js (standalone) + SQLite. Une seule image Docker, deux processus : le web (`node server.js`) et le worker de lecture OCR (`node worker.js`).

## Développement local

Prérequis : Node (version de `.nvmrc`), pnpm via corepack, `tesseract` dans le `PATH` (`brew install tesseract`).

```sh
corepack enable
pnpm install
cp .env.example .env.local   # puis renseigner APP_PASSCODE et SESSION_SECRET
pnpm db:reset                # recrée data/app.db : Gab, Manu, Sean et le round de référence
pnpm dev                     # web sur http://localhost:3000 + worker, en parallèle
```

Outils :

- `pnpm ocr:debug <photo.jpg> <coins.json>` : redresse la photo, prépare et lit chaque case, puis écrit le panneau, la planche des cases et le brouillon dans un dossier temporaire (chemin affiché). Exemple : `pnpm ocr:debug tests/fixtures/scorecards/gspro-img3064.jpg tests/fixtures/scorecards/gspro-img3064.corners.json`.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm e2e`, `pnpm jscpd`, `pnpm check:pins` : les contrôles de la CI.
- `pnpm db:migrate` : applique les migrations sur la base locale sans la vider.

Reproduire la prod en local avec Docker :

```sh
cp .env.example .env         # puis renseigner APP_PASSCODE et SESSION_SECRET
docker compose up --build --wait
APP_PASSCODE=<le code du .env> pnpm e2e:compose   # test de fumée : connexion + import de la photo de référence
docker compose down -v       # -v supprime aussi le volume de données
```

## Variables d'environnement

| Variable         | Obligatoire | Rôle                                                                                     |
| ---------------- | ----------- | ---------------------------------------------------------------------------------------- |
| `APP_PASSCODE`   | oui         | Code d'accès partagé, saisi sur `/login`.                                                |
| `SESSION_SECRET` | oui         | Secret HMAC du cookie de session, 32 caractères minimum (`openssl rand -hex 32`).        |
| `DATA_DIR`       | non         | Base `app.db` et photos `uploads/`. `./data` en local, `/data` dans l'image.             |

Le web et le worker refusent de démarrer si une variable obligatoire manque. Aucun secret n'est dans l'image : tout passe par l'environnement au démarrage.

## Déploiement Dokploy

**Releases** : à chaque push sur `main`, la CI (`.github/workflows/main.yml`) lance les contrôles puis release-please, qui tient à jour une PR de release (version, `CHANGELOG.md`). Avant 1.0, un `feat` donne une version mineure et un `fix` un patch. Fusionner cette PR crée le tag `vX.Y.Z` et publie l'image `ghcr.io/<owner>/golf-handicaps` avec les tags `vX.Y.Z`, `latest` et `<sha>`. Un simple push sur `main` ne publie aucune image.

1. Une seule fois, avant le premier push : Settings → Actions → General → cocher **Allow GitHub Actions to create and approve pull requests**. Sans ça, release-please ne peut pas ouvrir sa PR.
2. Après la première release, une seule fois : GitHub → profil → Packages → `golf-handicaps` → Package settings → Change visibility → **Public**. Dokploy tire alors l'image sans identifiants (vérifier : `docker logout ghcr.io && docker pull ghcr.io/<owner>/golf-handicaps:latest`).
3. Dans Dokploy, créer l'application `golf-web` de type Docker :
   - image `ghcr.io/<owner>/golf-handicaps:<tag>` (`vX.Y.Z` ou `latest`) ;
   - port 3000, domaine en HTTPS (le cookie de session est `Secure`) ;
   - volume nommé `golf-data` monté sur `/data` ;
   - variables `APP_PASSCODE` et `SESSION_SECRET`.
4. Créer l'application `golf-worker` : même image, **même hôte**, **même volume** `golf-data:/data`, mêmes variables, commande `node worker.js`, aucun port ni domaine. Les deux processus écrivent dans le même fichier SQLite : ils doivent tourner sur le même hôte.

**Déployer une release** : à la main dans Dokploy. Choisir le tag (`vX.Y.Z`, ou garder `latest`) puis redéployer **les deux** applications, `golf-web` et `golf-worker`.

Le web applique les migrations au démarrage et crée Gab, Manu et Sean sur une base vide. Le worker attend que les migrations soient en base.

**Sauvegarde** : copier tout `/data` (base `app.db` avec ses fichiers `-wal` et `-shm`, et `uploads/`), de préférence services arrêtés. Par exemple, sur l'hôte : `docker run --rm -v golf-data:/data -v "$PWD":/backup debian:trixie-slim tar czf /backup/golf-data-$(date +%F).tgz -C /data .`

**Retour arrière** : dans Dokploy, mettre le tag `vX.Y.Z` de la release précédente sur les deux applications, puis les redéployer. Les migrations de ce change sont seulement additives.
