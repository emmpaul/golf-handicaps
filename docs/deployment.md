# Deployment

The production setup runs on [Dokploy](https://dokploy.com), from the image the CI publishes to GitHub Container Registry: `ghcr.io/emmpaul/golf-handicaps`. Any Docker host works the same way: one image, two containers, one volume.

## Image

Merging a release PR publishes the image with the tags `vX.Y.Z`, `latest` and `<sha>`, for `linux/amd64` and `linux/arm64`. See [CI and releases](ci.md) for how releases are built.

The image holds no secret: everything comes from the environment at startup. The variables are listed in the [Configuration](../README.md#configuration) section of the README.

## First setup

1. After the first release, once: GitHub → profile → Packages → `golf-handicaps` → Package settings → Change visibility → **Public**. Dokploy then pulls the image without credentials. Check with `docker logout ghcr.io && docker pull ghcr.io/emmpaul/golf-handicaps:latest`.
2. In Dokploy, create the `golf-web` application, of type Docker:
   - image `ghcr.io/emmpaul/golf-handicaps:<tag>` (`vX.Y.Z` or `latest`);
   - port 3000, HTTPS domain (the session cookie is `Secure`);
   - named volume `golf-data` mounted on `/data`;
   - variables `APP_PASSCODE` and `SESSION_SECRET`;
   - on a new install, `INITIAL_PLAYERS` with the group's first names, for example `INITIAL_PLAYERS=Manu,Gab,Sean`. Without it the database starts with no player, and you add them on `/players`.
3. Create the `golf-worker` application:
   - same image, **same host**, **same volume** `golf-data:/data`, same variables;
   - plus `ANTHROPIC_API_KEY`, `AI_MONTHLY_BUDGET_USD` and `AI_BUDGET_TIME_ZONE` if you want the [AI fallback](ai-fallback.md);
   - `SGT_LOOKUP=off` if the worker must make no request to Simulator Golf Tour (see [Outgoing requests](#outgoing-requests));
   - command `node worker.js`, no port, no domain;
   - the health check from [Worker health](#worker-health).

   Both processes write to the same SQLite file, so they must run on the same host.

## Deploy a release

By hand in Dokploy. Pick the tag (`vX.Y.Z`, or keep `latest`), then redeploy **both** applications, `golf-web` and `golf-worker`.

The web process applies migrations at startup. On a database with no player, it creates the players listed in `INITIAL_PLAYERS`, or none if the variable is missing or empty. A database that already has players is left alone, so `INITIAL_PLAYERS` does nothing on an existing install. The worker waits until the migrations are in the database.

## Outgoing requests

The web process makes no outgoing request. The worker makes two kinds, and only these:

- to `api.anthropic.com`, when `ANTHROPIC_API_KEY` is set (see [AI fallback](ai-fallback.md));
- to `simulatorgolftour.com`, when `SGT_LOOKUP` is `on`, the default: the course list page `https://simulatorgolftour.com/courses` (about 665 KB, kept in the worker's memory for 24 h) and one scorecard image per course searched, `https://simulatorgolftour.com/public/assets/courseImages/scorecards/scorecard_<id>.jpg`. The scorecard is downloaded only when the AI can read it, so a worker without a key fetches the list alone. Each request sends `User-Agent: golf-handicaps (+https://github.com/emmpaul/golf-handicaps)` and gives up after 20 s.

A search starts for each new course and tees, and once at the first startup after the update for the courses already played. That is a handful of requests a month for one group. The worker must be able to reach both hosts over HTTPS. Behind a firewall that blocks them, a failed SGT request is retried once, then the course shows "SGT injoignable" (SGT unreachable) and its rating is entered by hand on `/courses`.

With `SGT_LOOKUP=off` the worker contacts SGT for nothing. Each course search stops with "Recherche SGT désactivée" (SGT lookup off), and ratings are entered by hand. The e2e tests and the CI compose run use `off`.

## Worker health

The worker writes a heartbeat, the current time in milliseconds, to `/tmp/golf-worker-heartbeat` at the start of every turn of its loop (`src/jobs/heartbeat.ts`). With an empty queue that is once a second. It also beats while it waits for the migrations, and right after each job. The file lives in the container's `/tmp`, not on the volume, so a new container never sees the heartbeat of the old one.

The health check reads that file and fails when the heartbeat is 5 minutes old or more, or when the file is missing. Five minutes is `STALE_AFTER_MS` in `src/jobs/queue.ts`, the age after which the queue already takes back a stuck job. A long job, OCR then a Claude call of up to about 120 s, stays under it.

In `docker-compose.yml`, the `worker` service runs this check every 30 s (timeout 5 s, 3 retries, 30 s start period), so `docker compose up --wait` also waits for a healthy worker. Compose does not restart an `unhealthy` container. Dokploy (Swarm) does.

In Dokploy, open `golf-worker` → Advanced → Swarm Settings → Health Check, and enter the same command with the same timings. Swarm takes the durations in nanoseconds:

```json
{
  "Test": [
    "CMD",
    "node",
    "-e",
    "try { const t = Number(require('fs').readFileSync('/tmp/golf-worker-heartbeat', 'utf8')); process.exit(Date.now() - t < 300000 ? 0 : 1) } catch { process.exit(1) }"
  ],
  "Interval": 30000000000,
  "Timeout": 5000000000,
  "Retries": 3,
  "StartPeriod": 30000000000
}
```

Then redeploy `golf-worker`. The command must stay identical to the one in `docker-compose.yml`. If you change the threshold, change `STALE_AFTER_MS` too.

## Course ratings update

The release that adds course ratings (migration `0004`) changes no number by itself:

1. Back up the volume, then redeploy `golf-web` and `golf-worker`. The web applies `0004`, then queues one rating search per known course and tees. Its log shows "Recherches de rating mises en file : N", 6 on the current production database. The worker picks the searches up once it sees the migration.
2. Until a rating is confirmed, every differential, index, playing handicap and net leaderboard stays the same.
3. Open `/courses` (the "Parcours" link at the top of the rounds list). Check that the SGT course shown ("SGT : <name> · <location>") is the right one and each proposal matches its SGT scorecard, then confirm it, or enter the values by hand. Each confirmation recomputes the history of every player who played that course, so the numbers change course by course.

To roll back, see [Rollback](#rollback).

## Check what is running

`GET /api/version` answers without a session:

```sh
curl -si https://<your-domain>/api/version
```

```http
HTTP/2 200
cache-control: no-store
content-type: application/json

{"version":"0.6.0","commit":"4794e1b0c0ffee00000000000000000000000000"}
```

- `version` is the app version from `package.json`, without the `v` prefix. It should match the tag you deployed.
- `commit` is the full sha of the commit the image was built from. Images built by the CI always carry it. An image built without the `GIT_COMMIT` build argument (for example `docker build .` by hand) answers `"commit": null`.
- The response is sent with `Cache-Control: no-store`, so a proxy does not serve the previous version right after a deploy.

The same version shows at the bottom of every page, for example "v0.6.0 · 4794e1b", linked to the GitHub release.

## Close every session

"Se déconnecter" on the home page closes the session of that browser only. The session token is signed and holds no server-side state, so the app cannot revoke one session on its own. To close every session on every device, set a new `SESSION_SECRET` (for example `openssl rand -hex 32`) on both `golf-web` and `golf-worker`, then redeploy both. Everyone then enters the passcode again.

## Backup

Copy all of `/data`: the `app.db` database with its `-wal` and `-shm` files, and `uploads/`. Stop the services first if you can. For example, on the host:

```sh
docker run --rm -v golf-data:/data -v "$PWD":/backup debian:trixie-slim \
  tar czf /backup/golf-data-$(date +%F).tgz -C /data .
```

## Rollback

Back up the volume before every deploy. To go back, set the `vX.Y.Z` tag of the previous release on both applications in Dokploy, then redeploy them.

A version without the worker heartbeat (v0.7.0 and earlier) writes no `/tmp/golf-worker-heartbeat`, so its worker would turn `unhealthy` and Swarm would restart it again and again. When you roll back to such a version, remove the health check from `golf-worker` in Dokploy before redeploying it.

Migration `0004` adds the `course_ratings` table and changes nothing else. A previous version ignores it, so the rollback itself needs no step. The numbers are another matter. After a rollback, net leaderboards go back at once to the rounded index, since they are computed at display time. Differentials and indexes are stored per player, and the old version only recomputes a player's history when it saves, corrects or deletes a round with that player. Until then, a player who played a rated course keeps the differentials and indexes computed with its rating.

Migration `0003` rebuilds the `imports` table and makes `corners` optional. An import sent without corners since that deploy and still queued stays stuck after a rollback, because the old worker cannot read it. You would need to write a reverse migration that sets `corners` back to NOT NULL, then re-frame those imports by hand.
