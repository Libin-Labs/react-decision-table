import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
const dom = new JSDOM("<!doctype html><div id='root'></div>");
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = await import('react');
const { createRoot } = await import('react-dom/client');
const api = await import('../dist/esm/index.js');
const cjs = createRequire(import.meta.url)('../dist/cjs/index.js');
test('ESM and CommonJS expose the same runtime API', () =>
  assert.deepEqual(
    Object.keys(cjs)
      .filter((key) => key !== '__esModule')
      .sort(),
    Object.keys(api).sort(),
  ));
test('evaluates deterministic priority and hit policies', () => {
  const table = {
    hitPolicy: 'first',
    rules: [
      {
        id: 'later',
        priority: 2,
        conditions: [{ field: 'age', operator: 'gte', value: 18 }],
        actions: { tier: 'adult' },
      },
      {
        id: 'earlier',
        priority: 1,
        conditions: [{ field: 'age', operator: 'gte', value: 18 }],
        actions: { tier: 'young-adult' },
      },
    ],
  };
  assert.deepEqual(api.evaluateDecisionTable(table, { age: 21 }).actions, { tier: 'young-adult' });
  assert.throws(
    () => api.evaluateDecisionTable({ ...table, hitPolicy: 'unique' }, { age: 21 }),
    api.DecisionTableError,
  );
  assert.throws(
    () =>
      api.evaluateDecisionTable(
        {
          rules: [
            { id: 'bad', conditions: [{ field: '__proto__.x', operator: 'exists' }], actions: {} },
          ],
        },
        {},
      ),
    /Unsafe/u,
  );
  const action = api.evaluateDecisionTable(
    { rules: [{ id: 'safe-key', conditions: [], actions: JSON.parse('{"__proto__":true}') }] },
    {},
  );
  assert.equal(action.actions.__proto__, true);
  assert.equal(Object.getPrototypeOf(action.actions), Object.prototype);
});
test('renders decision rows and allows adding rows', async () => {
  const root = createRoot(document.getElementById('root'));
  let changed;
  await React.act(async () =>
    root.render(
      React.createElement(api.DecisionTableEditor, {
        table: { rules: [], hitPolicy: 'first' },
        onChange: (value) => {
          changed = value;
        },
      }),
    ),
  );
  await React.act(async () => document.querySelector('button')?.click());
  assert.equal(changed.rules.length, 1);
  await React.act(async () => root.unmount());
});
