# Active design: Dark Veil reconstruction

The October 6, 2026 restart supersedes Last Call, Persona styling and battle royale. The immediate objective is a faithful Dark Veil recreation built with Rust, WebGPU and Rapier, playable solo and in cooperative PvE. Do not invent Gun Wizards lore or evolve the reference during this milestone.

## Player flow

Live forest title → The First Hand weapon selection → Blackpine hunt → five-wave respite → continue. Death returns the player to the title for another hand. The prototype currently exposes three weapon classes, movement, jump, evade, melee, spell, ammunition/reload, enemies, health, mana and stamina. A respite is not a completed shop/economy implementation.

The native server and WASM solo client share `rust/src/simulation.rs`. Rapier owns movement collision. The server accepts bounded input intent, owns health, damage, ammunition, enemy AI and wave progression, and broadcasts snapshots. Clients must not provide trusted positions or damage. Co-op rooms support up to four connections. Current networking is a prototype without full prediction/reconciliation or production identity/security infrastructure.

## Fidelity method

Use [direct observations](reference/DARK-VEIL.md) and [asset recovery evidence](reference/ASSET-RECOVERY.md). Separate shipped-resource facts, captured runtime facts and reconstruction guesses. No editable original Rust source was found. Recovered geometry, textures and UI assets are stronger evidence than visual guesses, but do not recover physics, animation logic or complete shading automatically.

Compare equal camera/aspect-ratio frames. Independently verify title, card selection, walking, look direction, short fire presses, reload, melee, spell, evade, jumping, wave completion, respite, death/restart and two actual network clients. A bot round is not evidence that combat feels like the reference.

## Known scope gaps

The reference includes three biomes, bosses, sixteen enemy archetypes, equipment/affixes, progression, shops and additional weapons. Those systems are not complete here. Collision around recovered decorative geometry is approximate. Actor articulation, weapon presentation, lighting, shadows, wind, mist, particles and postprocessing require further comparison. Preserve these as explicit gaps instead of relabeling them as completed features.

Legacy Last Call design remains available in the v0.1.0 Git history and its supporting documents. It is historical context only.
