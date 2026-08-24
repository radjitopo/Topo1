import assert from 'node:assert/strict';
import test from 'node:test';
import { splitSqlStatements } from '../scripts/sql-statements.mjs';

test('splits ordinary SQL statements', () => {
  assert.deepEqual(splitSqlStatements('SELECT 1; SELECT 2;'), ['SELECT 1', 'SELECT 2']);
});

test('keeps semicolons inside strings, comments and dollar-quoted blocks', () => {
  const sql = `
    SELECT 'a;b';
    -- a comment; stays with the next statement
    DO $$
    BEGIN
      PERFORM 1;
      RAISE NOTICE 'done;';
    END
    $$;
    SELECT "semi;colon";
  `;

  const statements = splitSqlStatements(sql);
  assert.equal(statements.length, 3);
  assert.match(statements[0], /SELECT 'a;b'/);
  assert.match(statements[1], /PERFORM 1;/);
  assert.match(statements[1], /RAISE NOTICE 'done;';/);
  assert.match(statements[2], /SELECT "semi;colon"/);
});
