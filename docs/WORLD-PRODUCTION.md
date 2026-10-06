# Building Last Call as a playable world

Decision record — 2026-10-06. This is the production plan and measured destruction investigation, not a claim that the current courtyard implements it.

## The recommendation

Build one small, dense, freely explorable district with a complete playable loop. Author the space in Blender from a modular kit, export sector GLBs plus explicit gameplay data, and render in Three.js. Give Persona responsibility for character/presentation, and take Borderlands' commitment to coherent materials, authored detail, exploration and environmental life as a production benchmark. Do not try to turn one generated image into the whole level or hide flat cards where the player can walk around them.

The target board has a substantial level of architectural and material detail. Matching its atmosphere is achievable through composition, painted texture/trim work, controlled lighting and a few hero assets. Matching every detail from every angle requires actual asset production, not a shader switch. The current procedural courtyard needs replacement.

## Investigation: Dan Greenheck's destruction demo

The linked post explicitly connects his multiplayer wizard-dueling concept to OpenFracture and then three-piñata. The post text was readable in the browser; its video reported “Unable to play media.” No claims about the video's exact physics engine, network protocol, structural simulation or performance are verified.

- Post: https://x.com/dangreenheck/status/2107193027089277147
- Library and source: https://github.com/dgreenheck/three-pinata
- Physics example: https://github.com/dgreenheck/three-pinata/blob/main/demo/src/physics/PhysicsWorld.ts

Verified library capabilities: Voronoi fracture, planar slicing, seeded patterns, separate interior faces/materials, and progressive re-fracture controlled by the caller. Inputs need closed valid volumes. It produces geometry; the demo integrates a separate physics engine. This does not by itself provide load-bearing structures or networked destruction.

### Local feasibility measurement

Run `npm run research:fracture`. Version 2.0.1 was installed as a development dependency. Eight timed runs per case followed one warmup. See `docs/qa/fracture-benchmark.json` for CPU/runtime and results.

A simple watertight 3 × 2 × 0.2 m box took median 5.56/16.39/62.80 ms for 12/24/48 fragments in 2.5D, and 3.88/14.99/69.47 ms in 3D. These are Node geometry-only timings, not frame timings. The expected faster 2.5D mode was not faster for every tested case: profile our assets rather than assuming a mode wins. Seeded output repeated in this process; that does not establish cross-device or physics determinism.

Decision: generate most fracture variants in an offline build tool. Use low-poly watertight fracture proxies or authored separate pieces rather than feeding a detailed whole building to runtime fracture. Match exterior trim/UVs, author appealing exposed interiors, and retain the original intact visual until the authoritative break event. Runtime fracture is an optional later experiment behind a worker and strict limits.

## A district with a reason to explore

Target footprint: approximately 100 × 80 m across three loaded sectors, adjusted after traversal tests. Scope is one polished district, not an open-world city.

| Place | Identity and activity | Gameplay purpose |
| --- | --- | --- |
| Last Call frontage | Tall vermilion club sign, bass audible through the door, animated shadow patrons | Primary landmark, rendezvous and central fight |
| Velvet Spoon diner | Warm windows, abandoned breakfast, ringing service bell, kitchen steam | Enterable alternate route; short close-range fight |
| Crow & Anvil gunsmith | Ivory/brass displays, repair bench, cartridges sorted in tins | Inspect/tutorial space in exploration; covered combat route |
| Courier passage | Undelivered letters, hanging laundry, mail chute, Vesper graffiti | Narrow flank with a destructible partition |
| Tram concourse | Timetable, benches, suspended cables and the impossible transit arch | Long sightline, clear cover, visually distinct destination |
| Service roof | Water tanks, vents, club sign maintenance hatch | Elevated route with two ways down and exposed counterplay |

Connect street → diner kitchen → courier passage → concourse → street into a loop. Connect passage → service stair → roof → concourse into a second loop. No traversal-critical door is merely painted onto a wall. Add only two or three enterable interiors at this milestone and make their thresholds seamless. Use closed doors and occupied window scenes honestly for the rest.

The skyline can be matte-painted distant cards or low-detail meshes beyond reachable boundaries. Near buildings, stairs, interiors, parapets and collision must be true geometry. Preserve the same district for exploration/practice and battle royale; disable competitive damage in exploration and reset destruction per match. Background pedestrians stay out of competitive firing lanes.

## Authoring pipeline

