# Spec Delta

## MODIFIED Requirements

### Requirement: Documentation détaillée sans perte
Les informations d'exploitation du README actuel (repli IA et données envoyées à Anthropic, coûts et plafond, déploiement Dokploy, sauvegarde, retour arrière, CI et releases, outils de développement) SHALL rester disponibles en anglais sous `docs/`, chaque page liée depuis la section « Documentation » du README.

#### Scenario: Données envoyées à Anthropic
- **WHEN** un visiteur cherche ce que le repli IA envoie hors du serveur
- **THEN** une page de `docs/` liée depuis le README décrit les deux images envoyées, leurs dimensions et l'absence de métadonnées EXIF, comme le README actuel

#### Scenario: Variables d'environnement
- **WHEN** un visiteur lit la section « Configuration »
- **THEN** il trouve chaque variable de `.env.example` et de l'image (`APP_PASSCODE`, `SESSION_SECRET`, `DATA_DIR`, `ANTHROPIC_API_KEY`, `AI_MONTHLY_BUDGET_USD`, `AI_BUDGET_TIME_ZONE`, `INITIAL_PLAYERS`), obligatoire ou non, avec son rôle
