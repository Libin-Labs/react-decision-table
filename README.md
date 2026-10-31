# @lp-labs/react-decision-table

Typed declarative decision-table conditions and outputs, a deterministic evaluator, and an editable React table. Rules contain no executable code.

## Example

```tsx
import { evaluateDecisionTable, DecisionTableEditor, type DecisionTable } from "@lp-labs/react-decision-table";
import "@lp-labs/react-decision-table/styles.css";

const table: DecisionTable = { hitPolicy: "first", rules: [
  { id: "priority-customer", priority: 1, conditions: [{ field: "customer.tier", operator: "eq", value: "gold" }], actions: { discount: 15 } },
  { id: "standard", priority: 10, conditions: [], actions: { discount: 0 } },
] };
const result = evaluateDecisionTable(table, { customer: { tier: "gold" } });
function Editor() { const [draft, setDraft] = React.useState(table); return <DecisionTableEditor table={draft} onChange={setDraft} />; }
```

## Component API

`DecisionTableEditorProps` has required `table: DecisionTable`, required `onChange(table)` callback, and optional `className` (default `lp-decision-table`). The editor displays hit-policy selection, priority, enabled checkbox, and JSON text areas for row conditions/actions, plus add/remove controls. JSON text is parsed into model data as it becomes valid; invalid drafts remain visible but are not committed. Added IDs are based on current row count and can collide if callers use custom IDs; `validateDecisionTable` reports duplicates, and consumers should assign durable unique IDs. Conditions/actions textareas are native labeled controls; errors are announced.

## Helpers and types

- `DecisionValue`: string, number, boolean, or null. `DecisionCondition` is `{field: string; operator: ConditionOperator; value?: DecisionValue | readonly DecisionValue[]}`.
- `ConditionOperator`: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `in`, `exists`. Comparisons are strict (no coercion); ordered comparisons require two numbers; `contains` supports substring or array membership; `in` checks membership in an expected array. `exists` checks whether a path is present (value `false` checks absence; omitted/true checks presence).
- `DecisionRule`: `{id; label?; priority?; conditions; actions; enabled?}`. All conditions must match; empty conditions match every input. Action values are `DecisionValue`.
- `HitPolicy`: `first | unique | collect`. `DecisionTable`: `{rules; hitPolicy?}`, default policy `first`. `DecisionResult`: `{matches; actions}`.
- `DecisionTableError` extends `Error`; validation or evaluation failures throw this error.
- `validateDecisionTable(table): string[]` reports unknown policy, empty/duplicate IDs, empty condition fields, unsupported operators, and non-array `in` values. Field paths are validated at evaluation time.
- `evaluateDecisionTable(table, input): DecisionResult` validates then sorts enabled rows by ascending numeric priority (default 0), tie-breaks lexically by ID, and evaluates in that stable order. `first` returns only the first matching rule; `unique` throws if multiple rules match; `collect` returns all. Selected action objects merge in order, so a later selected row replaces earlier values with the same key. Nested dot-path reads only traverse own properties and reject `__proto__`, `prototype`, and `constructor` path segments.
- `DecisionTableEditor`, `DecisionTableEditorProps`, `DecisionTable`, `DecisionRule`, `DecisionCondition`, `DecisionResult`, `DecisionValue`, `ConditionOperator`, `HitPolicy`, and `DecisionTableError` are the full API.

## Limits

This is a small rule-table evaluator, not DMN or a general rules standard. No ranges, nested boolean groups, negation, custom functions, date arithmetic, missing-vs-null distinction beyond `exists`, async rules, or executable actions exist. Action values are declarative outputs only. `collect` merges collisions by later rule; it does not return a list of independent output maps. Input objects are not mutated. The row editor's JSON format is the standard JSON representation of condition/action arrays and objects; the package does not provide a visual condition builder. React is the sole runtime peer; ESM and CommonJS include TypeScript declarations.

## License

[MIT](./LICENSE).

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
