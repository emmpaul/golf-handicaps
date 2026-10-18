# Design

## Context

Motivation : voir `proposal.md`. Comportements : voir `specs/scorecard-import/spec.md`.

État actuel :
- `ImportFlow` (`src/components/import/import-flow.tsx`) rend un `Input type="file" accept="image/*"`, `id="photo"`, libellé « Photo de la carte ». `onChange` appelle `choose(file)` puis vide le champ (`value = ""`) pour qu'on puisse rechoisir le même fichier.
- `choose` passe le fichier à `decodePhoto` (`createImageBitmap`, réencodage JPEG, 3000 px au plus sur le grand côté). En cas d'échec : « Format de photo non lisible, exporte-la en JPEG ». Sinon : écran de cadrage (`CropSteps`).
- Sur iPhone, un champ `accept="image/*"` sans `capture` ouvre un menu « Photothèque / Prendre une photo / Choisir le fichier ».
- E2e : `import-photo.spec.ts` et le helper `choosePhoto` (`tests/e2e/import.ts`) ciblent `getByLabel("Photo de la carte")`. Le projet `webkit-iphone` (iPhone 15) ne lance que les fichiers de `MOBILE_SPECS`.
- La carte est photographiée sur un écran de simulateur : moirage et reflets jouent sur la lecture OCR, la qualité de la photo compte.

## Goals / Non-Goals

**Goals :**
- Un toucher de moins par carte sur téléphone, sans perte de qualité de la photo.
- Zéro changement en aval : même `choose`, même cadrage, même envoi.

**Non-Goals :**
- Un viseur dans la page avec un cadre de visée sur le panneau. Voir décision 1 et Open Questions.
- Plusieurs photos d'une seule prise de vue.
- Choisir la caméra avant ou arrière.

## Decisions

### 1. `<input type="file" capture="environment">`, pas `getUserMedia`
Un deuxième champ fichier, `accept="image/*" capture="environment"`. Sur iOS Safari et Android Chrome, il ouvre directement l'appareil photo du système, caméra arrière, et rend un `File` comme le champ actuel.

Pourquoi pas un aperçu en direct avec `navigator.mediaDevices.getUserMedia` :
- **Qualité** : la photo serait une image de la vidéo (souvent 1920 × 1080, au mieux 4K selon les contraintes acceptées), sans le traitement de l'appareil photo d'iOS (HDR, réduction du bruit, mise au point au toucher). L'API `ImageCapture`, qui donnerait une vraie photo, n'existe pas sur Safari. Pour un écran photographié, avec du moirage, l'appareil photo natif lit mieux.
- **iOS Safari** : demande d'autorisation caméra à chaque visite tant que l'utilisateur n'a pas changé le réglage du site ; contexte sécurisé obligatoire (HTTPS) ; flux qui s'arrête quand l'app passe en arrière-plan et qu'il faut relancer ; vidéo qui doit être `playsinline` et `muted` pour ne pas passer en plein écran.
- **Code** : cycle de vie du flux, arrêt des pistes, rotation, choix de la caméra, cas « autorisation refusée » avec repli sur le fichier. Tout ça pour un seul bouton.
- **Tests** : WebKit dans Playwright n'a pas de fausse caméra ; Chromium en a une avec des options de lancement. Le projet `webkit-iphone` ne pourrait pas tester la prise de vue.

`capture` ne demande aucune autorisation, marche en HTTP comme en HTTPS, et se teste comme le champ actuel avec `setInputFiles`.
*Ce qu'on perd* : pas de cadre de visée par-dessus l'image. Le cadrage des 4 coins, après coup, reste l'étape qui rattrape une photo de biais.

### 2. Deux champs, pas un seul
« Photo de la carte » reste tel quel. On ajoute « Prendre une photo » à côté.
*Alternative* : ajouter `capture` au champ existant, écartée. Sur iPhone, `capture` supprime l'accès à la photothèque : plus moyen d'importer une photo déjà prise.

### 3. Rendu du bouton
- Un `<label>` avec le style de `buttonVariants({ size: "lg" })` et une icône `CameraIcon` de lucide, qui enveloppe un `<input type="file" accept="image/*" capture="environment" className="sr-only">`. Le champ garde le focus clavier et le nom accessible « Prendre une photo » ; `getByLabel("Prendre une photo")` le trouve.
- Même `onChange` que « Photo de la carte » : `choose(file)` puis `value = ""`. Une fonction partagée `pickFrom(event)` évite la duplication (jscpd).
- Annuler la prise de vue ne déclenche pas `change` (ou le déclenche sans fichier) : `choose(undefined)` ne fait déjà rien.
- Visible seulement avec un pointeur grossier : classes `hidden pointer-coarse:inline-flex` (variante Tailwind v4 sur `@media (pointer: coarse)`). Rien en JavaScript, donc pas d'écart entre rendu serveur et client.
- Ordre : « Prendre une photo » d'abord, puis le champ « Photo de la carte » avec sa description actuelle.

### 4. Tests
- E2e WebKit iPhone (`camera-capture.spec.ts`, ajouté à `MOBILE_SPECS`) : le bouton est visible, son champ a `capture="environment"` et `accept="image/*"`, et `setInputFiles` de la photo de référence mène à « Carte à cadrer ». La prise de vue elle-même relève de l'appareil photo d'iOS, hors de portée de Playwright : elle passe en vérification humaine (tâche 5.1).
- E2e Chromium bureau : le bouton n'est pas visible et « Photo de la carte » l'est.

## Risks / Trade-offs

- [WebKit de Playwright n'émule pas `pointer: coarse` pour l'iPhone 15] → contrôlé en premier (tâche 2.1). Si le média ne répond pas, le test de visibilité passe par un contexte Chromium `{ hasTouch: true, isMobile: true }`, et le test WebKit garde le chemin `setInputFiles`.
- [Tablette ou ordinateur tactile avec souris] → `pointer: coarse` décrit le pointeur principal ; un portable tactile avec pavé tactile ne voit pas le bouton, ce qui convient (il garde le champ fichier).
- [Orientation de la photo prise] → `createImageBitmap` applique l'orientation EXIF par défaut, comme pour les photos choisies aujourd'hui ; vérifié sur le téléphone en 5.1.
- [Photo de 12 Mpx ou plus] → déjà réduite à 3000 px par `decodePhoto`.

## Migration Plan

Rien côté serveur ni base. Déploiement normal de l'image. Retour arrière : redéployer le tag précédent.

## Open Questions

- Le cadre de visée en direct vaut-il le coût de `getUserMedia` plus tard, si les photos prises au bouton se cadrent mal ? À juger après quelques semaines d'usage.
- Libellé : « Prendre une photo » ou « Photographier la carte » ? Changer le texte ne change ni l'approche ni les tâches (seule la valeur attendue des tests suit).
