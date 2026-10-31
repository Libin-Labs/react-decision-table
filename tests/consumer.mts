import {
  DecisionTableEditor,
  DecisionTableError,
  evaluateDecisionTable,
  validateDecisionTable,
  type DecisionTable,
  type DecisionTableEditorProps,
} from '../dist/esm/index.js';
const table: DecisionTable = {
  rules: [
    {
      id: 'adult',
      conditions: [{ field: 'age', operator: 'gte', value: 18 }],
      actions: { allow: true },
    },
  ],
};
const props: DecisionTableEditorProps = { table, onChange: (value) => console.log(value) };
void [DecisionTableEditor, DecisionTableError, evaluateDecisionTable, validateDecisionTable, props];
