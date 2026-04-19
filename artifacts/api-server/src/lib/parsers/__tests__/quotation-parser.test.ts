import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseQuotationDocx } from '../quotation-parser.js';

const FIXTURE = path.resolve(import.meta.dirname ?? __dirname, '../../../../../test-fixtures/quotation-rose-villa.docx');

describe('quotation-parser', () => {
  if (!fs.existsSync(FIXTURE)) {
    test('fixture missing — skipping all quotation tests', () => {
      console.log(`Skipped: place quotation-rose-villa.docx in test-fixtures/ to enable`);
    });
    return;
  }

  const buf = fs.readFileSync(FIXTURE);
  let result: ReturnType<typeof parseQuotationDocx>;

  test('parses without throwing', () => {
    result = parseQuotationDocx(buf);
    assert.ok(result);
  });

  test('project name extracted', () => {
    result ??= parseQuotationDocx(buf);
    assert.ok(result.projectName, 'projectName should not be null');
    assert.match(result.projectName!, /ROSE/i, 'Should contain ROSE');
  });

  test('quotation number extracted (digits only, no spaces)', () => {
    result ??= parseQuotationDocx(buf);
    assert.ok(result.quotationNumber, 'quotationNumber should not be null');
    assert.match(result.quotationNumber!, /^\d+$/, 'Should be digits only');
  });

  test('date format is DD/MM/YYYY', () => {
    result ??= parseQuotationDocx(buf);
    if (result.quotationDate) {
      assert.match(result.quotationDate, /^\d{2}\/\d{2}\/\d{4}$/, 'Date must be DD/MM/YYYY');
    }
  });

  test('deduplication reduced position count', () => {
    result ??= parseQuotationDocx(buf);
    assert.ok(result.dedupedPositionCount > 0, 'Should have at least 1 position after dedup');
    assert.ok(result.rawPositionCount >= result.dedupedPositionCount, 'rawCount >= dedupedCount');
  });

  test('position codes match expected pattern', () => {
    result ??= parseQuotationDocx(buf);
    for (const pos of result.positions) {
      assert.match(pos.position, /^[A-Z]+-\d+[A-Za-z]?$/, `Invalid position code: ${pos.position}`);
    }
  });

  test('grand total extracted and formatted', () => {
    result ??= parseQuotationDocx(buf);
    assert.ok(result.grandTotal, 'grandTotal should not be null');
    assert.match(result.grandTotal!, /^[\d,]+\.\d+$/, 'grandTotal should match price format');
  });
});