1. **Route blockout:** fit sprint, jump, slide and dodge envelopes; choose duel distances; test every entrance, stair and roof landing. Shared collision data must support floors above zero, ceilings, stairs and slopes before calling the roof route playable. Current AABB/floor code is insufficient for that district.
2. **One finished corner:** finish the club/gunsmith junction, pavement, one doorway/interior and the first-person weapon under final light. Compare a real gameplay screenshot to the target. This corner sets density, scale, palette and production cost.
3. **Modular kit:** 2/4 m facade bays, corners, window/door recesses, pilasters, cornices, roof trims, stairs, arches, railings and storefront frames. Build clean snapping pivots and collision proxies. Share 2–3 trim sheets and a compact material palette. Variants change proportion and placement, not random noise everywhere.
4. **Hero assets:** club sign, guild gun display, transit arch, tram shelter and three memorable props. Model hero architecture/guns in Blender. Use Tripo for selected decorative sources only after checking topology, scale, materials and silhouette. Generated triangles are not a substitute for constructed interiors or an animation rig that has been reviewed.
5. **Illustrated surfaces:** hand-directed ink marks and painted value groups in textures, restrained vertex color variation, baked contact/AO, designed face shading and selective outlines. Maintain physically understandable materials without photoreal surface noise. A full-screen edge filter alone will not deliver this style.
6. **Lighting:** cool broad key and fill, warm storefront pools, vermilion club signal; lightmapped static indirect/contact detail and one real sun/moon shadow. Emissive signs receive authored nearby light contribution. Keep opponents in readable midtones. Wet paving uses roughness variation and limited reflections, not a mirror everywhere.
7. **Life pass:** scheduled tram lights, signs with rare intentional flicker, a cloth awning, kitchen steam, distant silhouettes, a repair drone/cat, spatial interior audio. These small authored routines imply inhabitants. Tie them to stable schedules/seeds and keep them out of combat collision.
8. **Destruction pass:** fit intact/broken states to the finished kit, preserve route readability and measure worst-case destruction. Include exposed framing, plaster core and damaged trim; the broken version is an authored asset too.

Export each sector independently, with stable IDs, version/hash, bounds, spawn points, collision proxies, audio zones, interactions, destruction states and optional LODs. Keep editable Blender sources separate from optimized runtime GLBs. Bake transforms. Validate missing materials, geometry bounds, texture size, open volumes and required named sockets. Retain source/license/prompt records for every generated asset.

## Destruction that serves combat

| Class | Examples | Authority and behavior |
| --- | --- | --- |
| Reactive decoration | Cups, bottles, sign sparks, chips | Cosmetic feedback; no cover or damage |
| Breakable dressing | Window panes, hanging panels, crates | Server persists object state; bounded local fragments |
| Tactical breakables | Shop shutter, interior partition, selected cover | Server changes obstruction and collision atomically; clear material tells players it breaks |
| Structural feature | One balcony or awning support | Authored support graph and collapse state; server owns final collision |
| Permanent anchors | Ground, route spine, landmark core, spawn protection | Indestructible for this release; prevents erasing the playable level |

Start with glass, one wooden partition and one ceramic cover piece. A glass pane cracks/shatters; wood splinters along its construction; plaster exposes framing. Avoid one generic exploding-rock effect for everything. Do not promise whole-city collapse without a separate structural simulation and playtest budget.

### Multiplayer contract

SpacetimeDB owns object HP, phase, collision state and monotonically increasing revision per room/round. An authoritative weapon hit selects the object using the same nearest-hit/occlusion path as player hits; clients cannot nominate arbitrary destroyed objects. Validate rate, ammunition, range and room membership in that path.

Replicate object ID, round ID, revision, broken variant ID, impact position/direction and effect seed. The client swaps to the matching prepared state and starts cosmetic fragments. Late joiners read current durable object rows; they must not rely on expired transient effects. Deduplicate events, reject old-round updates and clear/reset states on rematch. For a breach, visibility and collision switch together on the server tick. Include a world manifest hash so mismatched clients cannot silently disagree on cover geometry.

Small fragments have no player collision and cannot damage anyone. Simulate them locally with Rapier or simple ballistics, then sleep/fade them. If a large fallen object changes routes, use a server-owned authored final collider state; do not trust a client's physics outcome. Seeded fracturing alone is not network synchronization.

Initial budgets: 12–24 visible pieces per break, 64 active cosmetic bodies nearby, 3–5 seconds before cleanup, at most two expensive break effects started in one frame. Preserve immediate impact feedback and queue only presentation work. Pool dust and sparks. Discard far effects while retaining authoritative world state.

