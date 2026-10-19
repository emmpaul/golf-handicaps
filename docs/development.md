# Development

## Prerequisites

- Node, the version in `.nvmrc`.
- pnpm, through corepack.
- `tesseract` in your `PATH` (`brew install tesseract` on macOS, `apt install tesseract-ocr` on Debian or Ubuntu). Set `TESSERACT_BIN` if the binary lives elsewhere.

## Run the app

```sh
corepack enable
pnpm install
cp .env.example .env.local   # then set APP_PASSCODE and SESSION_SECRET
pnpm db:reset                # recreates data/app.db: Gab, Manu, Sean and the reference round
pnpm dev                     # web on http://localhost:3000 and the worker, side by side
```

`pnpm dev` starts `next dev` and the worker (`tsx watch src/worker.ts`) together. Both load `.env` and `.env.local`; `.env.local` wins.

Without `GIT_COMMIT`, the version footer shows "v0.6.0" alone and `/api/version` answers `"commit": null`. That is expected in local development.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm lint` | Biome lint and format check |
| `pnpm typecheck` | Next route types, then `tsc --noEmit` |
| `pnpm test` | Unit and component tests (Vitest) |
| `pnpm e2e` | End-to-end tests (Playwright), on a production build |
| `pnpm jscpd` | Duplicate code check, must stay at 0 % |
| `pnpm check:pins` | Fails on any dependency or package manager version in `package.json` that is not exact |
| `pnpm db:migrate` | Applies migrations to the local database without wiping it |
| `pnpm db:reset` | Recreates the local database with the seed data |
| `pnpm ocr:debug` | Debugs the panel detection and OCR on one photo (below) |

The first six are the CI checks. See [CI and releases](ci.md).

### `pnpm ocr:debug`

```sh
pnpm ocr:debug <photo.jpg> [corners.json]
```

Straightens the photo from the given corners, or from local detection when there is no corners file. It then prepares and reads every cell, and writes the panel, a sheet of the cells and the draft to a temporary folder (the path is printed). It also adds the scaled-down photo with the framing drawn on it, and the values of the panel checks, which help tune detection.

Example:

```sh
pnpm ocr:debug tests/fixtures/scorecards/gspro-img3064.jpg tests/fixtures/scorecards/gspro-img3064.corners.json
```

## Production-like run with Docker

`docker-compose.yml` reproduces production: one image, two services (web and worker), one volume.

```sh
cp .env.example .env         # then set APP_PASSCODE and SESSION_SECRET
docker compose up --build --wait
APP_PASSCODE=<the code from .env> pnpm e2e:compose   # smoke test: log in, then import the reference photo
docker compose down -v       # -v also deletes the data volume
```

To get the commit into the build, as the CI does, pass `GIT_COMMIT`. Compose forwards it to the `GIT_COMMIT` build argument of the `Dockerfile`, which writes it into the build:

```sh
GIT_COMMIT=$(git rev-parse HEAD) docker compose up --build --wait
curl -s localhost:3000/api/version   # {"version":"0.6.0","commit":"<that sha>"}
```

Without it, the image answers `"commit": null`.

## DNG photos

Safari on iOS and Safari on macOS do not decode DNG photos (ProRAW, for example `IMG_3064.DNG`). The app then shows "Format de photo non lisible, exporte-la en JPEG" (unreadable photo format, export it as JPEG). Export the photo to JPEG before importing it, or shoot in HEIC or JPEG.
