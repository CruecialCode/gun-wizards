# Gun Wizards — occult jazz noir

## Direction decision

Persona is the primary art-direction reference, per the latest human brief. This supersedes the earlier BOTW/Spellbreak painterly direction. Riot remains a craft and combat-readability benchmark; Destiny remains a first-person feel reference. These influences have distinct jobs rather than being blended into an incoherent visual average.

Our theme: people with expensive guns and terrible luck, making a living above a city that should not still be floating. The Last Call is a rain-dark skyport entertainment district. The contrast is between theatrical self-confidence and an intimate, slightly shabby everyday life.

## What to learn from Persona

The P3 Reload developers describe a coherent water/inner-world theme, bespoke menu character models and detailed animation direction, plus testing compositions inside the game for usability. P5's UI presentation describes iterative prototyping and unusually strong graphic hierarchy. Apply that commitment to integration, not just diagonal buttons or a red overlay.

Primary interviews/presentations:
- https://www.famitsu.com/news/202311/29325647.html
- https://www.famitsu.com/news/201711/13145540.html

## Visual grammar

- **Palette:** ink #10111B; paper #F4ECD8; vermilion #E74736; midnight #242E50; brass #BFA36B. Vermilion is the brand/action accent, not a wash covering the entire world. Teal and mustard identify Vesper and Miso sparingly.
- **Characters:** elongated, convincing anatomy; fashion-led silhouette; clean hair masses; designed two/three-tone shading; expressive eyes and deliberate asymmetrical poses. Costume wear is selective. No generic miniature toy proportions.
- **World:** dense narrative perimeter, quiet readable combat lanes. Warm shop interiors against cool night streets. Recognizable transit gate, jazz club, diner, courier kiosk and gunsmith. Architecture has function, age and inhabitants. Avoid repetitive freestanding boxes with decorative lines.
- **Guns:** the closest and most carefully authored objects. Recognizable silhouette in black, elegant action/chamber construction, ivory enamel against dark steel, restrained brass and one personal charm. Every moving part must have a mechanical reason. Distinct first-person framing per weapon.
- **Interface:** composition built around character attitude. Transit tickets, guild stamps, cartridge silhouettes and cut-paper framing are our motifs. Large editorial type for identity, stable readable type for instructions. Halftone belongs in graphic illustrations, not over the aiming area.
- **Motion:** Rook moves with languid confidence and sharp recovery; Vesper is economical and precise; Miso is restless but capable. Shared competitive timings; personality in authored secondary motion. Menus respond immediately while poses and framing settle. Avoid delaying an action to show an animation.
- **Sound:** dry mechanical clicks, distinct slide/chamber accents and tactile cloth/footwork; restrained jazz instrumentation in menus. Do not import commercial Persona music or sound assets.

## World production

Read [WORLD-PRODUCTION.md](WORLD-PRODUCTION.md) for the explorable district layout, asset pipeline, measured fracture investigation, multiplayer destruction contract and soundtrack plan.

## Rendering plan

Use a hybrid pipeline: illustration for portraits and menu compositions, authored Blender meshes for guns/environment modules/first-person hands, cleaned Tripo character bases with edited topology/materials and authored animation. AI generation supplies source material; it does not establish production quality on its own.

1. Create target frames for selection, first-person traversal and one combat exchange. Review silhouette, value grouping, atmosphere and readability at actual play size.
2. Build one complete street corner and one complete character/weapon pair before extending the kit. A coherent small location is preferable to a large unfinished map.
3. Shared toon ramps for cloth/plaster, designed face shading, selective silhouette outlines on characters and weapons. Avoid outlining every pavement edge. Use physical material response only where metal/glass need it.
4. One shadow-casting directional key, cool hemisphere fill, emissive practicals and restrained local lights. Painted/baked contact detail carries most environmental richness. Fog separates distance without hiding missing art.
5. Instanced architectural modules, shared trim/material sets, modest texture sizes, no permanent particle fog. Prioritize character/gun silhouette and screen-space quality over polygon count.
6. Build a separate character-selection stage with close framing and authored poses. The gameplay idle loop alone is not a finished selection presentation.
7. Author first-person draw, fire, recoil recovery, reload and inspect as timed actions with sound contacts. Keep view control uninterrupted and camera shake optional.

Starting desktop budget: <=300 draw calls, <=750k visible triangles, <=60 textures, <=256 MB estimated texture memory, one 2048 shadow map, DPR <=1.7. Measure actual renderer diagnostics and frame-time percentiles; budgets are targets, not claims of current compliance.

## Acceptance gates

- A still of the actual running game reads as Gun Wizards without the logo.
- Character and weapon silhouettes are recognizable at gameplay scale.
- First-person gun, hands, contact poses and reload withstand close inspection.
- Opponents stay legible against both lit and shadowed backgrounds.
- Menu selection works immediately by mouse, keyboard and controller, including reduced motion and smaller windows.
- World design survives a full camera turn; no good-looking hero angle concealing unfinished surroundings.
- No claim of Persona/Riot production quality based on concept art, passing builds or automated bot outcomes. Record actual screenshots, performance and human playtest observations separately.

## Current gap

The existing bright courtyard, generic building masses, basic first-person hands and unedited generated character animation are prototype assets. The new direction is a production target, not a description of their current quality. Replacing these coherently takes priority over adding more roster members or decorative effects.