## Soundtrack and soundscape

Cowboy Bebop is the mood reference: original jazz with a small-band identity, syncopation, attitude, melancholy and occasional frantic brass. Compose new material rather than quoting its melodies. A coherent motif and musicianship matter more than labeling a prompt “anime jazz.”

| Cue | Musical specification | Runtime role |
| --- | --- | --- |
| Last train, last drink | 92 BPM, upright bass, brushed drums, muted trumpet, sparse electric piano, minor ninth harmony | 64-bar exploration/menu bed with room for ambience |
| Bad tab | 144 BPM, walking bass, tight drums, baritone sax riff, trumpet answers, clipped guitar/piano chords | Combat cue with a shared motif and stronger rhythm |
| One more round | Short original brass/drum turnaround | Victory/rematch sting |
| Behind the door | Filtered small-combo variation, narrower stereo field | Spatial club source that opens up at the entrance |

Use ElevenLabs Music for complete original cues, Sound Effects for rain/steam/interior beds and material impacts. Generate offline and commit the reviewed audio assets; never put generation requests or credentials in the game. Official Music supports prompts/composition plans; SFX supports looping beds. Exact bar lengths, seamless looping and matched stems must be audited after generation—prompting does not guarantee them.

Create a small number of candidates, choose a motif, edit loop boundaries in an audio editor, and measure peaks/loudness. Transition on musical boundaries with crossfades and combat hysteresis. Independent music/SFX/ambience volumes, mute, visibility handling and gesture unlock are required. Duck music modestly under important combat cues; directional footsteps, gun mechanisms, guard contacts and break sounds must stay readable.

No new ElevenLabs music or Higgsfield video was generated during this investigation. Existing procedural audio remains a placeholder.

## Login and character select animation

Use the same real-time world with a curated camera for a truthful login view: rain, tram motion, signs, cloth and distant silhouettes. Layer fast graphic title/selection transitions over it. Character select gets its own authored pose/animation stage, weapon attachment and portrait art.

Higgsfield image-to-video is useful for an optional 5–8 second ambient login loop or chapter card. Keep text/buttons live in HTML, provide a still fallback, honor reduced motion, and pause decoding when hidden. Inspect frame drift, hands, gun geometry and loop seams before shipping. Video cannot replace orbitable characters, immediate selection response, actual 3D routes, collision or destructible world state. Prefer real-time menu animation if the in-game assets are ready: it is coherent, interactive and avoids a quality gulf at the moment play begins.

## Iteration loop and acceptance

Dream → author one playable scene → capture fixed views and a traversal/combat video → compare to target → fix the largest visible/feel discrepancy → repeat. Keep source assets and prompts versioned. Never score the concept board as implementation evidence.

A first completed slice must allow entering the club frontage, circling through the diner, taking the flank, breaking the designated partition, and returning through the concourse. Two clients must agree on the breach, a reconnect must preserve it, and a rematch must restore it. Finish this before adding a second district.

Use Jev for high-level test plans and repeated UI traversal; deterministic clients for network assertions. Log stuck routes, missed inputs, route diversity, engagement length, reversal/punish opportunities and re-engagement time. Ask humans about readability and desire to replay separately. Neither bot activity nor high damage totals establish fun.

Targets: 60 fps on a declared desktop baseline; p95 frame time <=16.7 ms in the slice, separately report worst break spike. Starting budgets <=300 visible draw calls, <=750k visible triangles, <=60 textures and <=256 MB estimated texture memory. Record actual diagnostics, cold load and post-destruction memory. These are acceptance targets, not measured current-game performance.

## Research sources

- Persona developer interview on bespoke presentation and implementation testing: https://www.famitsu.com/news/202311/29325647.html
- Gearbox technical director on authored identity, world streaming, collaboration and environmental life: https://www.unrealengine.com/developer-interviews/built-with-ue5-borderlands-4-delivers-ambitious-scale-with-world-partition-nanite-lumen-and-more
- ElevenLabs Music: https://elevenlabs.io/docs/eleven-api/guides/cookbooks/music
- ElevenLabs SFX: https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert
- Higgsfield API: https://higgsfield.ai/higgsfield-api

The architecture, level layout, budgets and audio specifications above are recommendations for Gun Wizards, not descriptions of how Atlus or Gearbox implemented their games.
