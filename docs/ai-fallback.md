# AI fallback

Optional. Without `ANTHROPIC_API_KEY`, the worker frames and reads cards locally only, and the app shows no message about AI on imports. Course ratings are then entered by hand.

With the key, the worker can call Claude Opus 5.5 for three things:

1. to find the panel when local detection fails, at most once per import;
2. to complete a card that was read badly, at most once per import;
3. to read the rating and slope on a course's Simulator Golf Tour scorecard, once per course search.

Each call can hold the worker for 2 minutes in the worst case (60 s per attempt, one retry).

## Framing by AI

**When.** Only if local detection finds no valid framing. The worker then asks Claude for the 4 corners of the panel, in a single call. It runs local detection again inside the area the AI pointed to, then checks the result like a local framing: dark banner on top, light table below, at least one player row.

Rejected corners, an API error, a refusal or an unreadable answer all end in "Panneau introuvable sur la photo" (panel not found). An import framed by the AI shows "Cadrage trouvé par l'IA, vérifie la photo" (framing found by AI, check the photo) on its correction screen.

**What is sent to Anthropic.** One image: the whole photo, turned upright from its EXIF orientation and scaled down to 1568 px on its long side (1568×1176 for a 3000×2250 photo), as a JPEG with no EXIF or other metadata, so no GPS position. The image shows everything the photo shows: the card with first names and scores, and also the room around the screen and the reflections. The full-size photo stays on the volume, and nothing else from the app is sent. When local detection finds the panel, no image leaves the server for framing. Only set the key if the group agrees.

**Cost.** About 1.5 ¢ per photo that local detection cannot frame, nothing when it succeeds.

## AI completion

**When.** After the local reading, the worker checks the draft: empty cells, OUT/IN/TOT sums, pars, hole indexes, scores. If everything passes, it does not call the AI. Otherwise it makes a single call to Claude for that card and replaces only the cells in trouble with the AI's values. A missing date or distance does not trigger a call.

On the correction screen those cells carry the mark "complété par l'IA" (completed by AI), and the review is still required before saving.

**What is sent to Anthropic.** One image: the straightened panel (JPEG, 1568×800 px). It contains the players' first names, their scores and the course. The original photo stays on the volume, and nothing else from the app (indexes, history, other rounds) is sent.

**Cost.** About 2 ¢ per difficult card, so under $0.20 a month for about ten cards.

## Reading the SGT scorecard

**When.** During the search for a course's rating and slope (see [Course rating and slope](architecture.md#course-rating-and-slope)), once the worker has found a single Simulator Golf Tour (SGT) course with the same name and par, or a user has picked one among the candidates. That happens once per course and tees: when the first round on it is saved, or at the first startup after the update for courses already played. It happens again only when someone picks a candidate or runs the search again on the "Parcours" page. With `SGT_LOOKUP=off` the search stops before SGT and makes no AI call.

Claude returns the card's total par and, for each tee, its name, rating and slope from the "Slope/Rating" row. Nothing it reads enters a calculation until a user confirms it. The row waits for manual entry, with a note, when:

- the API returns an error, a refusal or an unreadable answer, a rating outside 40 to 90 or a slope outside 55 to 155, or Claude says the image is not an SGT scorecard: "Lecture IA impossible" (AI reading failed);
- the par on the card differs from the round's: "Par de la carte SGT différent" (SGT card par differs).

**What is sent to Anthropic.** One image: the course's scorecard as SGT serves it publicly (`scorecard_<id>.jpg`, a 905×527 JPEG), sent unchanged. Nothing from the group goes with it, no name, score, photo or round.

**Cost.** Measured once on the Bethpage Black card (`tests/fixtures/sgt/scorecard_30.jpg`, 2026-10-21): 1,352 input and 128 output tokens, about 0.8 ¢ per search. The group adds a few courses a month.

## Tracking, budget and activation

**Tracking.** The worker computes the cost of every call, framing, completion or scorecard reading, from the usage the API returns (Opus 5.5 pricing: $4 and $20 per million input and output tokens). It records that cost in the `ai_usage` table, including after a refusal or an unreadable answer, since the API bills those too.

**Budget.** `AI_MONTHLY_BUDGET_USD`, $1 by default, per calendar month. The month is counted in the IANA time zone of `AI_BUDGET_TIME_ZONE`, `America/Montreal` by default, so it resets at midnight local time on the 1st. All three kinds of call add up to the same total. The worker calls the AI only if the month's total plus the worst case of the planned call stays under the budget: $0.094 for a completion, $0.056 for a framing, $0.038 for a scorecard reading (`MAX_RATING_COST`).

When the budget would be exceeded:

- an import that needs framing moves to "Échec" (failed) with "Panneau introuvable sur la photo";
- an import that needs completion reaches "Prêt à vérifier" (ready to review) with the local reading and the message "Budget IA du mois atteint" (monthly AI budget reached);
- a course search does not download the scorecard and waits for manual entry with the same message.

Without `ANTHROPIC_API_KEY`, a course search stops at the same point with "Lecture IA désactivée" (AI reading off). In both cases the "Parcours" page links to the SGT scorecard, so the values can be copied by hand.

For completion, an API error, a refusal or an unreadable answer give "Complétion IA indisponible" (AI completion unavailable). A completion never moves an import to "Échec".

**Changing the time zone.** Each call is stored with the month it was counted in, and the worker never recomputes those rows. Changing `AI_BUDGET_TIME_ZONE` mid-month moves the start and end of the current month by a few hours. A call made between the old and the new midnight counts toward one month or the other.

**Limit on the Anthropic side.** Also set a monthly spend limit in the Anthropic console. It protects you if prices change before `src/ai/pricing.ts` does.

**Turn it on in production.** In Dokploy, add `ANTHROPIC_API_KEY` to the `golf-worker` variables, `AI_MONTHLY_BUDGET_USD` to change the budget and `AI_BUDGET_TIME_ZONE` to count the month in another time zone, then redeploy `golf-worker`. `golf-web` does not need them. Removing the key and redeploying the worker turns the feature off. See [Deployment](deployment.md).
