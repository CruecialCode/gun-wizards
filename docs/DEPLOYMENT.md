# Running and publishing the Rust reconstruction

The active build uses Rust, WebGPU and Rapier, with an authoritative Rust WebSocket server. See [README](../README.md) for exact setup, WASM build and local run commands. Old Three.js/SpacetimeDB deployment instructions are retained in v0.1.0 Git history; they do not deploy this reconstruction.

## Local development

`cargo run --manifest-path rust/Cargo.toml --locked --features server --bin veil-server` serves `rust/web/` and `/ws` at **http://127.0.0.1:8787**. Build the WASM package first. The same-origin connection avoids configuring service keys in the browser. Solo does not require a remote multiplayer service; co-op requires the Rust server.

The default bind is localhost. `VEIL_BIND` can select an address and port for an explicitly authorized test. Two clients need the same reachable server and room name. On a trusted LAN, the host must deliberately expose its bind address; do not widen network access automatically. Browser WebGPU generally requires a secure context, so remote access needs appropriate HTTPS/WSS hosting rather than assuming arbitrary plain-HTTP LAN URLs will work.

## Release gate

Automatic GitHub Pages publication is disabled during reconstruction. The existing public v0.1.0 is preserved and is not evidence that the Rust game has shipped. Static Pages hosting alone cannot host the Rust cooperative server.

Before publishing, the maintainer must authorize the release, verify the intended visual/gameplay scope, and resolve redistribution rights for upstream assets. The current local reconstruction uses downloaded reference art/music and captured geometry that are ignored and not included in the repository's code license. CI builds code without downloading or republishing those materials.

A production host also needs deliberate TLS, origin/access policy, operational monitoring, resource limits and account/abuse handling. The current room identity is connection-based, not a persistent account system. These are incomplete production capabilities, not implied features of the prototype.
