# CI and releases

All workflows live in `.github/workflows/`. `main` is protected: every change goes through a pull request, with the CI checks green.

## Checks

`pr.yml` (every PR) and `main.yml` (every push to `main`) both call `checks.yml`.

Its first job, `scope`, passes the list of changed files to `scripts/ci-scope.ts`. If every file is documentation (`openspec/`, `docs/`, `*.md`, `.release-please-manifest.json`, or `package.json` when only its `version` changes), `checks / quality` runs only `check:pins`, commitlint and the lint, and the e2e tests are skipped. The release PR falls in this case. Any other file, or a failed `scope` job, runs the full suite.

On `main`, a documentation push also skips the Docker build and the compose smoke test, on one condition: the `main` run of the parent commit succeeded. Otherwise everything runs. Merging the release PR therefore goes straight to release-please and then to publishing.

The e2e tests run in three shards on three machines, `checks / e2e-shard (1)`, `(2)` and `(3)`. The `checks / e2e` job collects their results and fails if any shard fails.

Branch protection on `main` requires `checks / quality` and `checks / e2e`. A skipped job counts as passed, so a documentation PR can still be merged.

## Releases

On every push to `main`, `main.yml` runs the checks and then release-please, which keeps a release PR up to date (version, `CHANGELOG.md`). Versions come from Conventional Commits. Before 1.0, a `feat` gives a minor version and a `fix` a patch.

Merging that PR creates the `vX.Y.Z` tag and publishes the image `ghcr.io/emmpaul/golf-handicaps` with the tags `vX.Y.Z`, `latest` and `<sha>`. Each architecture builds on a native runner (`linux/amd64` on `ubuntu-24.04`, `linux/arm64` on `ubuntu-24.04-arm`), then a multi-arch index groups both images under those tags. A plain push to `main` publishes no image.

See [Deployment](deployment.md) for what to do with a new release.

## One-time repository setup

These steps are needed once, for a fork or a new copy of the repository:

1. Before the first push: Settings → Actions → General → check **Allow GitHub Actions to create and approve pull requests**. Without it, release-please cannot open its PR.
2. Create a fine-grained personal access token limited to this repository (Contents and Pull requests, read and write), then save it as the repository secret `RELEASE_PLEASE_TOKEN`. release-please opens its PR with this token, which triggers the required checks. A PR opened with `GITHUB_TOKEN` triggers none.
3. After the first release, make the package public so Dokploy can pull it without credentials. See [Deployment](deployment.md#first-setup).
