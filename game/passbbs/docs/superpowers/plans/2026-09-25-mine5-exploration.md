# Mine5 exploration revision implementation plan
Goal: implement the user-approved task guidance, physical item requirements, organic caves, hidden encounters and environmental reactions.
Architecture: retain the standalone HTML and its existing engine prototype extensions. Workers edit isolated TEMP copies and return exact replacement patches; root integrates and verifies. No framework or dependency change.
Spec: approved seven-part design in this conversation (2026-09-25).
Constraints: 180x180 map; three descent exits; unique equipment and elite drops; 5/15 card capacity; no task arrows; concise functional Chinese UI; mobile and PC card layouts retained.
Review focus: mandatory item reachability, irreversible item loss, blocker path connectivity, completed clues versus reusable sites, environment reactions harming task objects.
- [x] Task engine: remove currency/time substitutes, add deterministic physical item sources, next-step guidance, meaningful sequence and rescue objectives. Verify completion and rejection paths.
- [x] Generator: organic region distribution/corridors, 45-75 walking-step near exit, unmineable pillars, sparse varied cache placement, connectivity and seeded variation checks.
- [x] Encounters/environment: guarded breach branch, visible warning traces, bounded gas/fire/water/support/membrane reactions, rare discoverable events; preserve quest objects and exits.
- [x] Guidance UI: no arrows, explicit needed items and evidence, state-driven clue archive without hiding reusable interactions.
- [x] Integrate narrow patches, run focused engine and browser tests, inspect map screenshots, report limitations accurately.

Verification: 29 integrated engine checks + 7 browser action/layout checks passed; final old collapsed-save and updated world checks 2 passed. Legacy chapter regression and 4 updated task checks passed. Independent review found and verified one restored empty-cache guardian issue; fixed. Seeded map visuals inspected. New map geometry takes effect on fresh generation (new run/next floor).
