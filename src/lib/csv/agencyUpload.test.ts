// Agency market-data upload rules. Run with: npm test
// Proves: an agency-mode parse can never yield OFFICIAL_STAT or VERIFIED, an
// agency save never replaces an existing figure, and the saved row carries the
// agency's name.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mayReplaceExistingStat } from "../db/marketStatData";
import { AGENCY_CONFIDENCE, parseMarketStatsCsv, type PlaceDirectory, type PlaceEntry } from "./marketStatsImport";
import {
  AGENCY_NOTE_PREFIX,
  MAX_UNAPPROVED_PER_AGENCY,
  agencyNoteMatch,
  existingFigureInfo,
  agencySourceNote,
  agencyWriteFor,
  isAgencyUploadNote,
  queueHasRoom,
} from "./agencyUpload";

let failures = 0;
function expectEqual<T>(label: string, actual: T, expected: T) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL ${label}: expected ${e}, got ${a}`);
    failures++;
  } else {
    console.log(`ok   ${label}`);
  }
}

const p = (slug: string, nameEn: string, nameAr: string): PlaceEntry => ({ id: `id-${slug}`, slug, nameEn, nameAr });
const PLACES: PlaceDirectory = {
  governorates: [p("muscat", "Muscat", "مسقط")],
  cities: [p("seeb", "Seeb", "السيب"), p("muttrah", "Muttrah", "مطرح")],
  neighborhoods: [
    p("qurum", "Qurum", "القرم"),
    p("al-khuwair", "Al Khuwair", "الخوير"),
    p("al-mouj", "Al Mouj", "الموج"),
    p("hawana-salalah", "Hawana Salalah", "هوانا صلالة"),
  ],
};
const parseAgency = (text: string) =>
  parseMarketStatsCsv(text, { mode: "agency", neighborhoodAllowed: true, places: PLACES });

const good = parseAgency(readFileSync(join(process.cwd(), "prisma", "fixtures", "market-stats-agency-good.csv"), "utf8"));
// A file that tries to ask for a label.
const sneaky = parseAgency(
  "area_level,area,property_type,metric,value,period_start,source_url,provenance,verified,confidence\n" +
    "city,seeb,,avgSalePrice,100000,2026-06-01,https://x.example/a,OFFICIAL_STAT,VERIFIED,1\n",
);

for (const [label, result] of [["good", good], ["sneaky", sneaky]] as const) {
  expectEqual(`${label}: parsed with no problems`, [result.fileErrors.length, result.rowErrors.length], [0, 0]);
  const writes = result.groups.map((g) => agencyWriteFor(g, "Bay Estates", "ag1"));
  expectEqual(`${label}: never OFFICIAL_STAT or VERIFIED`, writes.every((w) => w.provenance === "USER_SUBMITTED"), true);
  expectEqual(`${label}: confidence is the fixed agency value`, writes.every((w) => w.confidence === AGENCY_CONFIDENCE && w.confidence === 0.5), true);
  expectEqual(`${label}: every write is skip-on-conflict`, writes.every((w) => w.onConflict === "skip"), true);
  expectEqual(`${label}: every write keeps a source link`, writes.every((w) => /^https?:\/\//.test(w.sourceUrl)), true);
}

// An agency save never replaces: "skip" refuses every kind of existing row.
for (const provenance of ["OFFICIAL_STAT", "VERIFIED", "USER_SUBMITTED", "AI_ESTIMATED", "LISTING_DERIVED"]) {
  for (const isSample of [false, true]) {
    expectEqual(
      `skip never replaces ${provenance}${isSample ? " (sample)" : ""}`,
      mayReplaceExistingStat(agencyWriteFor(good.groups[0], "Bay Estates", "ag1").onConflict, { provenance, isSample }),
      false,
    );
  }
}

// The saved row carries the agency name.
expectEqual("note with no file note", agencySourceNote("Bay Estates", ""), "Submitted by agency: Bay Estates");
expectEqual(
  "note with a file note",
  agencySourceNote("Bay Estates", "own listings data"),
  "Submitted by agency: Bay Estates - own listings data",
);
expectEqual(
  "saved notes carry the agency name",
  good.groups.every((g) => agencyWriteFor(g, "Bay Estates", "ag1").sourceNote.startsWith(`${AGENCY_NOTE_PREFIX}Bay Estates`)),
  true,
);
expectEqual("note recognised as an agency upload", [isAgencyUploadNote("Submitted by agency: X"), isAgencyUploadNote("Official"), isAgencyUploadNote(null)], [true, false, false]);
expectEqual("queue note shapes", agencyNoteMatch(" Bay Estates "), {
  exact: "Submitted by agency: Bay Estates",
  startsWith: "Submitted by agency: Bay Estates - ",
});

// The agency id is stored on every saved row (the queue is counted by it).
expectEqual(
  "saved rows carry the agency id",
  good.groups.every((g) => agencyWriteFor(g, "Bay Estates", "ag1").submittedByAgencyId === "ag1"),
  true,
);

// The preview never reveals the source of a figure the public cannot see.
{
  const base = { confidence: 0.5, isSample: false };
  expectEqual(
    "unapproved submission: nothing revealed",
    existingFigureInfo({ ...base, provenance: "USER_SUBMITTED", verifiedAt: null }),
    { shown: false },
  );
  expectEqual(
    "approved submission: shown",
    existingFigureInfo({ ...base, provenance: "USER_SUBMITTED", verifiedAt: new Date() }),
    { shown: true, provenance: "USER_SUBMITTED", confidence: 0.5, isSample: false },
  );
  expectEqual(
    "official figure: shown",
    existingFigureInfo({ ...base, provenance: "OFFICIAL_STAT", verifiedAt: null }).shown,
    true,
  );
}

// The waiting-queue cap.
expectEqual("queue: room", queueHasRoom(0, 8), true);
expectEqual("queue: exactly full after", queueHasRoom(MAX_UNAPPROVED_PER_AGENCY - 8, 8), true);
expectEqual("queue: would overflow", queueHasRoom(MAX_UNAPPROVED_PER_AGENCY - 7, 8), false);
expectEqual("queue: already full", queueHasRoom(MAX_UNAPPROVED_PER_AGENCY, 0), false);

if (failures > 0) {
  console.error(`\n${failures} agency upload check(s) failed`);
  process.exit(1);
}
console.log("\nAll agency upload checks passed.");
