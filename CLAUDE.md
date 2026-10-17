@AGENTS.md

# Workflow

- Every change reaches `main` through a pull request: branch from `origin/main` (`<type>/<short-topic>`, e.g. `feat/ai-fallback`, `fix/login-cookie`), commit there, push the branch, open a PR, merge once CI is green.
- Nothing is committed or pushed directly to `main`, docs and OpenSpec edits included. Release-please's release PR follows the same path.
- Commit messages and PR titles follow Conventional Commits (commitlint runs in lefthook and CI). release-please builds versions and the CHANGELOG from them: `feat:` bumps the minor, `fix:` the patch.
