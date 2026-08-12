export const meta = {
  name: 'summarize-changes',
  description: 'Summarize each file changed on this branch, then synthesize one overview',
  whenToUse: 'Before writing a PR description, or to understand a branch you did not author',
  phases: [
    { title: 'Read', detail: 'one agent per changed file' },
    { title: 'Synthesize', detail: 'merge the per-file notes into one summary' },
  ],
}

// `args` is whatever you pass in the Workflow call: an array of file paths.
// Fall back to a small hard-coded set so the script is runnable as-is.
const files = Array.isArray(args) && args.length ? args : ['README.md']

const FILE_SUMMARY = {
  type: 'object',
  properties: {
    file: { type: 'string' },
    purpose: { type: 'string', description: 'what this file does, one sentence' },
    changes: {
      type: 'array',
      items: { type: 'string' },
      description: 'notable things changed on this branch, empty if unchanged',
    },
  },
  required: ['file', 'purpose', 'changes'],
}

phase('Read')

// parallel() is a barrier: it spawns all of these at once and waits for every one.
// A thunk that throws resolves to null, so filter before using the results.
const notes = (await parallel(
  files.map((f) => () =>
    agent(
      `Read ${f} and report what it does. Then run \`git diff main...HEAD -- ${f}\` ` +
        `and list what changed on this branch. Return data, not prose.`,
      { label: `read:${f}`, phase: 'Read', schema: FILE_SUMMARY },
    ),
  ),
)).filter(Boolean)

log(`read ${notes.length}/${files.length} files`)

phase('Synthesize')

const overview = await agent(
  `Here are per-file notes from a branch:\n\n${JSON.stringify(notes, null, 2)}\n\n` +
    `Write a 3-5 sentence summary of what this branch does as a whole. ` +
    `Lead with the change in behaviour, not the file list.`,
  { label: 'synthesize', phase: 'Synthesize' },
)

return { files: notes, overview }
