# Contributing

Thanks for taking the time. This is a small project run by one person for a group of friends, so a short issue before a large pull request saves everyone time.

## Before you start

- Bugs and ideas go in [issues](https://github.com/emmpaul/golf-handicaps/issues/new/choose), through the bug report or feature request form.
- Security problems never go in a public issue. See [SECURITY.md](SECURITY.md).
- Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).
- Looking for something to work on, or checking whether an idea was already turned down? Read the [roadmap](docs/roadmap.md).

## Prerequisites

- Node, the version in `.nvmrc`.
- pnpm, through `corepack enable`.
- `tesseract` in your `PATH`.

Setup and commands are in [docs/development.md](docs/development.md).

## Branches and pull requests

Every change reaches `main` through a pull request. Nothing is pushed to `main` directly, not even docs.

1. Branch from an up-to-date `origin/main`, named `<type>/<short-topic>`, for example `feat/ai-fallback` or `fix/login-cookie`.
2. Commit there, push the branch, open a pull request and fill in the template.
3. The PR is merged once the CI is green.

## Commit messages

Commit messages and PR titles follow [Conventional Commits](https://www.conventionalcommits.org). commitlint checks them in the `commit-msg` hook and in the CI.

release-please builds the version and `CHANGELOG.md` from them: `feat:` bumps the minor version, `fix:` the patch. Pick the type for what the change does for users, since it ends up in the changelog.

## Tests first

Production code is written test first. Start with a test, run it, and watch it fail for the reason it names. Then write the code that makes it pass.

A test earns its place only if it goes red when the production code is wrong:

- Name the mutation that turns each test red: a wrong constant, a dropped field, a reworded message. For a test written after the code, apply that mutation for a moment, watch the test fail, then revert.
- Write expected values as literals taken from the spec: exact strings, exact counts, literal lists. Never compute the expected value with the code under test.
- Run the real code path. Mocks stand in for collaborators, not for the unit under test.
- Assert by value and as tightly as the behavior allows: `toBe("12852")`, not `toBeTruthy()`.

## Local checks

These are the CI checks. Run them before you push:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm e2e
pnpm jscpd        # duplication must stay at 0 %
pnpm check:pins   # every version in package.json must be exact
```

[lefthook](https://lefthook.dev) installs Git hooks on `pnpm install`:

- `pre-commit` runs Biome (and fixes what it can) and the typecheck on staged files;
- `commit-msg` runs commitlint;
- `pre-push` runs the unit tests and jscpd when code or tool configuration changed.

## Behavior changes go through OpenSpec

The specifications live in `openspec/specs/`, in French. Any change to what the app does starts as an [OpenSpec](https://github.com/Fission-AI/OpenSpec) change under `openspec/changes/<name>/`, with a proposal, a design when needed, spec deltas and a task list. The code follows the specs, not the other way around. A pure refactor, a dependency update or a docs fix does not need one.

## Language

- User interface text is in French, and must match the specs word for word.
- Specs and OpenSpec changes are in French.
- The README, `docs/`, these community files and the GitHub templates are in English.
