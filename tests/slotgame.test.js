const assert = require('node:assert/strict');
const E = require('../slotgame/engine.js');

const N = E.REEL_LEN;

// 全リールで、どの押し位置からでも 5コマ以内に リプレイ/ベル/スイカ/チェリー が必ずある
for (const strip of E.STRIPS) {
  assert.equal(strip.length, N);
  for (let p = 0; p < N; p++) {
    const window = Array.from({ length: E.SLIDE_MAX + 1 }, (_, s) => strip[(p + s) % N]);
    for (const sym of ['replay', 'bell', 'melon', 'cherry']) assert.ok(window.includes(sym), sym + '@' + p);
  }
}

// 全 20x20x20 の押し位置 x 全役 で、揃う絵柄が役と食い違わない
function play(role, presses, order) {
  const spin = { role, stops: [null, null, null] };
  for (const reel of order) E.stopReel(spin, reel, presses[reel]);
  return E.evaluate(spin.stops);
}

const ORDERS = [[0, 1, 2], [2, 1, 0], [1, 0, 2], [1, 2, 0]];
for (const role of ['none', 'replay', 'bell', 'melon', 'cherry', 'big', 'reg']) {
  for (let a = 0; a < N; a++) {
    for (let b = 0; b < N; b++) {
      for (let c = 0; c < N; c++) {
        for (const order of ORDERS) {
          const got = play(role, [a, b, c], order);
          if (['replay', 'bell', 'melon', 'cherry'].includes(role)) {
            assert.equal(got, role, role + ' は必ず入賞 ' + [a, b, c] + ' ' + order);
          } else {
            // ハズレ・ボーナス未成立では、他の役が勝手に揃わない
            assert.ok(got === 'none' || got === role, role + ' なのに ' + got + ' ' + [a, b, c] + ' ' + order);
          }
        }
      }
    }
  }
}

// ボーナスは目押しできたときだけ揃い、取りこぼすと持ち越す
const machine = E.newMachine();
let spin = { role: 'big', stops: [null, null, null], inBonus: false };
const sevenAt = E.STRIPS.map((strip) => strip.indexOf('seven'));
for (let reel = 0; reel < 3; reel++) E.stopReel(spin, reel, sevenAt[reel]);
assert.equal(E.finishSpin(machine, spin).bonusStarted, 'big');
assert.equal(machine.bonus.left, E.BONUS_GAMES.big);

const m2 = E.newMachine();
spin = { role: 'big', stops: [null, null, null], inBonus: false };
for (let reel = 0; reel < 3; reel++) E.stopReel(spin, reel, (sevenAt[reel] + 5) % N); // 7が届かない位置
const miss = E.finishSpin(m2, spin);
assert.equal(miss.bonusStarted, null);
assert.equal(m2.bonusPending, 'big');
assert.equal(E.beginSpin(m2, 1, () => 0.5, 1).role, 'big', '持ち越し中は同じ役が続く');

// ボーナス消化とリプレイの次ゲーム無料
const m3 = E.newMachine();
m3.bonus = { type: 'reg', left: 1 };
spin = E.beginSpin(m3, 1, () => 0.1, 1);
assert.equal(spin.role, 'bell');
for (let reel = 0; reel < 3; reel++) E.stopReel(spin, reel, 0);
const bonusResult = E.finishSpin(m3, spin);
assert.equal(bonusResult.payout, E.BONUS_BELL_PAYOUT);
assert.equal(bonusResult.bonusEnded, true);
assert.equal(m3.bonus, null);

const m4 = E.newMachine();
spin = { role: 'replay', stops: [null, null, null], inBonus: false };
for (let reel = 0; reel < 3; reel++) E.stopReel(spin, reel, 0);
E.finishSpin(m4, spin);
const freeSpin = E.beginSpin(m4, 1, () => 0.99, 1);
assert.equal(freeSpin.free, true);
assert.equal(freeSpin.bet, 0);

// 機械割: 設定1は100%未満、設定6は100%超え（常に目押し成功で打った場合）
function simulate(setting, spins, seed, skilled) {
  const rng = E.seededRng(seed);
  const machine = E.newMachine();
  let paid = 0;
  let bet = 0;
  for (let i = 0; i < spins; i++) {
    const spin = E.beginSpin(machine, setting, rng, 1);
    bet += spin.bet;
    for (const reel of [0, 1, 2]) {
      let p = Math.floor(rng() * N);
      if (skilled && TARGETS[spin.role]) {
        const t = TARGETS[spin.role];
        const strip = E.STRIPS[reel];
        const idx = strip.indexOf(t);
        p = ((idx - Math.floor(rng() * (E.SLIDE_MAX + 1))) % N + N) % N;
        if (!Array.from({ length: 5 }, (_, s) => strip[(p + s) % N]).includes(t)) p = idx;
      }
      E.stopReel(spin, reel, p);
    }
    paid += E.finishSpin(machine, spin).payout;
  }
  return paid / bet;
}
const TARGETS = { big: 'seven', reg: 'bar' };

const low = simulate(1, 400000, 'rtp-1', true);
const high = simulate(6, 400000, 'rtp-6', true);
console.log('RTP setting1=' + (low * 100).toFixed(1) + '% setting6=' + (high * 100).toFixed(1) + '%');
assert.ok(low > 0.88 && low < 1.0, '設定1の機械割 ' + low);
assert.ok(high > 1.0 && high < 1.15, '設定6の機械割 ' + high);

// ホール: 日替わり設定は同じ日なら固定、営業時間は日またぎに対応
const hall = E.HALLS.find((h) => h.id === 'high');
const day = new Date(2026, 9, 17, 12, 0);
assert.equal(E.hallSetting(hall, day), E.hallSetting(hall, new Date(2026, 9, 17, 23, 0)));
assert.equal(E.isOpen(hall, new Date(2026, 9, 17, 17, 0)), true);
assert.equal(E.isOpen(hall, new Date(2026, 9, 18, 3, 0)), true);
assert.equal(E.isOpen(hall, new Date(2026, 9, 18, 5, 0)), false);
assert.equal(E.hoursLabel(hall), '16:00 〜 04:00');
assert.equal(E.settleCoins(100, hall), 1500);
assert.equal(E.settleCoins(-50, hall), 0);

// レベルとMP
assert.deepEqual(E.levelInfo(0), { level: 1, rest: 0, need: 60 });
assert.equal(E.levelInfo(60).level, 2);
const mp = E.mpNow({ v: 10, at: 0 }, 1, E.MP_REGEN_MS * 5 + 100);
assert.equal(mp.v, 15);
assert.equal(E.mpNow({ v: 1, at: 0 }, 1, 1e12).v, E.mpMax(1));

// ガチャ: 10連の最後はR以上
const rng = E.seededRng('gacha');
for (let i = 0; i < 300; i++) {
  const ten = E.rollTen(rng);
  assert.equal(ten.length, 10);
  assert.notEqual(ten[9].rar, 'N');
}

console.log('slotgame tests passed');
