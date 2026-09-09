import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const { outputText } = ts.transpileModule(readFileSync(new URL('../src/lib/ui-action.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
});
const { runUiAction } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
test('rejected save reports error and does not run success cleanup or reject the event promise', async () => {
  let reports = 0, closed = false;
  await runUiAction(async () => {
    await Promise.reject(new Error('HTTP 400'));
    closed = true;
  }, () => reports++);
  assert.equal(reports, 1);
  assert.equal(closed, false);
});
test('successful action completes without false error feedback', async () => {
  let saved = false;
  await runUiAction(async () => { saved = true; }, () => assert.fail('unexpected error'));
  assert.equal(saved, true);
});
