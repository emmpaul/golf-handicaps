# Golf handicaps

Mini web app privée pour le groupe : import des photos de carte GSPro (OCR Tesseract en local, complétion IA facultative pour les cartes mal lues), historique des rounds, index « simulateur » de chaque joueur et coups à donner avant une partie.

Next.js (standalone) + SQLite. Une seule image Docker, deux processus : le web (`node server.js`) et le worker de lecture OCR (`node worker.js`).

**Photos DNG** : Safari iOS et Safari macOS ne décodent pas les photos DNG (ProRAW, par exemple `IMG_3064.DNG`). L'app affiche alors « Format de photo non lisible, exporte-la en JPEG ». Exporter la photo en JPEG avant l'import, ou la prendre en HEIC ou en JPEG.

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

| Variable                | Obligatoire | Rôle                                                                                    |
| ----------------------- | ----------- | --------------------------------------------------------------------------------------- |
| `APP_PASSCODE`          | oui         | Code d'accès partagé, saisi sur `/login`.                                               |
| `SESSION_SECRET`        | oui         | Secret HMAC du cookie de session, 32 caractères minimum (`openssl rand -hex 32`).       |
| `DATA_DIR`              | non         | Base `app.db` et photos `uploads/`. `./data` en local, `/data` dans l'image.            |
| `ANTHROPIC_API_KEY`     | non         | Clé de l'API Anthropic, lue par le worker seul. Absente ou vide : pas de complétion IA. |
| `AI_MONTHLY_BUDGET_USD` | non         | Plafond de dépense IA par mois civil, en dollars US (nombre > 0). Défaut : 1.           |

Le web et le worker refusent de démarrer si une variable obligatoire manque. Aucun secret n'est dans l'image : tout passe par l'environnement au démarrage.

## Complétion IA

Facultative. Sans `ANTHROPIC_API_KEY`, l'app lit les cartes en local seulement, exactement comme avant, et n'affiche aucun message sur l'IA.

**Quand** : après la lecture locale, le worker contrôle le brouillon (cases vides, sommes OUT/IN/TOT, pars, index, scores). Si tout passe, il n'appelle pas l'IA. Sinon, il fait un seul appel à Claude Opus 5.5 pour cette carte et remplace seulement les cases en problème par la valeur de l'IA. Une date ou une distance absente ne déclenche pas d'appel. Sur l'écran de correction, ces cases portent la marque « complété par l'IA », et la correction reste obligatoire avant d'enregistrer. L'appel occupe le worker 2 min au pire (60 s par tentative, une reprise).

**Ce qui part chez Anthropic** : une seule image, le panneau redressé (JPEG 1568×800 px). Il contient les prénoms des joueurs, leurs scores et le parcours. La photo d'origine reste sur le volume, et rien d'autre de l'app (index, historique, autres rounds) n'est envoyé.

**Coût** : environ 2 ¢ par carte difficile, donc moins de 0,20 $ par mois pour une dizaine de cartes. Le worker calcule le coût de chaque appel à partir de l'usage renvoyé par l'API (tarifs Opus 5.5 : 4 $ et 20 $ par million de tokens en entrée et en sortie) et l'enregistre dans la table `ai_usage`, y compris après un refus ou une réponse illisible, que l'API facture aussi.

**Plafond** : `AI_MONTHLY_BUDGET_USD`, 1 $ par défaut, par mois civil à l'heure de Montréal. Le worker n'appelle l'IA que si le cumul du mois plus le pire cas d'un appel (0,094 $) reste sous le plafond. Sinon, l'import arrive à « Prêt à vérifier » avec la lecture locale et le message « Budget IA du mois atteint ». Une erreur de l'API, un refus ou une réponse illisible donnent « Complétion IA indisponible ». L'import ne passe jamais en « Échec » à cause de l'IA.

**Limite côté Anthropic** : fixer aussi une limite de dépense mensuelle dans la console Anthropic. Elle protège si les tarifs changent avant `src/ai/pricing.ts`.

**Activer en prod** : dans Dokploy, ajouter `ANTHROPIC_API_KEY` aux variables de `golf-worker`, et `AI_MONTHLY_BUDGET_USD` pour changer le plafond, puis redéployer `golf-worker`. `golf-web` n'en a pas besoin. Retirer la clé et redéployer le worker désactive la fonction.

## Déploiement Dokploy

