# Spec Delta

## MODIFIED Requirements

### Requirement: Lecture OCR sans service externe
Le système SHALL lire la carte par OCR exécuté sur le serveur de l'app. La photo d'origine MUST NOT être envoyée à un service tiers. Seule exception : quand la lecture locale laisse des problèmes et qu'une clé d'API Anthropic est configurée, le panneau redressé peut être envoyé à l'API Claude selon la capacité `scorecard-ai-completion`. Pour la mise en page des cartes GSPro, le système SHALL lire : le nom du parcours, les tees, la date, puis pour chaque trou le par, l'index et la distance, et pour chaque ligne de joueur le nom, les 18 scores et les totaux OUT, IN et TOT.

#### Scenario: Carte de référence IMG_3064
- **WHEN** l'utilisateur importe la photo de référence `IMG_3064` et cadre le tableau
- **THEN** l'écran de correction est pré-rempli avec le parcours « BETHPAGE BLACK », les tees « Red », la date 2026-10-17, 2 lignes de joueur et les pars 4,4,3,5,4,4,5,3,4,4,4,4,5,3,4,4,3,4

#### Scenario: Aucune lecture possible
- **WHEN** l'OCR ne reconnaît aucune valeur dans le tableau, que l'IA n'est pas disponible et qu'aucune complétion n'a lieu
- **THEN** le système ouvre l'écran de correction avec toutes les cases vides à remplir à la main, la photo restant visible

#### Scenario: Photo d'origine jamais envoyée
- **WHEN** une complétion par IA est demandée pour un import
- **THEN** la photo d'origine n'est envoyée à aucun service tiers ; seul le panneau redressé est envoyé
