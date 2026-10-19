# Roadmap

What is being built, what comes next, and what was turned down, drawn from the OpenSpec changes, the code and the open questions in past designs.

Last updated: 2026-10-18.

Nothing here is a promise. The app serves one group of friends first, and the order below can change with what they need.

## Next

### Ops and deployment

- **Make the first players configurable.** On an empty database the web process creates Manu, Gab and Sean (`src/server/players/seed.ts`, spec `players`, "Joueurs initiaux"). Another group self-hosting the image gets three strangers. An environment variable, or no seed at all in production, would fix it.
- **Make the AI budget month configurable.** `src/ai/budget.ts` counts the month in `America/Montreal`. A group in another time zone sees the budget reset a few hours off.
- **Check the worker's health.** `docker-compose.yml` has a healthcheck on `web` only. A worker that hangs leaves imports queued and nothing turns red.
- **Add a logout.** The session cookie lasts 90 days (`src/lib/auth/session.ts`) and the app has no way to end it. Revoking everyone means rotating `SESSION_SECRET`.

### Quality and CI

- **Finish the on-device checks.** Several archived changes still have unchecked manual tasks on the phone: calendar vs native date wheel (`2026-10-17-add-calendar-date-input`, task 7.1), camera orientation (`add-camera-capture`, 5.1), autosave across devices (`add-correction-autosave`, 9.1), orbs in reduced motion (`add-thinking-orb-loaders`, 9.1), WebP photos (`store-photos-as-webp`, 4.3), safe areas and the two bottom bars (`polish-mobile-ui`, 9.1). Some of the items below depend on what these checks find.
- **Close the CI verification tasks.** `improve-ci-pipeline` left its post-merge checks open (tasks 2.2, 2.3, 3.4, 4.2, 4.3, 5.2), including 6.2, which decides whether the run summary names flaky e2e tests or needs a JSON reporter.

### Developer experience

Prettier is not needed. Biome already formats and lints (`biome.json`, `pnpm lint`, `pnpm format`, the lefthook `pre-commit` job), and `.vscode/` recommends its extension and formats on save.

- **Add an `.editorconfig`.** The repo has none, so editors other than VS Code (`.idea/` is git-ignored, so some contributors use JetBrains) fall back to their own indent and line endings until Biome runs on commit.
- **Document fast local e2e runs.** `pnpm e2e` runs `pnpm build` before every run (`playwright.config.ts`). `E2E_PREBUILT=1` already skips it after one `pnpm build`, and Playwright takes a single spec file, but `docs/development.md` mentions neither.
- **Seed enough rounds to show an index.** `pnpm db:reset` creates three players and one reference round (`src/db/seeders.ts`), so every index is provisional and each curve has one point. The handicaps page and the strokes planner can't be tried locally without entering rounds by hand.
- **Document worker debugging.** `docs/development.md` covers `pnpm ocr:debug` for one photo, but not how to inspect the job queue, rerun a failed import or attach a debugger to `tsx watch src/worker.ts`.

## Later

### Scorecard import and OCR

- **Show "AI completion in progress" in the import list.** A Claude call can block the worker for up to about 120 s, and the list only says the import is waiting. Needs a new import status written by the worker (`2026-10-17-add-thinking-orb-loaders/design.md`, open questions).
- **Clean up orphan photos.** Files in `uploads/` with no import or round left behind by deletions before v0.6.0, plus any whose removal failed (`src/jobs/imports.ts`). The delete-imports design suggests a startup sweep like `convert-photos` (`2026-10-18-delete-imports/design.md`).
- **Grow the digit templates from corrections.** `src/ocr/templates/gspro-digits.json` comes from the reference photo. The draft keeps each cropped cell, so manual corrections could feed new templates (`2026-10-17-add-golf-handicap-tracker/design.md`, risks).
- **Handle a panel cut by the photo edge.** Corners are bounded to 0..1, so `gspro-tualatin.jpg`, where the panel runs past the left edge, can only go through the AI fallback or fail (`tests/fixtures/scorecards/README.md`).
- **Prune finished jobs.** The `jobs` table only loses rows when their import is deleted (`src/jobs/imports.ts`). Small today, unbounded over years.

