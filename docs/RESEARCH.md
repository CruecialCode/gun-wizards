# Source research and adopted decisions

## Original concept

[Shared Gun Wizards conversation](https://chatgpt.com/share/6ac42b56-f554-83ea-bb21-3948c1786fe6). Read in the browser, including the original elemental-gun pitch and the final feel-only demo revision. Preserve the latest constraints where the new brief does not override them: first-person, controller-friendly, no elemental system yet, readable painterly/cel-shaded fantasy, strong handcrafted pistol silhouettes. The current user brief overrides the old “no multiplayer” and one-character scope.

## HumanLayer / 12-factor agents

[Repository](https://github.com/humanlayer/12-factor-agents), especially [own control flow](https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-08-own-your-control-flow.md), [compact errors](https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-09-compact-errors.md), and the README's context/prompt/state principles.

Applied: deterministic setup and test commands; explicit action choices in the Jev harness; prompts and decisions retained as project files; bounded errors; focused PRs; stable handoff documentation. No agent framework or copied prose is embedded in runtime gameplay. A model chooses tactical intent; game code and authoritative reducers decide valid outcomes.

## MengTo / Skills

[Repository](https://github.com/MengTo/skills), [action combat](https://github.com/MengTo/skills/blob/main/agent-skills/game-development/design-action-combat/SKILL.md), and [camera controls](https://github.com/MengTo/skills/blob/main/agent-skills/game-development/build-game-camera-controls/SKILL.md).

Applied: explicit action/recovery windows, authoritative contacts with range/direction/line-of-sight checks, deterministic edge cases, readable camera framing, layered effects, reusable asset generation, and inspecting the running result. The broader library was reviewed for asset, audio, game QA and shipping workflows; only relevant techniques were adopted. Project instructions remain authoritative.

## Bungie / Destiny

[Deterministic recoil design discussion](https://www.bungie.net/7/en/News/article/twid_09_21_2023): learnable weapon behavior informs our fixed shot cadence and restrained recoil.

[Thunderlord design](https://www.bungie.net/7/en/News/Article/11089/undefined): a weapon's personality is expressed through its construction and behavior. Applied as three original mechanical silhouettes and material identities, not copied weapon designs.

[Character development](https://www.bungie.net/7/en/News/article/10377): concept-to-model-to-animation iteration informs our generated concepts, rig validation and runtime inspection.

[User Research on Destiny](https://www.gdcvault.com/play/1022355/User-Research-on): the session abstract establishes player research as part of iteration; we do not claim to have viewed inaccessible video content or to reproduce Bungie's internal methods. Human feel testing remains necessary.

## Technical sources

- [SpacetimeDB getting started](https://spacetimedb.com/docs/): local server, module publishing and architecture.
- [TypeScript client reference](https://spacetimedb.com/docs/clients/typescript/): authenticated guest identities, subscriptions and generated bindings.
- Installed SpacetimeDB 2.10.2 SDK source: scheduled reducers and current API shapes, verified by compilation and live clients.
- [Jev Choice API](https://docs.typesafe.ai/primitives/choice): batched typed choices with confidence. Tested against `jev-1.13.0` through `jev-latest`.

The references inspire specific techniques. No claim is made that this prototype reaches the polish of Destiny, Riot character production, Cowboy Bebop choreography, or a released fighting game.
