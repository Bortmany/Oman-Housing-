# Step 1 — browser-check findings still to fix (queued after Step 3)

From the Step 1 browser check, 30 Sep 2026 (all acceptance scenarios PASSED; screenshots in .data/test-shots/step1/, local only).

1. (Medium) Sample-badge hints can't be opened by tap on phones where the badge sits inside a link card (dashboard cards) — give the hint another tap route (e.g. a small "i" button outside the link, or a one-line visible caption on the card) without making a focusable element inside the link.
2. (Medium) Hint bubble squeezed to the badge's width (~90px, ~10 lines) — let it size up to ~224px, both languages.
3. (Medium) Home page still says "See live market data" / "اطّلع على بيانات السوق الحية" while all figures are sample — soften while only sample data exists (same switch as the other home copy).
4. (Low) Home "Market pulse" note promises "how confident we are" but sample cards show no confidence — adjust wording while sample-only; review "Browse properties with honest financials".
5. (Low) "AI estimated" badge on the "Ask the AI analyst" card labels no figure — remove or replace with a non-provenance note.
6. (Low) Wording: admin success after replacing a sample row → "Replaced the sample figure"; recorded-property cards show two sample badges (keep one); "OMR 2,140per month" missing space in text; "1 beds" → "1 bed" (and Arabic plural); growth formatting "+5%" vs "+3.4%" consistent.
Not a bug (owner note): badge placement start vs end side differs by screen but matches English layout in each case.
Cautious by design (no change): figures worked out from an official input still say "Sample data" if any other input is sample.