### Handicap and rounds

- **Reject future dates.** A round is not played tomorrow. Left as a separate consistency check (`2026-10-17-add-calendar-date-input/design.md`, open questions).
- **Delete a player.** Not possible today. The delete-imports proposal left it out because a player keeps rounds and index history, so it needs a decision on what happens to them.

### UX and mobile

- **Autosave manual entry and round edits.** Autosave covers `/imports/[id]` only. `/rounds/new` would need a drafts table, and `/rounds/[id]/edit` a pending-correction column, since saving a half-edited round breaks the consistency rule (`2026-10-17-add-correction-autosave/design.md`).
- **Warn when someone else edited the same import.** Today the last write wins. Waiting to see if it happens (same design, open questions).
- **Hide the tab bar on editor screens** if the tab bar plus the "Enregistrer" bar leaves too little room on the iPhone (`2026-10-18-polish-mobile-ui/design.md`, risks). Depends on task 9.1.

### Developer experience

- **Pin the whole toolchain in one place.** Node comes from `.nvmrc` and pnpm from `packageManager`, but Tesseract is a manual `brew` or `apt` step (`docs/development.md`). A `mise.toml` or a dev container would cover all three, and a dev container built from the `Dockerfile` base would read cards with the same Tesseract as production.
- **Coverage report.** Vitest runs without coverage (`vitest.config.mts`, `package.json`). Several modules have no test file that names them, for example `src/ocr/glyphs.ts`, `src/ocr/readers.ts` and `src/server/rounds/detail.ts`. A report would tell whether e2e or other tests reach them.

## Ideas

Deferred in a design with no plan yet. Each would need its own proposal.

- **Other simulators and layouts** (E6 Connect, Trackman, other GSPro screens). The layout lives in `src/ocr/layouts/gspro.ts`, so a second one has a place to go.
- **Closer WHS rules.** 9-hole rounds, real course rating and slope, soft and hard caps, PCC. All left out of the first version. The index is a "simulator index" on purpose.
- **Live camera viewfinder** with a frame around the panel, through `getUserMedia`. Worth it only if photos from the camera button frame badly (`2026-10-17-add-camera-capture/design.md`).
- **A loading screen between pages** (`loading.tsx`) if navigation turns slow on mobile networks.
- **Dark mode, offline mode and a service worker.** Left out of the mobile polish and the loaders. shadcn's `.dark` tokens are already in `src/app/globals.css`, unused.
- **An English interface.** The UI is French for the group. Outside users will likely ask first.
- **Bulk delete of imports.**

## New feature ideas

Unlike the sections above, these come from no spec or design. They are suggestions for a small group that photographs GSPro cards on their phones, sized roughly: S is a few days, M a week or two, L a larger change touching the data model.

### Scorecard import and OCR

- **Share to the app (S).** Register the installed app as a share target, so "Share" on a photo in the iPhone gallery queues an import without opening the import screen first.
- **Ready notification (M).** A web push notification when the worker finishes a card, "Carte prête à vérifier", so nobody keeps the app open while the OCR runs.
- **Pre-filled course data (S).** When the card's course and tees match a known course, show where the read pars and hole indexes differ from it, which catches a misread before the sum checks do.

### Handicap and stats

- **Head-to-head record (M).** For any two players, rounds played together, net wins for each and the average net gap. The group already plays net matches; this keeps score across them.
- **Per-player stats page (M).** Scoring average by par 3, 4 and 5, birdies and doubles per round, best and worst holes. All of it is already in the `scores` and `round_holes` tables.
- **Season leaderboard (M).** Net results summed over a date range the group picks, for example a summer season, with a winner at the end.
- **Index change preview (S).** On the correction screen, show what each player's index becomes if the round is saved, before pressing "Enregistrer".
- **Course records (S).** Best gross and net score per course and tees, with the player and date.

