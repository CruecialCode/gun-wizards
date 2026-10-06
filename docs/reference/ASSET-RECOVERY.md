# Dark Veil frontend asset recovery

Investigated 2026-10-06 at the user's explicit request. Source: <https://dark-veil.dimillian.chatgpt.site/>; published version query `c3b283d68d282a7a9ed4`.

## Evidence and repeatability

REA 4.1.0 static JavaScript inspection was used, not a claim of source-code decompilation or runtime behavior. The first pass identified imports missing from the initial download; the second pass included those modules. Evidence IDs:

- Initial: `ev_8efba28c7d5f338fd8d86f1129aa64826b5736b6790482394ce304ffd5b548c6`
- Expanded: `ev_78c83cd254210b015346681a445415d3e2805e40a2969a6e6b2c91027932a2b7`

Local evidence remains under `.local/dark-veil/`: `rea-javascript.json`, `rea-javascript-complete.json`, `downloads-manifest.json` (public URL, byte length, SHA-256 per fetched resource), and `recovered/manifest.json` (Wasm hash, exact byte offsets, payload hashes and dimensions). REA recovered static module relationships from inert syntax; dynamic paths and actual invocation remain unproven. It did not recover editable Rust source.

Repeat image/audio/font extraction with Python + Pillow:

```sh
python3 tools/recover-darkveil-assets.py .local/dark-veil/reference.wasm
```

The extractor validates PNG chunk bounds and CRCs, decodes images with Pillow, validates RIFF lengths and PCM streams with Python's wave reader, and validates TrueType table directories plus the `head` magic. It rejects false signature matches. A contact sheet is written at `.local/dark-veil/recovered/contact-sheet.jpg`.

## Public frontend files downloaded

HTML, stylesheet, Wasm binding JS, loader, Wasm loader, skull renderer, skull mesh JSON, skull texture, Rye font, social preview, icons, all five imported modules (`input`, `touch`, `music`, `leaderboard`, `collection`), and three MP3 cues (`blackpowder`, `iron-hunger`, `house-of-debts`). The existing downloaded Wasm parts combine into `reference.wasm`.

The shell/UI modules are editable published JavaScript. Core gameplay remains compiled Wasm. The music module explicitly selects two combat tracks and one house track, with separate persistent audio decks and a two-second loop fade. These are observed code values, not a listening or browser-playback result.

## Recovered embedded resources

Eight PNGs decoded successfully. A ninth PNG signature was decoder/library data rather than a valid asset. Twelve RIFF signatures yielded nine valid WAV effects, zero valid WebP assets. Eight fonts have structurally valid sfnt tables; FontTools additionally identifies their names below.

| Local recovered file | Dimensions | Visually inspected content |
| --- | --- | --- |
| `png-0061d1db.png` | 1448 × 1086 | Cream parchment card face + burgundy card back, side-by-side atlas |
| `png-00912ee1.png` | 1254 × 1254 | Gold crossed-revolvers logo |
| `png-00a7afa4.png` | 1586 × 992 | Red velvet gambling table, dealer hands, candles |
| `png-00cb46e0.png` | 2170 × 725 | Ornate parchment horizontal plaque |
| `png-0110681c.png` | 2060 × 763 | Purple Armory banner |
| `png-013808bd.png` | 1063 × 1480 | Purple Armory booster pack |
| `png-015f8958.png` | 1536 × 1024 | Six item illustrations: gun, axe, chalice, armor, glove, ring |
| `png-01846993.png` | 1254 × 1254 | Detailed dark metal/gold/red revolver illustration |

WAV payload durations: 1.2, 1.2, 0.95, 0.95, 0.7, 0.37, 0.2880, 0.32, 0.2800 seconds. Their exact gameplay assignment has not been established; file offsets alone cannot identify gun/reload/hit roles.

| Recovered font | FontTools name |
| --- | --- |
| `ttf-0108ba31.ttf` | Rye Regular |
| `ttf-010b85fd.ttf` | VT323 Regular |
| `ttf-010ddc20.ttf` | Stardos Stencil Bold |
| `ttf-010e5d3e.ttf` | Cinzel Regular |
| `ttf-0198f14c.ttf` | Hack Regular |
| `ttf-019da9ec.ttf` | Noto Emoji Regular |
| `ttf-01a40de0.ttf` | Ubuntu Light Regular |
| `ttf-01a992ac.ttf` | emoji Regular |

## Exact reusable skull geometry

