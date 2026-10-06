# Dark Veil reconstruction

The active project is a **Rust + WebGPU + Rapier** reconstruction of [Dark Veil](https://dark-veil.dimillian.chatgpt.site/), with solo and cooperative PvE. Reproduce the reference before introducing Gun Wizards designs. The former Three.js / SpacetimeDB game is preserved as **v0.1.0** and in the legacy directories; it is not the current design target.

This is an incomplete reconstruction, not the original editable source or a finished 1:1 recreation. See [current evidence and limitations](docs/STATUS.md).

## Give this repository to your agent

> Read AGENTS.md, set up the active Rust game, safely pull the latest changes, and launch it. Handle branches, checks, commits, and pull requests. Preserve unrelated work. I want to work on: [your idea].

GitHub sign-in belongs to the contributor: `gh auth login`. Never paste account passwords or API keys into chat. No paid asset service or SpacetimeDB account is required for the active game.

## Local setup

Install Git, a current stable Rust toolchain through [rustup](https://rustup.rs/), Python 3, and Node 22+ for the network test. GitHub CLI lets your agent manage contributions.

```sh
git clone https://github.com/CruecialCode/gun-wizards.git
cd gun-wizards
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.100 --locked
python3 tools/fetch-darkveil-reference.py
cargo build --manifest-path rust/Cargo.toml --locked --release --target wasm32-unknown-unknown
wasm-bindgen rust/target/wasm32-unknown-unknown/release/veil.wasm --target web --out-dir rust/web/pkg
cargo run --manifest-path rust/Cargo.toml --locked --features server --bin veil-server
```

Open **http://127.0.0.1:8787** in a WebGPU-capable browser. Select **Enter the Veil**, choose a weapon, then **Solo hunt** or **Cooperative PvE**. Co-op clients enter the same room name; the first client owns starting/continuing the shared hunt. Each connection receives its own player identity. There are no account passwords or persistent character accounts yet.

The downloader verifies pinned hashes and prepares locally reused reference artwork and music. These files remain ignored and are not redistributed under this repository's license. `python3 tools/fetch-darkveil-reference.py --offline` verifies a cached setup. The optional captured world/actor geometry is a separate local research artifact; a fresh clone does **not** reproduce that captured environment from these commands alone. See [asset recovery](docs/reference/ASSET-RECOVERY.md) for capture evidence and baking instructions. Missing captured geometry uses the reconstruction's fallback scene.

Default hosting binds only to localhost. Changing `VEIL_BIND` to expose the server requires a deliberate hosting decision; this prototype does not provide production account authentication, TLS termination, or deployment hardening. No approximation is automatically deployed over the old public release.

## Controls

| Action | Input |
| --- | --- |
| Move | WASD |
| Look | Mouse; arrow keys as fallback |
| Fire | Left mouse or Enter |
| Jump | Space |
| Evade | Shift |
| Melee | F |
| Spell | Q |
| Reload | R |
| Pause / options | Escape |

If an embedded browser rejects pointer capture, hold right mouse to look. Volume and sensitivity are adjustable. Controller and touch support are not implemented in this reconstruction. Pausing co-op stops your input; the shared world continues.

## Verify and contribute

```sh
cargo test --manifest-path rust/Cargo.toml --locked --features server
cargo build --manifest-path rust/Cargo.toml --locked --release --target wasm32-unknown-unknown
node --check rust/web/main.js
node tools/test-rust-coop.mjs  # requires the Rust server on port 8787
```

Inspect the actual game after visual or input changes. Passing tests establish only the assertions they check, not visual fidelity or fun. Agents should follow [AGENTS.md](AGENTS.md): focused branch, checks, commit, push, PR, and CI review. Merging and deploying still require maintainer authorization.

## Project map

- `rust/src/simulation.rs`: shared solo/server mechanics, Rapier physics, enemies, combat and waves.
- `rust/src/browser.rs`, `renderer.rs`, `scene.rs`: WASM bridge, WebGPU renderer and scene data.
- `rust/src/server.rs`: authoritative cooperative room server.
- `rust/web/`: browser shell, menu, HUD, controls and audio bridge.
- `tools/fetch-darkveil-reference.py`, `recover-darkveil-assets.py`, `bake-darkveil-gpu.py`: reproducible acquisition, extraction and local GPU-data baking.
- `docs/reference/`: observations, recovery provenance and limitations.
- `src/`, `shared/`, `server/spacetimedb/`, `public/`: preserved **legacy v0.1.0**, not the active implementation. Root npm scripts still target that legacy game.

Our independently authored code is MIT. Downloaded reference code, art, music, fonts, geometry and captures retain their upstream provenance; redistribution rights have not been established. The former Gun Wizards original-art license does not apply to Dark Veil material.
