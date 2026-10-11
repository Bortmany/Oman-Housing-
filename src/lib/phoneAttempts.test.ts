// Code-try limit — database test (needs the _test database; run with: npm test).
// Ten guesses fired at once must still only get five tries.
let failures = 0;
function expectEqual<T>(label: string, actual: T, expected: T) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failures++;
  } else console.log(`ok   ${label}`);
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/_test(\?|$)/.test(url)) {
    console.error("Refusing to run: DATABASE_URL is not a *_test database.");
    process.exit(1);
  }
  const { prisma } = await import("@/lib/prisma");
  const { claimCodeTry } = await import("./phoneAttempts");
  const email = `pa${Date.now()}@example.com`;
  const user = await prisma.user.create({
    data: { email, phoneVerifyPending: "+968 91234567", phoneVerifyAttempts: 0 },
  });
  try {
    const results = await Promise.all(Array.from({ length: 10 }, () => claimCodeTry(user.id, "+968 91234567")));
    expectEqual("ten at once: only five get a try", results.filter((r) => r !== null).length, 5);
    const row = await prisma.user.findUnique({ where: { id: user.id }, select: { phoneVerifyAttempts: true } });
    expectEqual("counter stops at five", row?.phoneVerifyAttempts, 5);
    expectEqual("a sixth is refused", await claimCodeTry(user.id, "+968 91234567"), null);
    expectEqual("a different pending number is refused", await claimCodeTry(user.id, "+968 92345678"), null);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
  if (failures > 0) {
    console.error(`\n${failures} phone-attempt test(s) failed`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
