# worker-health Specification

## Purpose

Rendre visible à l'orchestrateur (Docker Compose, Dokploy) un worker qui ne traite plus la file, pour qu'un import en attente ne reste pas bloqué sans que rien ne vire au rouge.

## Requirements

### Requirement: Signal de vie du worker
Le worker SHALL signaler qu'il tourne à chaque tour de sa boucle, que la file soit vide, qu'il attende les migrations ou qu'il vienne de finir un job. Le signal MUST rester propre au conteneur du worker : un signal laissé par un conteneur précédent ou par le web ne compte pas.

#### Scenario: File vide
- **WHEN** le worker tourne depuis 10 minutes sans aucun job dans la file
- **THEN** son signal date de moins de 5 secondes

#### Scenario: En attente des migrations
- **WHEN** le worker démarre avant que le web ait appliqué les migrations
- **THEN** il signale qu'il tourne pendant qu'il attend

#### Scenario: Nouveau conteneur
- **WHEN** un nouveau conteneur worker démarre sur le volume d'un ancien
- **THEN** il ne reprend aucun signal de l'ancien conteneur

### Requirement: Worker vu malade quand il se fige
Le service worker de `docker-compose.yml` SHALL avoir un healthcheck qui le déclare sain tant que son dernier signal a moins de 5 minutes, et malade au-delà ou sans signal. Pendant le démarrage, le healthcheck MUST laisser au worker le temps d'émettre un premier signal.

#### Scenario: Worker sain au démarrage
- **WHEN** l'opérateur lance `docker compose up --wait` avec une configuration valide
- **THEN** la commande rend la main avec les services `web` et `worker` tous deux sains

#### Scenario: Job figé
- **WHEN** un job reste bloqué plus de 5 minutes sans rendre la main à la boucle du worker
- **THEN** `docker compose ps` montre le service `worker` en `unhealthy`

#### Scenario: Job long mais fini
- **WHEN** un job dure 2 minutes (lecture OCR puis complétion par IA) puis se termine
- **THEN** le service `worker` reste sain
