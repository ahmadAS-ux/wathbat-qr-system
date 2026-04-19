import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseSectionDocx } from '../section-parser.js';

const FIXTURE = path.resolve(import.meta.dirname ?? __dirname, '../../../../../test-fixtures/section-sample.docx');

describe('section-parser', () => {
  if (!fs.existsSync(FIXTURE)) {
    test('fixture missing — skipping all section tests', () => {
      console.log(`Skipped: place section-sample.docx in test-fixtures/ to enable`);
    });
    return;
  }

  const buf = fs.readFileSync(FIXTURE);
  let result: ReturnType<typeof parseSectionDocx>;

  test('parses without throwing', () => {
    result = parseSectionDocx(buf);
    assert.ok(result);
  });

  test('at least 1 drawing extracted', () => {
    result ??= parseSectionDocx(buf);
    assert.ok(result.drawings.length >= 1, 'Should have at least 1 drawing');
  });

  test('every drawing has non-empty imageData and valid mimeType', () => {
    result ??= parseSectionDocx(buf);
    for (const d of result.drawings) {
      assert.ok(d.imageData.length > 0, `Drawing ${d.orderIndex} has empty imageData`);
      assert.match(d.mimeType, /^(image\/(png|jpeg|gif)|application\/octet-stream)$/, `Invalid mimeType: ${d.mimeType}`);
    }
  });

  test('orderIndex values are sequential starting from 0', () => {
    result ??= parseSectionDocx(buf);
    for (let i = 0; i < result.drawings.length; i++) {
      assert.equal(result.drawings[i].orderIndex, i, `orderIndex[${i}] should be ${i}`);
    }
  });
});
