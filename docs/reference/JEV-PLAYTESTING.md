# Jev gameplay adapter

`tools/test-rust-jev.mjs` lets Jev pilot two co-op players in the **Rust reconstruction** through its normal WebSocket input protocol. It does not control the original hosted Dark Veil build, unlock its weapons, inspect screenshots, or establish that the game is fun.

The requested reference is [the Doom adapter demonstration](https://x.com/xmyttle/status/2103905168110580205): expose concise game observations, ask for discrete actions, and feed those actions back into the game. This integration uses the existing project’s TypeSafe `systemone` API schema and `jev-latest` choice questions.

## Run

Start the native Rust server and recover the reference world assets first, following the main README. Set `TYPESAFE_API_KEY` in a private environment or secret manager; never paste it into chat or commit it. Then run:

```sh
JEV_DECISIONS=12 node tools/test-rust-jev.mjs
```

`VEIL_WS` overrides the local default `ws://127.0.0.1:8787/ws`. Each run creates a separate room and closes its clients afterward. This is live API usage: do not run it simply because a key exists without the human’s authorization.

## What the model sees and controls

Each player receives its own health, ammunition, mana, stamina, cooldown readiness, wave and kill count. Enemy observations include relative bearing, elevation, approximate range, visible health and type. Enemies must pass a 30-meter range limit, approximately 112-degree horizontal field of view, vertical field of view and triangle-level line-of-sight test against the recovered solid world. Hidden enemy positions are not sent to the model. Both players’ filtered observations appear in the same request, allowing cooperative decisions.

Choices are aim-and-fire, turn, strafe, advance, retreat, reload, dodge, spell and melee. Aim-and-fire rotates toward the nearest visible target by at most 0.45 radians per action; this is disclosed aiming assistance in the adapter, not evidence that Jev controls pixel-accurate aim. The authoritative server still decides hits, obstruction, movement and damage.

Actions last 200 milliseconds, followed by neutral input. Calls are sequential, with a five-second timeout, no automatic retries, at most 40 decisions and a 45-second loop deadline. Actual decision frequency includes API latency and is reported; the adapter does not promise 5 Hz throughput.

## Evidence and limitations

The output `docs/qa/rust-jev.json` contains action choices, filtered observations, per-request latency, measured decision frequency and final game counters. It contains no API key or raw API response. A completed run establishes live model-to-game integration only. Longer navigation, five-wave survival, boss behavior, subjective game feel and visual fidelity require separate testing. The deterministic two-client regression remains `tools/test-rust-coop.mjs`; Jev’s choices should not be used as a brittle pass/fail CI gate.
