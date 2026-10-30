// Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { PAGE_LINKS, wrapFocusIndex } from '../lib/nav/links.js'

test('PAGE_LINKS: order, with Browse makers between Shop drops and Pricing', () => {
  assert.deepEqual(PAGE_LINKS.map((l) => l.label), ['Shop drops', 'Browse makers', 'Pricing', 'Free tools'])
  assert.deepEqual(PAGE_LINKS.map((l) => l.href), ['/drops', '/makers', '/#pricing', '/tools'])
})

test('wrapFocusIndex: Tab moves forward and wraps to the first', () => {
  assert.equal(wrapFocusIndex(0, 3), 1)
  assert.equal(wrapFocusIndex(2, 3), 0)
})

test('wrapFocusIndex: Shift+Tab moves back and wraps to the last', () => {
  assert.equal(wrapFocusIndex(1, 3, true), 0)
  assert.equal(wrapFocusIndex(0, 3, true), 2)
})

test('wrapFocusIndex: focus outside the panel re-enters at the start or end', () => {
  assert.equal(wrapFocusIndex(-1, 3), 0)
  assert.equal(wrapFocusIndex(-1, 3, true), 2)
  assert.equal(wrapFocusIndex(7, 3), 0)
})

test('wrapFocusIndex: single item stays put; empty list returns -1', () => {
  assert.equal(wrapFocusIndex(0, 1), 0)
  assert.equal(wrapFocusIndex(0, 1, true), 0)
  assert.equal(wrapFocusIndex(0, 0), -1)
})
