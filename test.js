// Run with: node test.js  — verifies the SquatCounter state machine.
const { SquatCounter, CONFIG } = require('./squat-counter.js');

let passed = 0, failed = 0;
function check(name, actual, expected) {
  const ok = actual === expected;
  console.log(`${ok ? '✅' : '❌'} ${name}: got ${actual}, expected ${expected}`);
  ok ? passed++ : failed++;
}

// Helper: feed a constant angle N frames
function feed(counter, angle, frames) {
  let last;
  for (let i = 0; i < frames; i++) last = counter.update(angle, angle);
  return last;
}

// 1. Full squat cycle = 1 rep
let c = new SquatCounter();
feed(c, 170, 10);           // standing
feed(c, 120, 10);           // descending
feed(c, 85, 10);            // bottom (below MIN_REP_DEPTH)
let flag = false;
for (let i = 0; i < 10; i++) if (feed(c, 170, 1).repCounted) flag = true; // back to top
check('full cycle counts 1 rep', c.reps, 1);
check('rep flag fired during return to top', flag, true);

// 2. Half squat (not deep enough) = 0 reps
c = new SquatCounter();
feed(c, 170, 10);
feed(c, 110, 10);           // only to 110°, above MIN_REP_DEPTH 90°
feed(c, 170, 10);
check('half squat not counted', c.reps, 0);

// 3. Bounce at bottom doesn't double-count
c = new SquatCounter();
feed(c, 170, 10);
feed(c, 85, 10);
feed(c, 120, 3);            // small bounce up
feed(c, 85, 3);
feed(c, 170, 10);
check('bottom bounce = 1 rep', c.reps, 1);

// 4. Two full reps
c = new SquatCounter();
for (let rep = 0; rep < 2; rep++) {
  feed(c, 170, 10);
  feed(c, 85, 10);
  feed(c, 170, 10);
}
check('two cycles = 2 reps', c.reps, 2);

// 5. Reset works
c.reset();
check('reset clears reps', c.reps, 0);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);