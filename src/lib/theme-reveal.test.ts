// Theme-switch reveal: the circle maths and the "switch instantly" fallbacks.
// Run with: npm test
import {
  revealCircle,
  revealOrigin,
  revealUnavailable,
  switchThemeWithReveal,
} from "./theme-reveal";

let failures = 0;

function expectEqual<T>(label: string, actual: T, expected: T) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
    failures++;
  } else {
    console.log(`ok   ${label} = ${actual}`);
  }
}

function near(label: string, actual: number, expected: number) {
  if (Math.abs(actual - expected) > 1e-6) {
    console.error(`FAIL ${label}: expected ~${expected}, got ${actual}`);
    failures++;
  } else {
    console.log(`ok   ${label} ≈ ${expected}`);
  }
}

// From a corner the circle must reach the opposite corner: the full diagonal,
// which is sqrt(2) × the circle()% unit → 141.42...%.
{
  const c = revealCircle(0, 0, 1440, 900);
  near("corner.radius", c.radius, Math.hypot(1440, 900));
  expectEqual("corner.from", c.from, "circle(0% at 0% 0%)");
  expectEqual("corner.to", c.to, `circle(${Math.SQRT2 * 100}% at 0% 0%)`);
}

// From the centre the radius is half the diagonal → exactly 70.71...%.
{
  const c = revealCircle(195, 422, 390, 844);
  near("centre.radius", c.radius, Math.hypot(195, 422));
  expectEqual("centre.to", c.to, `circle(${Math.SQRT2 * 50}% at 50% 50%)`);
}

// Pressed near the top-end corner (Arabic header): reaches the far bottom corner.
{
  const c = revealCircle(40, 30, 390, 844);
  near("rtl.radius", c.radius, Math.hypot(350, 814));
}

// Mouse/touch uses the real press point; keyboard uses the button centre.
{
  const btn = {
    getBoundingClientRect: () => ({ left: 100, top: 10, width: 40, height: 44 }),
  } as unknown as EventTarget;
  const [mx, my] = revealOrigin({ detail: 1, clientX: 7, clientY: 9, currentTarget: btn });
  expectEqual("origin.mouse.x", mx, 7);
  expectEqual("origin.mouse.y", my, 9);
  const [kx, ky] = revealOrigin({ detail: 0, clientX: 0, clientY: 0, currentTarget: btn });
  expectEqual("origin.keyboard.x", kx, 120);
  expectEqual("origin.keyboard.y", ky, 32);
}

// Fallbacks: no View Transitions, or reduced motion → instant.
{
  const motionOk = { matchMedia: () => ({ matches: false }) } as unknown as Window;
  const reduced = { matchMedia: () => ({ matches: true }) } as unknown as Window;
  const withApi = { startViewTransition: () => {} } as unknown as Document;
  const noApi = {} as unknown as Document;
  expectEqual("fallback.noApi", revealUnavailable(noApi, motionOk), true);
  expectEqual("fallback.reducedMotion", revealUnavailable(withApi, reduced), true);
  expectEqual("fallback.animates", revealUnavailable(withApi, motionOk), false);
}

// When the look does not change (e.g. Dark → System on a dark device), the
// choice is still applied, with no transition started.
{
  let started = 0;
  let applied = 0;
  const g = globalThis as unknown as Record<string, unknown>;
  g.document = { startViewTransition: () => { started++; } };
  g.window = { matchMedia: () => ({ matches: false }), innerWidth: 390, innerHeight: 844 };
  switchThemeWithReveal(
    { detail: 1, clientX: 1, clientY: 1, currentTarget: null },
    () => { applied++; },
    false,
  );
  expectEqual("sameLook.applied", applied, 1);
  expectEqual("sameLook.noTransition", started, 0);
  delete g.document;
  delete g.window;
}

if (failures > 0) {
  console.error(`\n${failures} theme-reveal test(s) failed`);
  process.exit(1);
}
console.log("\nall theme-reveal tests passed");