### Rounds and courses

- **Course page (M).** A list of known courses with their pars, hole indexes and distances, every round played there and the group's average per hole. Courses exist today only as the latest round per name and tees (`src/server/rounds/courses.ts`).
- **Match result from the strokes page (M).** After planning strokes on `/strokes`, link the round saved later to that match and show the result with the strokes that were given.

### UX and mobile

- **Round summary to share (S).** A ready-to-send image or text of a round's net leaderboard, for the group chat.
- **Activity feed on the home page (S).** The last rounds saved, index changes and imports waiting for review, so a member sees what changed since last time.

### Ops and deployment

- **CSV export (S).** Download rounds, hole scores and index history as CSV, for a spreadsheet or a backup the group can read without SQLite.
- **Backup from the app (M).** A button, or a scheduled job in the worker, that writes a consistent SQLite backup (`VACUUM INTO`) and the photos to a dated archive on the volume.
- **AI spend view (S).** The month's AI calls and cost, read from `ai_usage`, so the owner sees how close the budget is without opening the Anthropic console.

### Developer experience

- **One-command setup (S).** A `pnpm setup` script that checks Node, pnpm and Tesseract, writes `.env.local` with a random `SESSION_SECRET`, and runs `pnpm db:reset`. Today it is five manual steps.
- **Component preview (M).** A Storybook or Ladle page for the score grid, the net leaderboard and the loaders, with the states that are hard to reach by hand: AI-marked cells, sum errors, a long player list.
- **Fixture seed from photos (S).** A script that imports every photo in `tests/fixtures/scorecards/` through the real queue, so a new contributor gets realistic imports in all states to click through.

### Community

- **Multi-group support (L).** Several groups on one instance, each with its own passcode, players, rounds and courses. It changes most queries, so it only makes sense if other groups ask to share a server.
- **Demo mode (S).** A read-only instance seeded with the reference round, linked from the README, so visitors can try the app before deploying it.

## Out of scope

Turned down in a proposal or design, with the reason given there.

| Idea | Why not |
| --- | --- |
| Anthropic Batch API for the AI fallback | Up to 24 h of latency, and an import should be ready to review right away. |
| Matching players with the AI | Aliases stay the rule (spec `players`). |
| A "retry AI" button | One AI call per card at most, under a monthly cap. |
| Saving correction drafts in `localStorage` | Rejected by the owner for imports. Drafts live on the server. |
| Trash or undo for deletions | Deletion is final, behind a confirmation. |
| Individual accounts and per-player rights | One shared passcode for a small group. |
| Running web and worker on different hosts | Both write the same SQLite file. |
| Free-text date input | Needs its own parser and errors. The calendar works from the keyboard. |
| WebP encoding in the browser | Safari on iOS does not support `canvas.toBlob("image/webp")`. |
| Photos below 3000 px | The OCR needs the resolution. |
| Build date in the version | Makes the build non-reproducible for little gain. |
| Compose healthcheck on `/api/version` | It would stay green with the database down. It stays on `/login`. |
| Worker version in the UI | Web and worker ship in the same image. |
| Several Playwright workers per machine | Tests reset one shared database. Three CI shards get the speed instead. |
| Caching `.next/cache`, Playwright browsers or apt packages in CI | Measured gains of 11 to 50 s, not worth the cache keys. |
| CodeQL advanced setup to skip docs PRs | About 1 min saved, non-blocking, for one more workflow to pin. |

## How items get done

Any change in behavior starts as an OpenSpec proposal under `openspec/changes/`, with its specs, design and tasks, and reaches `main` through a pull request. Small fixes and docs need only the PR. See [CONTRIBUTING.md](../CONTRIBUTING.md). To suggest an item, open a feature request issue.
