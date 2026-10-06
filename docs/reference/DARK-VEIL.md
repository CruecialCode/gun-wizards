# Dark Veil reconstruction evidence

The October 6, 2026 request supersedes the Gun Wizards design: rebuild around Rust, WebGPU and Rapier; reproduce Dark Veil faithfully before introducing Gun Wizards; support solo and cooperative PvE.

Reference: https://dark-veil.dimillian.chatgpt.site/ (observed v0.7.0).

## Direct observations

Title: live moonlit forest ruins, horned skull above two-line bone-colored serif title. Left-side Enter the Veil, Options, Leaderboard, Collection. Warm braziers illuminate ochre stone and moss; dense angular tree crowns frame a ruined gate. Ground is uneven, textured and strewn with irregular stones. Moon and layered clouds above fogged silhouettes. No Last Call assets belong here.

First Hand: red velvet table, dealer's hands, candles, gold coins. Three parchment weapon cards, tilted and raised on selection, model portraits with stats, separate confirmation. Observed options included flamethrower, rocket launcher and bone wand. Selection stays interruptible. Gameplay: centered weapon, crosshair, wave and remaining souls at top, score left, gold right; circular HP and mana/stamina bottom left; weapon and ammo bottom right. Space jump; Shift evade; always-run movement. Embedded-browser pointer capture blocked the original's hunt, so continuous combat feel has not yet been verified.

## Public build inspection

The site's loader, JS bindings and two WASM parts were inspected locally, not committed. Rust paths identify wgpu 24.0.5, winit 0.30.13, egui 0.31.1 and rapier3d 0.35.3. No editable project repository was located. These paths establish implementation dependencies, not access to the original Rust source. The published binary is approximately 29.6 MB.

GPU labels identify modular geometry, instanced world and particles, a hand-authored procedural material atlas, nearest texture sampling, HDR, directional moon shadows, cached scenery local shadows, atmospheric clouds, lit depth-aware particles, shadowed mist, first-person weapon pass, bloom, tone mapping, antialiasing and crisp HUD composition. The new implementation is independently authored from the observations; it does not package the original binary as editable source.

Public changelog describes three biomes (Blackpine, Failed Laboratory, Hell), five rounds per biome, bosses, 16 enemy archetypes, equipment cards/affixes, shops, combo, progression, dismemberment, knockback and saves. This is a substantial game. A title-screen match alone does not establish 1:1 parity.

## Verification standard

Compare actual rendered frames at the same camera and aspect ratio. Verify title, first-hand selection, movement, firing, melee, spell, evade, enemies, wave completion, shop and restart independently. Solo and two real network clients must use the same authoritative Rust/Rapier simulation. Record incomplete parity explicitly. Never call a rough approximation a faithful completed recreation.
