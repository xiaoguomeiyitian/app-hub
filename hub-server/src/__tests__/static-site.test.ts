import test from 'node:test';
import assert from 'node:assert/strict';
import { registerStaticSite } from '../static-site.js';
import express from 'express';

test('static-site: registerStaticSite registers middleware without throwing', () => {
  const app = express();
  // Should not throw
  registerStaticSite(app);
  assert.ok(true);
});