`menu-skull.json` is a real mesh export, not a sprite animation. The accompanying JavaScript describes it as the actual Rust skull mesh exported by build-web. It has 3,804 interleaved vertices, 3,804 indices, and 1,268 triangles. Each vertex is 12 floats: position 3, normal 3, UV 2, pigment 4. `menu-skull.png` is a 256 × 256 texture atlas with nearest filtering. The published shader supplies exact orientation, orange emissive eye treatment, warm key and cool fill values. These files provide a directly reconstructable menu skull without guessing its silhouette.

## Reuse boundary

Downloaded and carved materials stay in ignored `.local/`; they are not implicitly covered by this repository's MIT license. The user authorized local asset retrieval and reuse for reconstruction. Public redistribution rights and upstream asset licenses have not been established by this investigation. Keep a manifest and attribution with any local integration, and resolve provenance before including upstream art or music in an open-source release.

This is a frontend resource inventory, not proof that every resource embedded in the executable has been recovered. Procedurally constructed geometry and textures are not captured by image-file carving. No editable Rust project was found in the inspected public linked files.

## Fresh-clone local setup

```sh
python3 tools/fetch-darkveil-reference.py
```

This standard-library downloader uses the pinned, explicit same-origin URL list in `docs/reference/darkveil-assets.lock.json`; it does not crawl third-party services or call the reference leaderboard/collection APIs. It verifies each download's length and SHA-256, combines the two verified Wasm parts, and extracts the exact previously validated embedded byte ranges. Upstream version drift fails with an actionable error rather than silently changing the reconstruction. Existing matching cache files are reused. Foreign-origin redirects are rejected.

The script prepares the file names consumed by the local web UI under ignored `rust/web/reference-assets/`, including the card/table/item/revolver art, Rye and Cinzel fonts, exact skull mesh/texture/renderer, and all three music cues. `PROVENANCE.txt` accompanies those local copies. Nothing is published automatically. If Pillow is installed, setup additionally runs the independent format-aware recovery script and builds its contact sheet; Pillow is not required for basic setup. Python's trusted certificate configuration is retained, with `/etc/ssl/cert.pem` selected when available; custom environments may set `SSL_CERT_FILE` to their trusted CA bundle. TLS verification is never disabled.

To check an already downloaded setup without any network access:

```sh
python3 tools/fetch-darkveil-reference.py --offline
```

Observed verification: the offline path verified all 24 pinned public files and 25 embedded resources, then prepared 12 runtime assets. The fingerprinted HTML is intentionally excluded from the reproducible download lock because its injected Cloudflare challenge changes per response; all required static resources are explicit.

To repeat REA's static analysis after downloading (REA CLI installation required):

```sh
.local/rea/node_modules/.bin/rea analyze-javascript-application .local/dark-veil --json > .local/dark-veil/rea-javascript-complete.json
```

An installed `rea` command can replace the local binary path. This parses the downloaded JavaScript; it does not execute the reference game or establish that all inferred relationships run.

## Runtime geometry recovery

An instrumented **local copy** of the downloaded frontend captured the data the original game uploads to WebGPU. It did not modify or bypass the public site's access controls. Hooks retained buffer descriptors, mapped buffer contents before unmap, queue writes (including byte offsets), texture uploads, shader source, pipeline layouts, and indexed draw commands. The capture site/server and raw captures remain in `.local/dark-veil/`.

The observed layout differs from the isolated loading skull export: world vertices are **56 bytes** (position3, normal3, UV2, pigment4, wind2), and instances are **132 bytes** (matrix16, tint4, parameters4, element glow4, tier glow4, finish1). This distinction was established from actual pipeline descriptors, not guessed from strings.

```sh
python3 tools/bake-darkveil-gpu.py .local/dark-veil/gpu-capture/01-auto-manifest.json
```

Requires NumPy. The baker resolves captured index ranges and base/first-instance offsets, applies the original model transform and inverse-scale normal transform, and writes `rust/web/reference-assets/world.bin` with a 48-byte vertex layout: position3, normal3, color3, material1, UV2. Materials 10 and 11 distinguish atlas-lit geometry and terrain. `atlas.rgba` and `atlas.json` preserve the exact 256×256 procedural sRGB material atlas. `world.json` records source hash, transforms, original camera/light/fog uniforms, draw ranges, and bounds.

