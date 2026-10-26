// Tests for lib/location.js. Run with `yarn test` (node --test).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeLocation, locationKey, formatLocation } from '../lib/location.js'

const city = (c) => normalizeLocation(c, 'OR').city

test('mixed-case city is kept as typed', () => {
  assert.equal(city('McMinnville'), 'McMinnville')
  assert.equal(city('DeKalb'), 'DeKalb')
})

test('all lower case city is title-cased, with Mc and O\' prefixes', () => {
  assert.equal(city('mcminnville'), 'McMinnville')
  assert.equal(city("o'fallon"), "O'Fallon")
  assert.equal(city('west linn'), 'West Linn')
  assert.equal(city('winston-salem'), 'Winston-Salem')
})

test('all upper case city is title-cased', () => {
  assert.equal(city('WEST LINN'), 'West Linn')
  assert.equal(city('MCMINNVILLE'), 'McMinnville')
})

test('extra whitespace is collapsed', () => {
  assert.equal(city('  west    linn  '), 'West Linn')
  assert.equal(city(' McMinnville\t '), 'McMinnville')
})

test('state names and codes become two-letter codes', () => {
  assert.deepEqual(normalizeLocation('west linn', 'oregon'), { city: 'West Linn', state: 'OR' })
  assert.deepEqual(normalizeLocation('West Linn, Or', ''), { city: 'West Linn', state: 'OR' })
})

test('locationKey is case-insensitive across spellings', () => {
  const k = locationKey('McMinnville', 'OR')
  assert.equal(locationKey('mcminnville', 'or'), k)
  assert.equal(locationKey('Mcminnville', 'Oregon'), k)
  assert.equal(locationKey('MCMINNVILLE', 'OR'), k)
})

test('formatLocation', () => {
  assert.equal(formatLocation('mcminnville', 'or'), 'McMinnville, OR')
  assert.equal(formatLocation('', ''), '')
})
