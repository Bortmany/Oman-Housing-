// Guard for the "Import button does nothing" bug. React empties an uncontrolled
// form (including the chosen file) as soon as a <form action={...}> finishes, so
// the second step ("confirm") had no file to send. Both upload screens must send
// their form by hand (onSubmit + startTransition) and must not use <form action>.
// Run: tsx src/lib/csv/uploadFormSubmit.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const files = [
  "src/app/[locale]/(admin)/admin/market-stats/import/ImportForm.tsx",
  "src/app/[locale]/(agency)/agency/data/DataUploadForm.tsx",
];

for (const f of files) {
  const src = readFileSync(join(process.cwd(), f), "utf8");
  assert.ok(!/<form[^>]*\saction=/.test(src), `${f}: <form action> would wipe the chosen file`);
  assert.ok(/<form[^>]*onSubmit=\{submit\}/.test(src), `${f}: form must use the manual submit`);
  assert.ok(/startTransition\(\(\) => formAction\(data\)\)/.test(src), `${f}: must dispatch inside startTransition`);
  assert.ok(/new FormData\(e\.currentTarget, submitter\)/.test(src), `${f}: must include the pressed button's intent`);
  assert.ok(!/formAction=\{/.test(src), `${f}: buttons must not carry their own formAction`);
}
console.log("uploadFormSubmit.test: ok");
