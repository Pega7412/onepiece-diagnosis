const assert = require('node:assert/strict');
const calculator = require('../calculator.js');

const equal = calculator.rateValues(50, 5);
assert.equal(equal.costPerCoin, 20);
assert.equal(equal.cashPerCoin, 20);

const hokutoEarly = calculator.calculateHokuto({ abesi: 300, bankroll: 30000, lendCoins: 46, exchangeRate: 5.6 });
const hokutoLate = calculator.calculateHokuto({ abesi: 1200, bankroll: 30000, lendCoins: 46, exchangeRate: 5.6 });
assert.ok(hokutoEarly.expectedValue < 0);
assert.ok(hokutoLate.expectedValue > hokutoEarly.expectedValue);
assert.ok(hokutoEarly.investmentRisk <= 30000);

const tokyo = calculator.calculateTokyo({ cz: 200, bankroll: 20000, currentInvest: 10000, lendCoins: 46, exchangeRate: 5.6 });
assert.equal(tokyo.exposure, tokyo.investmentRisk + 10000);
assert.ok(tokyo.expectedValue < 0);

const juggler = calculator.calculateJuggler({ totalG: 3000, big: 8, reg: 5, hamari: 500, heldCoins: 0, plannedCash: 10000, lendCoins: 46, exchangeRate: 5.6 });
assert.ok(juggler.expectedValue < 0);
assert.ok(juggler.investmentRisk >= 10000);

console.log('calculator tests passed');
