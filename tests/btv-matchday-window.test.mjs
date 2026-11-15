import test from 'node:test';
import assert from 'node:assert/strict';
import {followUpDays,isMatchdayFollowUp} from '../scripts/btv-matchday-window.mjs';

const monday=Date.parse('2026-11-16T08:00:00Z');
const tuesday=Date.parse('2026-11-17T08:00:00Z');
const wednesday=Date.parse('2026-11-18T08:00:00Z');
const sundayMatch='2026-11-15T13:00:00+00:00';

test('follow-up window is yesterday and the day before in Berlin time',()=>{
  assert.deepEqual(followUpDays(monday),['2026-11-15','2026-11-14']);
});

test('runs on the two days after a match day',()=>{
  assert.equal(isMatchdayFollowUp([sundayMatch],monday),true);
  assert.equal(isMatchdayFollowUp([sundayMatch],tuesday),true);
});

test('does not run on the match day itself or from the third day on',()=>{
  assert.equal(isMatchdayFollowUp([sundayMatch],Date.parse('2026-11-15T20:00:00Z')),false);
  assert.equal(isMatchdayFollowUp([sundayMatch],wednesday),false);
  assert.equal(isMatchdayFollowUp([],monday),false);
});

test('uses Berlin calendar days, not UTC (late-evening match)',()=>{
  // 23:30 UTC on Saturday is already Sunday in Berlin
  const lateMatch='2026-11-14T23:30:00Z';
  assert.equal(isMatchdayFollowUp([lateMatch],tuesday),true);
  assert.equal(isMatchdayFollowUp([lateMatch],wednesday),false);
});

test('handles the DST switch at the end of October',()=>{
  const sunday='2026-10-25T10:00:00Z';
  // Tuesday 23:30 Berlin (CET) is still in the window, Wednesday 00:30 is not.
  assert.equal(isMatchdayFollowUp([sunday],Date.parse('2026-10-27T22:30:00Z')),true);
  assert.equal(isMatchdayFollowUp([sunday],Date.parse('2026-10-27T23:30:00Z')),false);
});
