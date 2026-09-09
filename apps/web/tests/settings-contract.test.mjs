import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../src/lib/settings-contract.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const { settingsToApi, settingsFromApi } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const api = { ai_enabled: true, confidence_threshold: 0.8, notification_email: false, notification_push: true, notification_sms: false };
test('80 percent saves as 0.8 using only DTO fields', () => {
  assert.deepEqual(settingsToApi({ ...settingsFromApi(api), id: 'not-writable', humanDetection: true, backendUrl: 'not-writable' }), api);
});
test('persisted threshold loads into the slider and survives round trip', () => {
  for (const confidence_threshold of [0, 0.55, 0.8, 1]) {
    const data = { ...api, confidence_threshold };
    assert.deepEqual(settingsToApi(settingsFromApi(data)), data);
  }
});
test('invalid threshold cannot reach the API', () => {
  for (const confidenceThreshold of [-1, 101, NaN, Infinity, '80']) {
    assert.throws(() => settingsToApi({ ...settingsFromApi(api), confidenceThreshold }));
  }
});
