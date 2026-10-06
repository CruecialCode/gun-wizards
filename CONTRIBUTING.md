# Contributing to the Dark Veil reconstruction

Give your agent this repository and describe the player-visible change you want. Ask it to read [AGENTS.md](AGENTS.md) and follow the active Rust setup in [README.md](README.md). You can focus on the game; the agent handles safe syncing, a focused branch, checks, commits and a pull request.

Use one branch per coherent change. Preserve other contributors' work. If you lack repository write access, fork it with GitHub CLI and contribute from your fork. Complete `gh auth login` yourself when needed; never send credentials in chat or invent a contributor's Git identity.

The active target is a faithful Dark Veil reconstruction with solo and cooperative PvE. Gun Wizards/Last Call v0.1.0 remains preserved but is no longer the design target. Read the reference observations before changing visuals or mechanics, and distinguish direct evidence from reconstruction guesses.

Before a PR, run the Rust tests and WASM build described in README.md. For network changes, run the Rust server and `node tools/test-rust-coop.mjs`. Inspect actual gameplay for visual, animation or input changes. Explain what changed, the observed checks, and any remaining mismatch. Do not claim visual parity or fun from a build result.

Downloaded reference files, captured geometry, music, original binaries and `rust/web/reference-assets/` stay ignored. The pinned acquisition tooling is versioned; its fetched content is not automatically licensed for redistribution. Keep secrets and private API responses out of commits. Stage explicit paths, review the diff, and use a short imperative commit message.

Open a PR, inspect CI, and fix failures introduced by the change. Do not merge or deploy without maintainer authorization. The maintainer reviews the game design; agents handle the repository mechanics.
