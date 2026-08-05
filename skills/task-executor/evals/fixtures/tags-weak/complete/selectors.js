// Selectors resolve against the list AS IT WAS when the command started, and one bad selector
// refuses the whole batch.
export function resolveSelectors(rest, count) {
  const indexes = new Set();
  for (const token of rest) {
    const range = token.match(/^(\d+)-(\d+)$/);
    const nums = range ? [Number(range[1]), Number(range[2])] : [Number(token), Number(token)];
    if (!Number.isInteger(nums[0]) || !Number.isInteger(nums[1]) || nums[0] < 1 || nums[1] > count || nums[0] > nums[1]) {
      return { error: `no item ${token}` };
    }
    for (let n = nums[0]; n <= nums[1]; n++) indexes.add(n - 1);
  }
  return { indexes: [...indexes] };
}
