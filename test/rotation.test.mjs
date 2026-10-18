import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextRotation } from '../public/config.mjs';

test('四看板輪播先看完目前看板的所有頁，再切換並從第一頁開始', () => {
  assert.deepEqual(nextRotation('int', 0, 3, true), { source:'int', page:1 });
  assert.deepEqual(nextRotation('int', 1, 3, true), { source:'int', page:2 });
  assert.deepEqual(nextRotation('int', 2, 3, true), { source:'int-arr', page:0 });
  assert.deepEqual(nextRotation('int-arr', 0, 1, true), { source:'dom', page:0 });
  assert.deepEqual(nextRotation('dom', 0, 1, true), { source:'dom-arr', page:0 });
  assert.deepEqual(nextRotation('dom-arr', 0, 1, true), { source:'int', page:0 });
});

test('單一看板模式回到自身第一頁，空清單也能輪到下一個看板', () => {
  assert.deepEqual(nextRotation('int', 2, 3, false), { source:'int', page:0 });
  assert.deepEqual(nextRotation('dom', 0, 1, false), { source:'dom', page:0 });
  assert.deepEqual(nextRotation('dom', 0, 0, true), { source:'dom-arr', page:0 });
});
