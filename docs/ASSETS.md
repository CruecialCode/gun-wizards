# Asset provenance

All runtime assets are checked into `public/assets`; contributors do not need paid generation services. Credentials and provider response/download URLs are excluded under `.local/`.

| Asset | Source / treatment |
| --- | --- |
| Rook, Vesper, Miso character GLBs | Original Tripo text-generated characters, validated 41-bone humanoid rigs, idle/run clips (Rook also contains jump). FBX clips converted and root horizontal motion removed in Blender with tools/prepare-characters.py. Textures resized to 1024 JPEG. Runtime currently blends idle/run. |
| Bad Omen, Dead Letter, Lucky Cat | Original Blender procedural construction in tools/build-weapons.py: separate receiver, chamber, grip, sights, guard, pins and magazine. |
| First-person sleeves/gloves | Original runtime capsule geometry; procedural recoil, inspect and reload motion. Not a fully authored skeletal first-person rig. |
| District | Original modular geometry in src/world.ts and shared/district.ts. Static geometry merged by material. Pavement/signs/reflected light pools are original canvas textures. |
| Ceramic fracture pieces | Baked with MIT-licensed @dgreenheck/three-pinata 2.0.1 using tools/build-fragments.ts, seed 71, 12 Voronoi fragments. Timber uses authored slats. Cosmetic ballistic debris has a 64-piece cap and 3.5-second lifetime. |
| world/posters.png | OpenAI built-in image generation, 2026-10-06. Original 2×2 atlas for Last Call, Crow & Anvil, Night Line 07, Velvet Spoon. Prompt specified original illustrated anime posters, ink/ivory/vermilion, trumpet/moon, arcane revolver, floating transit city, coffee cat. Quadrants selected through texture UVs in the renderer. |
| key-art.png | OpenAI built-in image generation, original earlier skyport crew concept. Retained as concept art; no longer the live login background. |
| docs/art/occult-jazz-noir-target.png | OpenAI built-in image generation: original Persona-inspired art-direction board, rain-dark skyport, Rook, detailed ivory/brass sidearm and character-select graphic. Target concept only, not an engine capture. |
| Music | Original deterministic sixteen-bar jazz score in src/music.ts. Synthesized bass, electric-piano-like chords, brass-like melody and brush noise. No external recordings or quoted commercial melodies. Exploration/combat tempo changes. |
| Effects | Original Web Audio synthesis in src/audio.ts. No ElevenLabs audio has been incorporated in this build. |

Character generation task IDs: Rook `f11591f4-ec4a-4415-875f-97a8ee89b02a`; Vesper `8184f3a7-bcff-4a2e-b2b5-e5c5ffb099aa`; Miso `93431436-330b-476c-b71c-812d61cd7c87`. Character model version `v3.1-20260211`; humanoid rig path `v1.0-20240301`. See asset-validation.json for bone/clip/triangle counts. Provider job metadata is evidence of generation, not a quality certification.

Code is MIT. Original project art is offered under CC BY 4.0 to the extent of the contributors' rights; credit “Gun Wizards contributors.” Dependencies and fonts retain their own licenses. Barlow/Barlow Condensed are loaded from Google Fonts under their font licenses. No Persona, Cowboy Bebop, Borderlands or Riot game assets, recordings, characters or logos are included.

## Bad Omen hero revision

`public/assets/weapons/bad-omen-hero.glb` is the original Tripo revision from task `aeaa02a9-7933-44a7-8549-5b33da3dbc70`, model `v3.1-20260211`, detailed geometry/textures. Prompt: a single exquisite anime occult gunslinger revolver, ivory ceramic barrel, blued steel, exposed brass chamber, walnut grip, vermilion accent and star talisman, isolated without hands or stand. The 1.93-million-face source was reduced in Blender to 39,999 faces, 1024px textures and a 1.5 MB runtime GLB using `tools/prepare-hero-weapon.py`. Its coordinate adapter lives in `src/characters.ts`. The original procedural Bad Omen remains available as a source/fallback asset. The generated revision is a single visual mesh; cylinder articulation remains future work.
