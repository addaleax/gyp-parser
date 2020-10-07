'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parse } = require('./');

{
  // Simple tests

  for (const input of [
    false,
    true,
    null,
    [],
    {},
    { foo: 'bar' },
    0.9,
    0,
    1,
    -1,
    -1e128
  ]) {
    assert.deepStrictEqual(parse(JSON.stringify(input)), input);
  }

  for (const input of [
    '{"ba": "zing"}',
    "{'ba': 'zing'}",
  ]) {
    assert.deepStrictEqual(parse(input), { 'ba': 'zing' });
  }

  assert.deepStrictEqual(parse('+2'), 2);
}

// File tests
{
  const dir = path.resolve(__dirname, 'test');
  for (const e of fs.readdirSync(dir)) {
    if (!e.endsWith('.in')) continue;
    const infile = path.join(dir, e);
    const outfile = path.join(dir, e.replace(/\.in$/, '.out'));

    fileTest(infile, outfile);
    fileTest(outfile, outfile);
  }

  const pjson = path.resolve(__dirname, 'package.json');
  fileTest(pjson, pjson);
}

function fileTest(infile, outfile) {
  const input = fs.readFileSync(infile, 'utf8');
  const output = fs.readFileSync(outfile, 'utf8');
  console.log(`Testing ${path.basename(infile)} vs ${path.basename(outfile)}`);
  assert.deepStrictEqual(parse(input), JSON.parse(output));
}
