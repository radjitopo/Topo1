import assert from 'node:assert/strict';
import { optionSimilarity, possibleOptionDuplicate } from '../option-similarity.js';

const options = [
  { optionId: 1, label: 'Velociraptor' },
  { optionId: 2, label: 'Chave Phillips' },
  { optionId: 3, label: 'Martelo' },
  { optionId: 4, label: 'Leão africano' },
];

assert.equal(
  optionSimilarity('Café', 'cafe'),
  1,
  'accents and case must not hide exact duplicates',
);
assert.ok(
  optionSimilarity('Chave Philips', 'Chave Phillips') > 0.9,
  'one-letter spelling variations must score highly',
);
assert.deepEqual(
  possibleOptionDuplicate('Velocirraptor', options),
  { optionId: 1, label: 'Velociraptor', similarity: 0.92 },
  'a repeated letter must surface the likely existing option',
);
assert.equal(
  possibleOptionDuplicate('Marreta', options),
  null,
  'different names must not be automatically treated as duplicates',
);
assert.equal(
  possibleOptionDuplicate('Leão', options),
  null,
  'a shorter related label must not be treated as the same item',
);

console.log('Option similarity checks passed.');
