#!/usr/bin/env node
// fizzbuzz <n> — prints lines 1..n with Fizz/Buzz/FizzBuzz substitutions.
//
// CORRECT control build: the "divisible by both" case is tested first, so a
// multiple of 15 prints "FizzBuzz" (AC4 satisfied). The process oracle PASSes
// this build on every Test-Surface row — the negative-control half of the
// fixture that proves the oracle is not a rubber stamp.
const n = Number(process.argv[2]);
if (!Number.isInteger(n) || n < 1) {
  console.error("usage: fizzbuzz <positive integer>");
  process.exit(1);
}
const out = [];
for (let i = 1; i <= n; i++) {
  if (i % 15 === 0) out.push("FizzBuzz");
  else if (i % 3 === 0) out.push("Fizz");
  else if (i % 5 === 0) out.push("Buzz");
  else out.push(String(i));
}
console.log(out.join("\n"));
