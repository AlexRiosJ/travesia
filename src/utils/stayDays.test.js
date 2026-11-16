import assert from 'node:assert/strict'
import test from 'node:test'
import { getDailyPlanEntries, getStayDateKeys } from './stayDays.js'

test('returns every date in a stay, including both endpoints', () => {
  assert.deepEqual(getStayDateKeys('2027-03-13', '2027-03-15'), [
    '2027-03-13',
    '2027-03-14',
    '2027-03-15',
  ])
})

test('rejects invalid and reversed stay ranges', () => {
  assert.deepEqual(getStayDateKeys('2027-02-30', '2027-03-01'), [])
  assert.deepEqual(getStayDateKeys('2027-03-02', '2027-03-01'), [])
})

test('returns only non-empty plans within the stay', () => {
  assert.deepEqual(
    getDailyPlanEntries({
      startDate: '2027-03-13',
      endDate: '2027-03-14',
      dailyPlans: {
        '2027-03-12': 'Before arrival',
        '2027-03-13': '  Museum and dinner  ',
        '2027-03-14': ' ',
      },
    }),
    [{ date: '2027-03-13', plan: 'Museum and dinner' }],
  )
})
