#!/usr/bin/env node
'use strict';

const repo = require('../lib/todo-repository');
const { parseIndex } = require('../lib/parse-index');

const USAGE = 'Usage: todo <add|list|done|rm> ...';

function cmdAdd(args) {
  const text = (args[0] || '').trim();
  if (!text) {
    console.error('Error: missing todo text (E_MISSING_TEXT)');
    process.exitCode = 1;
    return;
  }

  let items;
  try {
    items = repo.load();
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  items.push({ text, done: false });
  repo.save(items);
  console.log(`Added: "${items.length}) ${text}"`);
}

function cmdList(_args) {
  let items;
  try {
    items = repo.load();
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  if (items.length === 0) {
    console.log('No todos yet.');
    return;
  }

  items.forEach((item, i) => {
    const mark = item.done ? 'x' : ' ';
    console.log(`${i + 1}) [${mark}] ${item.text}`);
  });
}

function cmdDone(args) {
  let items;
  try {
    items = repo.load();
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  let n;
  try {
    n = parseIndex(args[0], items.length);
  } catch (err) {
    console.error(`Error: ${err.code} - ${err.message}`);
    process.exitCode = 1;
    return;
  }

  items[n - 1].done = true;

  try {
    repo.save(items);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Done: "${n}) ${items[n - 1].text}"`);
}

function cmdRm(args) {
  let items;
  try {
    items = repo.load();
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  let n;
  try {
    n = parseIndex(args[0], items.length);
  } catch (err) {
    console.error(`Error: ${err.code} - ${err.message}`);
    process.exitCode = 1;
    return;
  }

  const [removed] = items.splice(n - 1, 1);

  try {
    repo.save(items);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Removed: "${n}) ${removed.text}"`);
}

function main(argv) {
  const cmd = argv[2];
  const args = argv.slice(3);

  if (!cmd) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  switch (cmd) {
    case 'add':
      cmdAdd(args);
      break;
    case 'list':
      cmdList(args);
      break;
    case 'done':
      cmdDone(args);
      break;
    case 'rm':
      cmdRm(args);
      break;
    default:
      console.error(`Error: unknown command "${cmd}". ${USAGE}`);
      process.exitCode = 1;
  }
}

main(process.argv);
