import assert from 'node:assert/strict';
import { calculate8020Allocation } from '../../src/services/allocationEngine.ts';

// 1. KSh 1,000 -> KSh 800 user / KSh 200 Paybill
const s1 = calculate8020Allocation(100000);
assert.equal(s1.grossCents, 100000);
assert.equal(s1.userCents, 80000);
assert.equal(s1.paybillCents, 20000);
assert.equal(s1.userCents + s1.paybillCents, s1.grossCents);

// 2. KSh 500 -> KSh 400 user / KSh 100 Paybill
const s2 = calculate8020Allocation(50000);
assert.equal(s2.userCents, 40000);
assert.equal(s2.paybillCents, 10000);

// 3. KSh 100 -> KSh 80 user / KSh 20 Paybill
const s3 = calculate8020Allocation(10000);
assert.equal(s3.userCents, 8000);
assert.equal(s3.paybillCents, 2000);

// 4. Odd cent conservation
const s4 = calculate8020Allocation(4503);
assert.equal(s4.userCents + s4.paybillCents, 4503);

console.log('All 80/20 integer allocation unit assertions passed.');
