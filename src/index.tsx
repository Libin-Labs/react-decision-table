import { useState } from 'react';
import type * as React from 'react';

export type DecisionValue = string | number | boolean | null;
export type ConditionOperator =
  'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in' | 'exists';
export interface DecisionCondition {
  field: string;
  operator: ConditionOperator;
  value?: DecisionValue | readonly DecisionValue[];
}
export interface DecisionRule {
  id: string;
  label?: string;
  priority?: number;
  conditions: readonly DecisionCondition[];
  actions: Readonly<Record<string, DecisionValue>>;
  enabled?: boolean;
}
export type HitPolicy = 'first' | 'unique' | 'collect';
export interface DecisionTable {
  rules: readonly DecisionRule[];
  hitPolicy?: HitPolicy;
}
export interface DecisionResult {
  matches: readonly DecisionRule[];
  actions: Readonly<Record<string, DecisionValue>>;
}
export class DecisionTableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecisionTableError';
  }
}
export function validateDecisionTable(table: DecisionTable): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  if (!['first', 'unique', 'collect'].includes(table.hitPolicy ?? 'first'))
    errors.push('Unknown hit policy.');
  for (const rule of table.rules) {
    if (!rule.id || ids.has(rule.id))
      errors.push(`Rule identifiers must be unique and non-empty: ${rule.id}`);
    ids.add(rule.id);
    for (const condition of rule.conditions) {
      if (!condition.field) errors.push(`Rule ${rule.id} has an empty condition field.`);
      if (
        !['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'in', 'exists'].includes(
          condition.operator,
        )
      )
        errors.push(`Rule ${rule.id} has an unsupported operator.`);
      if (condition.operator === 'in' && !Array.isArray(condition.value))
        errors.push(`Rule ${rule.id}: 'in' expects an array value.`);
    }
  }
  return errors;
}
function compare(actual: unknown, condition: DecisionCondition): boolean {
  const expected = condition.value;
  switch (condition.operator) {
    case 'exists':
      return condition.value === true
        ? actual !== undefined
        : condition.value === false
          ? actual === undefined
          : actual !== undefined;
    case 'eq':
      return actual === expected;
    case 'neq':
      return actual !== expected;
    case 'gt':
      return typeof actual === 'number' && typeof expected === 'number' && actual > expected;
    case 'gte':
      return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;
    case 'lt':
      return typeof actual === 'number' && typeof expected === 'number' && actual < expected;
    case 'lte':
      return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;
    case 'contains':
      return typeof actual === 'string' && typeof expected === 'string'
        ? actual.includes(expected)
        : Array.isArray(actual) && actual.includes(expected);
    case 'in':
      return Array.isArray(expected) && expected.includes(actual as DecisionValue);
  }
}
function pathValue(input: unknown, path: string): unknown {
  const parts = path.split('.');
  if (
    !path ||
    parts.some((part) => !part || ['__proto__', 'prototype', 'constructor'].includes(part))
  )
    throw new DecisionTableError(`Unsafe or empty field path: ${path}`);
  let value = input;
  for (const part of parts) {
    if (!value || typeof value !== 'object' || !Object.prototype.hasOwnProperty.call(value, part))
      return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}
export function evaluateDecisionTable(table: DecisionTable, input: unknown): DecisionResult {
  const errors = validateDecisionTable(table);
  if (errors.length) throw new DecisionTableError(errors[0]);
  const ordered = table.rules
    .filter((rule) => rule.enabled !== false)
    .slice()
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0) || a.id.localeCompare(b.id));
  const matches = ordered.filter((rule) =>
    rule.conditions.every((condition) => compare(pathValue(input, condition.field), condition)),
  );
  const policy = table.hitPolicy ?? 'first';
  if (policy === 'unique' && matches.length > 1)
    throw new DecisionTableError(`Unique hit policy matched ${matches.length} rows.`);
  const selected = policy === 'first' ? matches.slice(0, 1) : matches;
  const actionValues = new Map<string, DecisionValue>();
  for (const rule of selected)
    for (const [key, value] of Object.entries(rule.actions)) actionValues.set(key, value);
  const actions = Object.fromEntries(actionValues) as Record<string, DecisionValue>;
  return { matches: selected, actions };
}
export interface DecisionTableEditorProps {
  table: DecisionTable;
  onChange: (table: DecisionTable) => void;
  className?: string;
}
export function DecisionTableEditor({
  table,
  onChange,
  className,
}: DecisionTableEditorProps): React.ReactElement {
  const [drafts, setDrafts] = useState<Record<string, { conditions: string; actions: string }>>({});
  const replace = (rule: DecisionRule, changes: Partial<DecisionRule>) =>
    onChange({
      ...table,
      rules: table.rules.map((item) => (item.id === rule.id ? { ...item, ...changes } : item)),
    });
  return (
    <section className={className ?? 'lp-decision-table'} aria-label="Decision table editor">
      <label>
        Hit policy{' '}
        <select
          value={table.hitPolicy ?? 'first'}
          onChange={(event) => onChange({ ...table, hitPolicy: event.target.value as HitPolicy })}
        >
          <option value="first">First</option>
          <option value="unique">Unique</option>
          <option value="collect">Collect</option>
        </select>
      </label>
      <table>
        <caption>Decision rules (lower priority runs first)</caption>
        <thead>
          <tr>
            <th scope="col">Rule</th>
            <th scope="col">Priority</th>
            <th scope="col">Enabled</th>
            <th scope="col">Conditions (JSON)</th>
            <th scope="col">Actions (JSON)</th>
            <th scope="col">Remove</th>
          </tr>
        </thead>
        <tbody>
          {table.rules.map((rule) => {
            const draft = drafts[rule.id];
            const conditions = draft?.conditions ?? JSON.stringify(rule.conditions, null, 2);
            const actions = draft?.actions ?? JSON.stringify(rule.actions, null, 2);
            const save = (key: 'conditions' | 'actions', raw: string) => {
              setDrafts((old) => ({
                ...old,
                [rule.id]: {
                  conditions: key === 'conditions' ? raw : (old[rule.id]?.conditions ?? conditions),
                  actions: key === 'actions' ? raw : (old[rule.id]?.actions ?? actions),
                },
              }));
              try {
                const parsed = JSON.parse(raw) as unknown;
                if (key === 'conditions' && Array.isArray(parsed))
                  replace(rule, { conditions: parsed as DecisionCondition[] });
                else if (
                  key === 'actions' &&
                  parsed &&
                  typeof parsed === 'object' &&
                  !Array.isArray(parsed)
                )
                  replace(rule, { actions: parsed as Record<string, DecisionValue> });
              } catch {
                /* Keep invalid draft visible until corrected. */
              }
            };
            return (
              <tr key={rule.id}>
                <th scope="row">{rule.label ?? rule.id}</th>
                <td>
                  <input
                    aria-label={`${rule.id} priority`}
                    type="number"
                    value={rule.priority ?? 0}
                    onChange={(event) => replace(rule, { priority: Number(event.target.value) })}
                  />
                </td>
                <td>
                  <input
                    aria-label={`${rule.id} enabled`}
                    type="checkbox"
                    checked={rule.enabled !== false}
                    onChange={(event) => replace(rule, { enabled: event.target.checked })}
                  />
                </td>
                <td>
                  <textarea
                    aria-label={`${rule.id} conditions`}
                    value={conditions}
                    onChange={(event) => save('conditions', event.target.value)}
                  />
                </td>
                <td>
                  <textarea
                    aria-label={`${rule.id} actions`}
                    value={actions}
                    onChange={(event) => save('actions', event.target.value)}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() => {
                      onChange({
                        ...table,
                        rules: table.rules.filter((item) => item.id !== rule.id),
                      });
                      setDrafts((old) => {
                        const next = { ...old };
                        delete next[rule.id];
                        return next;
                      });
                    }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button
        type="button"
        onClick={() => {
          const id = `rule-${table.rules.length + 1}`;
          onChange({
            ...table,
            rules: [
              ...table.rules,
              { id, priority: table.rules.length, conditions: [], actions: {} },
            ],
          });
        }}
      >
        Add row
      </button>
      {validateDecisionTable(table).map((error) => (
        <p role="alert" key={error}>
          {error}
        </p>
      ))}
    </section>
  );
}
