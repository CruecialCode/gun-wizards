#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
cargo build --manifest-path rust/Cargo.toml --target wasm32-unknown-unknown --release --lib
wasm-bindgen rust/target/wasm32-unknown-unknown/release/veil.wasm --target web --out-dir rust/web/pkg