Observed initial Blackpine capture: 690,069 flattened vertices / 230,023 triangles across 40 instances. The first draw is the static arena (649,839 vertices / 216,613 triangles). The other 39 instances compose three animated enemies and their equipment, frozen at the capture time. The default output omits those frozen actors; `--include-actors` explicitly includes them. The baker separately exports `skeleton.bin` / `skeleton.json`: one 13,410-vertex ordinary skeleton, split into 13 body/limb/eye/weapon parts with captured transforms and inferred animation pivots. Its lowest captured foot is normalized to y=0, producing a 2.011-meter height. Names/pivots are reconstruction inferences; source animation logic remains unavailable. Twelve fixed warm lights and one transient enemy light were captured. Camera was near `(0, 1.987, 7)`; world extents include distant scenery to approximately ±108.21 meters.

The baker reproduces geometry and atlas inputs, not the complete renderer: live wind, actor animation, shadows, particles, volumetrics, and postprocessing still require implementation. Collision data was not supplied to WebGPU and has not been recovered; no reliable box candidates were found in the merged arena mesh. These local artifacts retain the same upstream provenance and redistribution limits as the other reference assets.

### Full reproducible capture workflow

```sh
python3 tools/fetch-darkveil-reference.py
python3 tools/capture-darkveil-reference.py --port 8790
# Open http://127.0.0.1:8790 in a WebGPU-capable browser.
# Enter a run and click CAPTURE GPU once the world and held weapon are visible.
python3 tools/bake-darkveil-gpu.py .local/dark-veil/gpu-capture/02-manual-manifest.json
```

The authored capture server prepares its own minimal local HTML shell and serves only the downloaded cache. `tools/capture-darkveil-gpu.js` installs hooks before the reference Wasm initializes, retaining world and weapon render passes separately because the renderer uses multiple queue submissions per frame. A first automatic snapshot occurs after 12 seconds; the explicit button captures the desired gameplay state. Read the resulting manifest to select the correct snapshot rather than relying on its ordinal filename. Reloading restarts snapshot numbering and may overwrite the same local names; copy valuable captures before another session.

Buffers are capped at 64 MiB individually and 256 MiB total mirrored data. Snapshots freeze mirrors and draw traces synchronously before saving. The server binds loopback only, validates file names and sizes, and rejects foreign browser origins. Upstream scripts execute only as the user-requested local reference game; no remote account service is proxied. No upstream binary, geometry, image, shader or soundtrack is included in the authored tooling commit.

### First-person weapon extraction

After a run starts with a visible held weapon, capture again with the current hook:

```sh
python3 tools/bake-darkveil-gpu.py .local/dark-veil/gpu-capture/02-manual-manifest.json --weapon-only
```

This writes only `weapon.bin` and `weapon.json`, preserving existing world/skeleton assets. It resolves the independently retained `First person weapon` pass and applies the captured inverse camera transform to the indexed model instances. The initial Worn Repeater capture yielded 13,668 vertices in two draw parts (8,364 + 5,304). Coordinates are camera-local: +X right, +Y up, forward -Z. The original local model translation is approximately `(0.1, -0.36, -0.5)`; it is already baked into the vertices, so runtime must not add that translation twice. Transform the mesh by the current camera inverse-view, or render it with a camera-local projection.

Metadata preserves captured projection, model transforms, per-part ranges, and original finish/glow parameters. Idle placement is recovered; reload/recoil motion and procedural metallic finishing remain separate reconstruction work.

### Read-only observations for a gameplay agent

Serve the capture harness, then open `http://127.0.0.1:8790/?observe=1`. The opt-in observer saves a small snapshot every 200 ms and exposes it at `/observation.json`. It instruments the original `update_input` and `update_touch` JavaScript bridge arguments without changing their return values or actions.

Observed bridge fields are phase, input availability, menu hit rectangles (flat `[left, top, right, bottom]` groups in logical canvas coordinates), spell/dash cooldown, mana/stamina and action costs, plus ammunition-weapon and melee-weapon flags. GPU uniforms supply camera position and matrices. Draw commands are rendering telemetry, not proven screen-visible enemy detections. Health and magazine count remain `null`; they were not found in these bridges. This does not expose kill counts, enemy health, run progression, or unlocks.

An agent may combine these observations with actual screenshots to choose normal gameplay inputs. The harness does not execute agent actions, patch damage, advance waves, award cards, or grant unlocks. Browser input should continue through the authorized computer-use interface. This is a feasible structured observation adapter, not a verified autonomous playthrough or a claim that Jev has visual perception. Syntax was checked; live observer delivery needs browser verification.
