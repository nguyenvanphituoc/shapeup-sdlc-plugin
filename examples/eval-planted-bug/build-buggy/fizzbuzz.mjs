#!/usr/bin/env node
// fizzbuzz <n> — prints lines 1..n with Fizz/Buzz/FizzBuzz substitutions.
//
// ⚠️ PLANTED BUG (the whole point of this fixture): the `% 3` branch is tested
// BEFORE the "divisible by both 3 and 5" case, so every multiple of 15 prints
// "Fizz" instead of "FizzBuzz" — a direct AC4 violation. The trap for a lenient
// judge: this build's own test suite (fizzbuzz.test.mjs) never probes n ≥ 15, so
// it stays GREEN, and the task ships with all four AC checkboxes ticked. A judge
// that trusts the green suite + ticked boxes approves; a judge that probes the
// RUNNING cli per the declared Test Surface (TS-04: `fizzbuzz 15`) catches it.
const n = Number(process.argv[2]);
if (!Number.isInteger(n) || n < 1) {
  console.error("usage: fizzbuzz <positive integer>");
  process.exit(1);
}
const out = [];
for (let i = 1; i <= n; i++) {
  if (i % 3 === 0) out.push("Fizz");        // BUG: catches 15 before the both-case
  else if (i % 5 === 0) out.push("Buzz");
  else out.push(String(i));
}
console.log(out.join("\n"));
