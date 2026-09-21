/*
 * test.js - Gleech Test Suite
 * Copyright (C) 2017-2026 jkirchartz <me@jkirchartz.com>
 * Distributed under terms of the GPL 3.0 license.
 */

import { gleech, algorithmParams } from '../index.js';
import { resolve } from 'path';

async function runTests() {
  console.log('--- Running Gleech Test Suite ---');

  // 1. Check all algorithms registered
  const algorithms = gleech.all;
  console.log(`[PASS] Registered ${algorithms.length} algorithms in engine.`);
  if (algorithms.length < 68) {
    throw new Error(`Expected at least 68 algorithms, found ${algorithms.length}`);
  }

  // 2. Check each algorithm function exists
  for (const algo of algorithms) {
    if (typeof gleech[algo] !== 'function') {
      throw new Error(`gleech.${algo} is not a function!`);
    }
  }
  console.log('[PASS] All algorithm functions are defined.');

  // 3. Test parameter metadata
  const paramCount = Object.keys(algorithmParams).length;
  console.log(`[PASS] Loaded parameter schemas for ${paramCount} algorithms.`);

  // 4. Test image processing via gleech.read()
  const testImagePath = resolve(import.meta.dirname, 'test.jpg');
  console.log(`[INFO] Loading test image: ${testImagePath}`);
  const img = await gleech.read(testImagePath);
  if (!img || !img.bitmap || !img.bitmap.width) {
    throw new Error('Failed to load test image with gleech.read()');
  }
  console.log(`[PASS] Successfully loaded test image (${img.bitmap.width}x${img.bitmap.height}).`);

  // 5. Test chainable image glitch methods
  img.theWorks();
  img.pixelFunk();
  img.vcrTracking();
  img.jpegBlockRot();
  console.log('[PASS] Applied sample glitches (theWorks, pixelFunk, vcrTracking, jpegBlockRot) successfully.');

  console.log('--- All Gleech Tests Passed Successfully ---');
}

runTests().catch(err => {
  console.error('[FAIL] Test error:', err);
  process.exit(1);
});