**CI** : `pr.yml` (chaque PR) et `main.yml` (chaque push sur `main`) appellent `.github/workflows/checks.yml`. Son premier job, `scope`, passe la liste des fichiers modifiés à `scripts/ci-scope.ts`. Si tous sont de la documentation (`openspec/`, `docs/`, `*.md`, `.release-please-manifest.json`, ou `package.json` quand seule sa `version` change), `checks / quality` ne lance que `check:pins`, commitlint et le lint, et les e2e sont sautés. La PR de release entre dans ce cas. Un autre fichier, ou un `scope` en échec, lance la suite complète.

Sur `main`, un push de documentation saute aussi le build Docker et le test de fumée compose, à une condition : l'exécution `main` du commit parent a réussi. Sinon tout tourne. La fusion de la PR de release va donc directement à release-please puis à la publication.

Les e2e tournent en trois tranches sur trois machines, `checks / e2e-shard (1)`, `(2)` et `(3)`. Le job `checks / e2e` réunit leurs résultats et échoue si une tranche échoue. La protection de `main` exige `checks / quality` et `checks / e2e`. Un job sauté compte comme réussi, donc une PR de documentation reste fusionnable.

**Releases** : à chaque push sur `main`, la CI (`.github/workflows/main.yml`) lance les contrôles puis release-please, qui tient à jour une PR de release (version, `CHANGELOG.md`). Avant 1.0, un `feat` donne une version mineure et un `fix` un patch. Fusionner cette PR crée le tag `vX.Y.Z` et publie l'image `ghcr.io/<owner>/golf-handicaps` avec les tags `vX.Y.Z`, `latest` et `<sha>`. Chaque architecture se construit sur un runner natif (`linux/amd64` sur `ubuntu-24.04`, `linux/arm64` sur `ubuntu-24.04-arm`), puis un index multi-arch réunit les deux images sous ces tags. Un simple push sur `main` ne publie aucune image.

`main` est protégée : tout changement passe par une PR, avec les contrôles CI au vert.

1. Une seule fois, avant le premier push : Settings → Actions → General → cocher **Allow GitHub Actions to create and approve pull requests**. Sans ça, release-please ne peut pas ouvrir sa PR.
2. Une seule fois : créer un PAT fine-grained limité à ce repo (Contents et Pull requests en lecture/écriture), puis l'enregistrer comme secret de repo `RELEASE_PLEASE_TOKEN`. release-please ouvre sa PR avec ce jeton, ce qui déclenche les contrôles requis (une PR ouverte avec `GITHUB_TOKEN` n'en déclenche aucun).
3. Après la première release, une seule fois : GitHub → profil → Packages → `golf-handicaps` → Package settings → Change visibility → **Public**. Dokploy tire alors l'image sans identifiants (vérifier : `docker logout ghcr.io && docker pull ghcr.io/<owner>/golf-handicaps:latest`).
4. Dans Dokploy, créer l'application `golf-web` de type Docker :
   - image `ghcr.io/<owner>/golf-handicaps:<tag>` (`vX.Y.Z` ou `latest`) ;
   - port 3000, domaine en HTTPS (le cookie de session est `Secure`) ;
   - volume nommé `golf-data` monté sur `/data` ;
   - variables `APP_PASSCODE` et `SESSION_SECRET`.
5. Créer l'application `golf-worker` : même image, **même hôte**, **même volume** `golf-data:/data`, mêmes variables, plus `ANTHROPIC_API_KEY` et `AI_MONTHLY_BUDGET_USD` si la complétion IA est voulue (voir [Complétion IA](#complétion-ia)), commande `node worker.js`, aucun port ni domaine. Les deux processus écrivent dans le même fichier SQLite : ils doivent tourner sur le même hôte.

**Déployer une release** : à la main dans Dokploy. Choisir le tag (`vX.Y.Z`, ou garder `latest`) puis redéployer **les deux** applications, `golf-web` et `golf-worker`.

Le web applique les migrations au démarrage et crée Gab, Manu et Sean sur une base vide. Le worker attend que les migrations soient en base.

**Sauvegarde** : copier tout `/data` (base `app.db` avec ses fichiers `-wal` et `-shm`, et `uploads/`), de préférence services arrêtés. Par exemple, sur l'hôte : `docker run --rm -v golf-data:/data -v "$PWD":/backup debian:trixie-slim tar czf /backup/golf-data-$(date +%F).tgz -C /data .`

**Retour arrière** : dans Dokploy, mettre le tag `vX.Y.Z` de la release précédente sur les deux applications, puis les redéployer. Les migrations de ce change sont seulement additives.
