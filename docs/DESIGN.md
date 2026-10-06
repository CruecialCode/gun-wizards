# Gun Wizards / Last Call

## The promise

A wizard's pistol is a little machine with a big personality. Movement should feel good in an empty courtyard. Combat should reward spacing, timing and improvisation, with enough recovery to read another player's intent.

The source conversation establishes first-person play, handcrafted pistols, modest readable proportions, a painterly world between BOTW and Spellbreak, and a final feel-only milestone without elemental bullets. The current brief explicitly expands that milestone to login, a starting roster and multiplayer battle royale. Elemental chemistry, dungeon extraction, adaptive bosses and seasonal charms remain future systems rather than implied shipped features.

## Current art direction

The latest user brief makes Persona the primary visual reference. Read [ART-DIRECTION.md](ART-DIRECTION.md) before art, UI, lighting, character or animation work. Its occult jazz noir direction supersedes the earlier painterly reference; the first-person and multiplayer requirements remain.

## World

The skyports still run. Nobody remembers who built the floating roads. Guild gunsmiths certify every pistol, invoice every repair, and insist that the ringing under the city is perfectly normal. The Last Call is a tavern, transit stop and dueling yard at the edge of those roads. Its crew cannot afford to be heroes. They keep doing it anyway.

This is new prototype lore, not a claim that these names appeared in the source chat.

- **Rook / the bad penny:** a duelist carrying a stolen guild pistol and an unpaid breakfast tab. Oxblood coat, walnut and brass. His Bad Omen looks meticulously repaired.
- **Vesper / the last word:** a courier delivering letters to vanished cities. Teal, ivory, deliberate lines. Dead Letter has a long ceramic shroud and blue-steel core.
- **Miso / the happy accident:** a fox-masked gunsmith who makes exquisite weapons and inedible soup. Mustard workwear, twin barrels, a tiny bell. Lucky Cat should look ingenious rather than safe.

All three have the same combat tuning in this first release. Personality comes from silhouette, costume, weapon construction and presentation.

## Feel targets and tradeoffs

| Verb | Initial tuning | Purpose |
| --- | --- | --- |
| Walk / sprint | 7.5 / 11.5 m/s | Immediate traversal; controllable approach |
| Jump | 9 m/s impulse, 25 m/s² gravity | Short, readable arc |
| Dodge | 23 m/s for 170 ms, 950 ms cooldown | Commit to a direction; no invulnerability |
| Slide | 550 ms with friction | Carry sprint momentum; steer less |
| Pistol | 235 ms shot recovery, 8 rounds, 18 damage | Learnable rhythm; six body hits to eliminate at 100 HP |
| Reload | 1.15 s | Visible action and a punishable window |
| Strike | 3 m contact, 700 ms recovery, 30 damage | Close-range payoff and displacement |
| Guard | Frontal block, movement reduced to 4 m/s | Trade mobility for directional defense |

These are our prototype decisions, not Bungie's numerical settings. Weapon animation carries recoil; camera movement remains restrained. Raw aim is not hidden by strong aim assist. Controller deadzone, sensitivity, ADS and vibration are adjustable.

## Measuring the fighting-game qualities

Smash-like fun cannot be reduced to one model score. Test several observable properties, then ask human players whether the result feels good:

1. **Agency:** input-to-local-response latency; movement response at 30/60/120 fps; failures to jump or dodge when expected.
2. **Readable exchange:** a player can identify shot/guard/strike events, damage source, and recovery windows. Measure blocked shots and successful punish opportunities.
3. **Expressiveness:** distance traveled, dodges, jumps, slides, distinct actions per engagement and changes of approach. High action count alone is not success.
4. **Counterplay:** guard can be flanked; cover stops bullets; melee requires close range; cooldowns prevent infinite dodges. Test these as mechanics.
5. **Recovery and rematch:** time from elimination to the next round; no dead lobby or lost identity after reconnect.
6. **Human desire to repeat:** after five minutes, ask “Would you play another round?” and “Which action felt least natural?” Record the answer separately from bot metrics.

Jev chooses high-level tactics for independent live clients. Deterministic code handles aiming, valid input construction and the 30 Hz transport. Its decisions and measured match outcomes are saved in `docs/qa/`; they are not proof of subjective fun.

## Boundaries for the first release

No loot progression, paid cosmetics, inventory, elements, extraction, adaptive dungeon director or promise of competitive anti-cheat. The server rejects invalid inputs and owns outcomes. Production work still needs interest management, rate limiting, reconnect/session ownership, latency reconciliation and load testing.
