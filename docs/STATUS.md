# Current status — 2026-10-06

## Playable slice

Three.js + SpacetimeDB prototype with guest login, three rigged animated characters, practice/exploration and 2–8-player battle royale. Last Call now has a nocturnal street, shop arcades with interiors, two stair/roof terrace routes, transit arch, warm windows, rain, original illustrated posters and shared collision for architecture and furniture.

Wooden partitions and ceramic ticket barriers take authoritative damage. Prepared ceramic fragments and timber slats animate locally with bounded lifetimes. Two clients agree on broken state; late subscribers receive it; rematch restores it. Small debris is cosmetic, not a gameplay obstacle. This is selective destruction, not whole-building structural collapse.

Original sixteen-bar synthesized jazz plays after a user gesture, with separate music volume and exploration/combat tempo. No commercial music, ElevenLabs recordings or Higgsfield video are included. Login and selection use the live animated scene.

Rook has a new detailed hero revolver optimized from 1.93 million faces to 39,999 / 1.5 MB. First-person hands use rounded procedural geometry. Fast fire presses are buffered across simulation ticks. Stairs, ceilings and breakable obstruction are shared between server and client.

## Verification

- Eight mechanics tests pass: movement, fire/reload, obstruction, guard/range, elimination, destruction, elevated floors/ceilings and an interior breach route.
- Client typecheck/build and server typecheck pass. Formatting is repeatable.
- Four SDK clients finish a real local round; invalid input is rejected. A Jev-directed round also finishes with two recorded tactical decisions. These tests do not establish subjective fun.
- Local and hosted destruction tests pass: two-client agreement, late subscriber snapshot and rematch reset. See docs/qa/destruction-network.json.
- Browser inspection exercised menu→practice, mouse-capture fallback, a buffered fire press, dodge and jump. Before the final hero weapon pass the viewed district measured 57–60 FPS / 128 draw calls / 70,824 triangles / 174 geometries / 15 textures. The hero weapon view measured about 101,559 triangles / 90 draw calls / 96 geometries / 23 textures while loading/warming. These are individual desktop browser observations, not p95 or minimum-hardware guarantees.

## Known limits

The scene is a real explorable slice, but does not yet match the concept board's architectural richness or Persona/Riot production quality. Facades remain modular and repetitive; character acting, face shading, first-person reload articulation and NPC life need authored passes. Two weapons retain simpler procedural meshes. Physics debris only bounces against the base ground. No physical controller test, mobile performance sign-off, production anti-cheat, load test or full prediction replay/lag compensation is claimed.

Hosted server: `cruecial-gun-wizards` on Maincloud. Public repo: https://github.com/CruecialCode/gun-wizards . The initial release is being published through GitHub Pages; consult deployment status before claiming it is live.

Next iteration should improve one hero street corner and character/weapon acting against captured in-engine frames, then gather human playtest feedback. Do not substitute generated concept images for gameplay evidence.
