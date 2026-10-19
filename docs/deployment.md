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
   - variables `APP_PASSCODE` and `SESSION_SECRET`.
3. Create the `golf-worker` application:
   - same image, **same host**, **same volume** `golf-data:/data`, same variables;
   - plus `ANTHROPIC_API_KEY` and `AI_MONTHLY_BUDGET_USD` if you want the [AI fallback](ai-fallback.md);
   - command `node worker.js`, no port, no domain.

   Both processes write to the same SQLite file, so they must run on the same host.

## Deploy a release

By hand in Dokploy. Pick the tag (`vX.Y.Z`, or keep `latest`), then redeploy **both** applications, `golf-web` and `golf-worker`.

The web process applies migrations at startup and creates Gab, Manu and Sean on an empty database. The worker waits until the migrations are in the database.

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

## Backup

Copy all of `/data`: the `app.db` database with its `-wal` and `-shm` files, and `uploads/`. Stop the services first if you can. For example, on the host:

```sh
docker run --rm -v golf-data:/data -v "$PWD":/backup debian:trixie-slim \
  tar czf /backup/golf-data-$(date +%F).tgz -C /data .
```

## Rollback

Back up the volume before every deploy. To go back, set the `vX.Y.Z` tag of the previous release on both applications in Dokploy, then redeploy them.

Migration `0003` rebuilds the `imports` table and makes `corners` optional. An import sent without corners since that deploy and still queued stays stuck after a rollback, because the old worker cannot read it. You would need to write a reverse migration that sets `corners` back to NOT NULL, then re-frame those imports by hand.
