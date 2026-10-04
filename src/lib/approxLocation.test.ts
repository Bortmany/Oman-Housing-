// Approximate-location rules. Run with: npm test
// A home with no spot of its own is placed at its neighbourhood's centre and
// marked approximate; the centre is never written onto the home.
import { effectiveLocation, inBounds, matchesArea } from "./approxLocation";

let failures = 0;
function expectEqual<T>(label: string, actual: T, expected: T) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failures++;
  } else console.log(`ok   ${label}`);
}

const hood = { lat: 23.6, lng: 58.4 };
const box = { n: 23.7, s: 23.5, e: 58.5, w: 58.3 };
const elsewhere = { n: 18, s: 17, e: 55, w: 54 };

expectEqual("own coordinates win, not approximate", effectiveLocation({ lat: 23.61, lng: 58.41 }, hood), { lat: 23.61, lng: 58.41, approximate: false });
expectEqual("no coordinates -> neighbourhood centre, approximate", effectiveLocation({ lat: null, lng: null }, hood), { lat: 23.6, lng: 58.4, approximate: true });
expectEqual("half a pair counts as none", effectiveLocation({ lat: 23.6, lng: null }, hood)?.approximate, true);
expectEqual("no coordinates anywhere -> null", effectiveLocation({ lat: null, lng: null }, { lat: null, lng: null }), null);
expectEqual("no neighbourhood -> null", effectiveLocation({ lat: null, lng: null }, null), null);

expectEqual("home with no spot matches the area holding its neighbourhood", matchesArea({ lat: null, lng: null }, hood, box), true);
expectEqual("...and not an area elsewhere", matchesArea({ lat: null, lng: null }, hood, elsewhere), false);
expectEqual("own spot outside the box does not match even if the centre is inside", matchesArea({ lat: 18.5, lng: 54.5 }, hood, box), false);
expectEqual("nothing known never matches", matchesArea({ lat: null, lng: null }, null, box), false);
expectEqual("box edges are inclusive", inBounds({ lat: 23.7, lng: 58.3 }, box), true);

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log("\nAll approximate-location tests passed.");
