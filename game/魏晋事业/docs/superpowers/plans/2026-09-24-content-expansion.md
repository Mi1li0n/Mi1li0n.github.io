# Dungeon content expansion implementation plan

**Goal:** Add six optional unique elites, a broader card pool, and meaningful fog environments to mine5.html.
**Architecture:** Preserve the existing single HTML file and prototype extension pattern. Keep additions in separate engine layers and small renderer hooks; preserve saves, equipment uniqueness and card capacity.
**Tech stack:** JavaScript, Canvas, Node test runner and headless Edge/Playwright.
**Spec:** User-approved elite/drop proposal and current request for more items and fog.

## Constraints
- Two distinct elites per floor, each only once, with telegraphed skills and matching drops.
- Default departure remains bread and kit; five departure cards, fifteen carried cards.
- No loot lost when full; gear unique; consumables repeat.
- Preserve 180x180 maps, three descending exits, and directional lighting/fuel.
- Fog affects both player vision and enemy sight, not hearing; terrain-only visibility must never reveal creatures.
- No extra instructional UI copy.

## Tasks
- [x] Add environment regression tests: generated pockets avoid camp/sites, sight occlusion, dispersal expiry, toxic exposure, save and descent.
- [x] Implement seeded mist, dust and spore pockets; transient smoke/clear zones; light attenuation, enemy sight and restrained canvas overlay.
- [x] Integrate independent regular item patch and verify availability, quantities, turn costs and card controls.
- [x] Integrate independent elite patch and verify spawning, attack warnings, anti-instant-kill rules and unique drops.
- [x] Test combined UI and save/restore; run full existing and new regressions; fix failures and review integration.

## Review focus
- Loading old saves must initialize missing fields without duplicating rewards or encounters.
- Temporary effects must expire with turns, survive saves and reset on descent.
- Fog behind walls must not reduce light in a clear corridor or reveal hidden enemies.
- Full inventory and previously claimed equipment must retain legitimate drops on the ground.
- New card controls and elite abilities must obey action timing and not act through modals or from camp.

## Additional authorized scope: encounters and neutral NPCs
- [x] Add one stocked mine merchant per floor, one of Fu/Lu/Shou, and two varied friendly/neutral NPCs on accessible safe tiles.
- [x] Integrate priced card transactions and limited blessings with atomic capacity/uniqueness checks; persist per-NPC completed choices.
- [x] Diversify miner rescue into wounded/trapped/lost encounters while preserving the existing escort and chapter completion contracts.
- [x] Verify merchant UI, full inventory, repeated interactions, blessing limits, rescue variants, save/restore and descent.

## Additional authorized scope: independent mineral wallet
- [x] Add a separate wallet card outside departure and carried-card limits, with silver, copper, iron, gold and crystal resources.
- [x] Integrate mineral vein rewards, automatic and individual pickup, merchant exchange, save/restore, descent and expedition loss/deposit.
- [x] Verify full-pack pickup, mining/explosion reward idempotency, desktop/mobile wallet UI and free interactions.

## Verification so far
- Initial combined content suite: 244/244 passing.
- Independent code review completed; reported animation, selected-card, resource, transaction and escort edge cases fixed with regressions.
- Final combined suite: 275/275 passing (359 seconds). Subsequent focused checks: free-trade/mineral fixes 4/4; enhanced wallet UI 2/2; elite alignment/telegraph checks 3/3; merchant uniqueness/free-trade checks 4/4. All reported review issues resolved.
