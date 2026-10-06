# Current status — 2026-10-06

The active branch rebuilds Dark Veil using Rust, WebGPU and Rapier. The user rejected the Last Call release and explicitly requested starting over. Legacy Three.js / SpacetimeDB v0.1.0 is preserved; the existing public Pages release must not be mistaken for this reconstruction.

## Implemented reconstruction

The Rust client and authoritative cooperative server share simulation code. Browser flows include live title, First Hand selection, solo/co-op room entry, combat HUD, options, pause, defeat and five-wave respite. Core mechanics include movement, jump, dodge, fire/reload, melee, spell, enemy pursuit/attacks and wave progression. The co-op path uses real WebSocket clients rather than local fake players.

The local UI reuses the downloaded table, parchment, fonts, skull renderer/mesh and music. REA inspected published JavaScript; format-aware extraction recovered embedded image/audio/font resources. Runtime GPU capture recovered arena geometry, a procedural atlas and skeleton parts. The current renderer can consume baked local captured geometry. See [asset recovery](reference/ASSET-RECOVERY.md) for exact counts, hashes, observations and reproduction boundaries.

## Verification and release boundary

Nine Rust mechanics tests passed. The updated local server on port 8787 was exercised with two real WebSocket clients: the observed run recorded 25 kills and reached wave 2, and captured-world collision was tested. Browser inspection shows the actual captured world rendering through WebGPU; linear-to-display color conversion was corrected and the recovered 13,668-vertex first-person revolver now renders. These observations do not constitute complete visual or gameplay acceptance; consult the current PR/check output for the exact revision tested. No physical-controller test, minimum-hardware performance sign-off, load test, complete parity run or production deployment is claimed.

The pinned downloader prepares frontend assets from public static URLs. Fresh-clone setup does not recreate the optional local GPU capture automatically; it uses a fallback scene without baked geometry. Reference resources remain ignored and are not included in the open-source code contribution. Automatic Pages publication is disabled for this restart.

## Still incomplete

This is not a faithful finished 1:1 recreation yet. Exact shader/postprocess parity, comprehensive collision alignment verification, weapon/actor animation, enemy variety, bosses, all biomes, equipment/affixes, shops, progression and saves remain incomplete. The three starter weapon mechanics and portions of their presentation are reconstruction choices. Respite restores resources; it is not the original shop. Networking lacks full client prediction/reconciliation and production account infrastructure.

Next acceptance work should compare actual reference/rebuilt frames, then verify the complete solo loop and two-player loop on the same revision. Keep observed results distinct from intended behavior. Do not restore the Gun Wizards art direction until the maintainer requests that evolution.

## Jev verification

The live bounded Jev run used eight decisions across two co-op clients, averaged 2.33 decisions per second (162–338 ms API latency), recorded two shared kills and five hit events per client. The adapter filters observations by field of view, range and captured-geometry line of sight. Aim assistance is disclosed in the test recipe. This is reconstructed-game structured-state testing, not pixel vision or proof of human fun. Original-build telemetry reports menus/resources/cooldowns, but original-game health/ammo and a locked-content playthrough remain unverified. See `reference/JEV-PLAYTESTING.md` and `qa/rust-jev.json`.
