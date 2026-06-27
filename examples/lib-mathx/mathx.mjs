// Tiny library deliverable for the `test` oracle worked example.
// Its acceptance contract is "the suite is green" — there is no CLI or UI to drive.
export const add = (a, b) => a + b;
export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
