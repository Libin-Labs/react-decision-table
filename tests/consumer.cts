import api = require('../dist/cjs/index.js');
const table: api.DecisionTable = {
  rules: [
    {
      id: 'adult',
      conditions: [{ field: 'age', operator: 'gte', value: 18 }],
      actions: { allow: true },
    },
  ],
};
const props: api.DecisionTableEditorProps = { table, onChange: (value) => console.log(value) };
void [
  api.DecisionTableEditor,
  api.DecisionTableError,
  api.evaluateDecisionTable,
  api.validateDecisionTable,
  props,
];
