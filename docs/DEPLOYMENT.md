# Development and deployment

The public first playable uses GitHub Pages for static files and SpacetimeDB Maincloud for multiplayer. Browser configuration contains only a public endpoint and database name. No service API keys belong in the client.

## Your own deployment

1. Sign in with `spacetime login`.
2. Publish your own module: `spacetime publish --server maincloud --module-path server/spacetimedb YOUR-DATABASE`.
3. Set `VITE_SPACETIME_URI=wss://maincloud.spacetimedb.com` and `VITE_SPACETIME_DB=YOUR-DATABASE` in the build environment.
4. Run `npm run check`, then deploy `dist/` to a static HTTPS host. For a repository subpath, set the Vite `base` and use `import.meta.env.BASE_URL` for asset URLs.
5. The included Pages workflow targets this repository and database. Forks must change the database and base path to their own values before enabling deployment.
6. Validate two independent client identities, combat, elimination and a rematch against the hosted endpoint.

A merge to this repository's main branch publishes the static client automatically. Server publishing is explicit, not part of untrusted pull-request CI. Never expose publish credentials to PR workflows. Schema-breaking changes require a migration plan; do not use destructive database reset flags on shared databases.

## Authentication

The prototype uses server-issued guest JWTs retained in browser localStorage. Callsigns are display names, not unique accounts or passwords. Losing that browser data loses that guest identity. A full release needs recoverable OIDC accounts, session ownership, moderation and abuse controls. Do not collect email addresses or passwords with a cosmetic login form.

## Operational limits

Eight players per room; a scheduled 30 Hz reducer simulates active rooms. All prototype room state is publicly subscribable. This is not private matchmaking. The module validates input shape and bounds, ignores stale input, owns damage and cooldowns, and prevents late joining an active round. It is not a substitute for production anti-cheat, per-connection rate limits or load testing.

The public database contains no billing, contact, or sensitive profile data. Guest names and gameplay are visible. Do not use private information as your callsign or room code.
