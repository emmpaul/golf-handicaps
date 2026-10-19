# Security policy

## Supported versions

Only the latest release gets security fixes. Fixes ship in a new release; older tags are not patched. Check which version you run with `curl https://<your-domain>/api/version` or in the footer of any page.

| Version | Supported |
| --- | --- |
| Latest release | yes |
| Anything older | no |

## Reporting a vulnerability

Report it privately through GitHub: [Report a vulnerability](https://github.com/emmpaul/golf-handicaps/security/advisories/new) (Security tab → "Report a vulnerability").

Do not open a public issue, pull request or discussion about it.

Please include:

- what an attacker can do, and what they need first (a session, network access, a crafted photo);
- the steps or a request that reproduces it;
- the version you tested (`/api/version`).

## What happens next

- You get a first response within 7 days.
- I confirm or reject the report, and keep you posted in the advisory while a fix is prepared.
- Once a release with the fix is out, I publish the advisory and credit you, unless you prefer to stay anonymous.

## Scope notes

- The app is behind a single shared passcode. Anything reachable without it, other than `/login`, the install files and `GET /api/version`, is a bug worth reporting.
- When `ANTHROPIC_API_KEY` is set, the worker sends scorecard images to Anthropic. What is sent is documented in [docs/ai-fallback.md](docs/ai-fallback.md); sending more than that is a bug worth reporting.
