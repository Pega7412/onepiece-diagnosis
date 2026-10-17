(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SlotEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const BET = 3;
  const REEL_LEN = 20;
  const SLIDE_MAX = 4;
  const MP_REGEN_MS = 30000;

  // ---- 乱数 -------------------------------------------------------------
  function hashString(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return (h ^ (h >>> 16)) >>> 0;
  }

  function seededRng(seed) {
    let a = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---- リール ------------------------------------------------------------
  // 5コマ周期で リプレイ/ベル/スイカ/チェリー を必ず1つずつ並べる。
  // 最大スベリ4コマ以内に必ず引き込めるので、小役の取りこぼしは起きない。
  // 7とBARは10コマに1つなので、ボーナスは目押しが必要。
  const SMALL_CYCLE = ['replay', 'bell', 'melon', 'cherry'];

  function buildStrip(shift) {
    const base = [];
    for (let i = 0; i < REEL_LEN; i++) {
      const r = i % 5;
      base.push(r < 4 ? SMALL_CYCLE[r] : i % 10 === 4 ? 'seven' : 'bar');
    }
    return base.map((_, i) => base[(i + shift) % REEL_LEN]);
  }

  const STRIPS = [buildStrip(0), buildStrip(7), buildStrip(13)];

  const SYMBOL_LABEL = {
    seven: '7', bar: 'BAR', bell: 'ベル', melon: 'スイカ', cherry: 'チェリー', replay: 'リプレイ'
  };

  // ---- 役抽選 ------------------------------------------------------------
  const ROLE_DENOM = { replay: 7.3, bell: 6, melon: 60, cherry: 40 };
  const BIG_DENOM = [320, 290, 260, 230, 210, 190];
  const REG_DENOM = [520, 480, 440, 400, 350, 300];

  const PAYOUT = { replay: 0, bell: 8, melon: 5, cherry: 2, none: 0, big: 0, reg: 0 };
  const BONUS_BELL_PAYOUT = 12;
  const BONUS_GAMES = { big: 30, reg: 10 };
  const BONUS_ROLES = [['bell', 0.9], ['replay', 0.05]];

  const TARGET = { replay: 'replay', bell: 'bell', melon: 'melon', big: 'seven', reg: 'bar' };
  const ROLE_LABEL = {
    none: 'ハズレ', replay: 'リプレイ', bell: 'ベル', melon: 'スイカ', cherry: 'チェリー',
    big: 'BIGボーナス', reg: 'REGボーナス'
  };

  function drawRole(setting, rng, luck) {
    const bonusBoost = luck > 1 ? luck : 1;
    const table = [
      ['big', bonusBoost / BIG_DENOM[setting - 1]],
      ['reg', bonusBoost / REG_DENOM[setting - 1]],
      ['replay', 1 / ROLE_DENOM.replay],
      ['bell', 1 / ROLE_DENOM.bell],
      ['melon', 1 / ROLE_DENOM.melon],
      ['cherry', 1 / ROLE_DENOM.cherry]
    ];
    let r = rng();
    for (const [role, p] of table) {
      if (r < p) return role;
      r -= p;
    }
    return 'none';
  }

  function drawBonusRole(rng) {
    let r = rng();
    for (const [role, p] of BONUS_ROLES) {
      if (r < p) return role;
      r -= p;
    }
    return 'none';
  }

  // ---- 1ゲームの進行 -------------------------------------------------------
  function newMachine() {
    return { bonusPending: null, bonus: null, nextFree: false };
  }

  function beginSpin(machine, setting, rng, luck) {
    const free = machine.nextFree;
    machine.nextFree = false;
    let role;
    if (machine.bonus) role = drawBonusRole(rng);
    else if (machine.bonusPending) role = machine.bonusPending;
    else role = drawRole(setting, rng, luck || 1);
    return {
      role,
      free,
      bet: free ? 0 : BET,
      inBonus: Boolean(machine.bonus),
      stops: [null, null, null]
    };
  }

  // pressedPos: 押した瞬間にこれから中段へ入るコマの番号（0..19）。
  // 戻り値: { index, slide }。スベリ最大4コマの範囲で止め位置を決める。
  function stopReel(spin, reel, pressedPos) {
    const strip = STRIPS[reel];
    const target = TARGET[spin.role] || null;
    const otherReels = [0, 1, 2].filter((i) => i !== reel);
    let pairSymbol = null;
    if (otherReels.every((i) => spin.stops[i] !== null)) {
      const [a, b] = otherReels.map((i) => STRIPS[i][spin.stops[i]]);
      if (a === b) pairSymbol = a;
    }

    const candidates = [];
    for (let s = 0; s <= SLIDE_MAX; s++) {
      const index = (pressedPos + s) % REEL_LEN;
      candidates.push({ slide: s, index, symbol: strip[index] });
    }

    let pick = null;
    if (spin.role === 'cherry' && reel === 0) {
      pick = candidates.find((c) => c.symbol === 'cherry');
    } else if (target) {
      pick = candidates.find((c) => c.symbol === target);
    }
    if (!pick) {
      pick = candidates.find((c) => {
        if (c.symbol === 'cherry' && (reel !== 0 || spin.role !== 'cherry')) return false;
        if (pairSymbol && c.symbol === pairSymbol && pairSymbol !== target) return false;
        return true;
      });
    }
    if (!pick) pick = candidates[0];
    spin.stops[reel] = pick.index;
    return { index: pick.index, slide: pick.slide };
  }

  function lineSymbols(stops) {
    return stops.map((idx, reel) => STRIPS[reel][idx]);
  }

  function evaluate(stops) {
    const [a, b, c] = lineSymbols(stops);
    if (a === b && b === c) {
      if (a === 'seven') return 'big';
      if (a === 'bar') return 'reg';
      return a === 'cherry' ? 'none' : a;
    }
    return a === 'cherry' ? 'cherry' : 'none';
  }

  function finishSpin(machine, spin) {
    const result = evaluate(spin.stops);
    let payout = PAYOUT[result];
    if (result === 'bell' && spin.inBonus) payout = BONUS_BELL_PAYOUT;
    if (result === 'replay') machine.nextFree = true;

    let bonusStarted = null;
    if (result === 'big' || result === 'reg') {
      machine.bonusPending = null;
      machine.bonus = { type: result, left: BONUS_GAMES[result] };
      bonusStarted = result;
    } else if (spin.role === 'big' || spin.role === 'reg') {
      machine.bonusPending = spin.role;
    }
    let bonusEnded = false;
    if (spin.inBonus && machine.bonus) {
      machine.bonus.left -= 1;
      if (machine.bonus.left <= 0) {
        machine.bonus = null;
        bonusEnded = true;
      }
    }
    return { result, payout, bonusStarted, bonusEnded };
  }

  // ---- ホール ------------------------------------------------------------
  const HALLS = [
    {
      id: 'rookie', name: 'ルーキーホール', rate: 1, limit: 3000, open: [0, 24], minLevel: 1,
      weights: [40, 25, 15, 10, 6, 4]
    },
    {
      id: 'middle', name: 'ミドルホール', rate: 5, limit: 5000, open: [12, 24], minLevel: 5,
      weights: [30, 25, 20, 13, 8, 4]
    },
    {
      id: 'high', name: 'ハイレートホール', rate: 15, limit: 10000, open: [16, 28], minLevel: 15,
      weights: [25, 22, 20, 16, 10, 7]
    }
  ];

  function isOpen(hall, date) {
    const h = date.getHours() + date.getMinutes() / 60;
    const [from, to] = hall.open;
    return to <= 24 ? h >= from && h < to : h >= from || h < to - 24;
  }

  function hoursLabel(hall) {
    const [from, to] = hall.open;
    const pad = (n) => String(n % 24).padStart(2, '0');
    return pad(from) + ':00 〜 ' + (to === 24 ? '24' : pad(to)) + ':00';
  }

  function dayKey(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
  }

  // 同じ日・同じホールでは設定が変わらない（日替わり）。
  function hallSetting(hall, date) {
    const rng = seededRng(hall.id + ':' + dayKey(date));
    const total = hall.weights.reduce((a, b) => a + b, 0);
    let r = rng() * total;
    for (let i = 0; i < hall.weights.length; i++) {
      if (r < hall.weights[i]) return i + 1;
      r -= hall.weights[i];
    }
    return 1;
  }

  function settleCoins(net, hall) {
    return Math.max(0, net) * hall.rate;
  }

  // ---- レベル・MP ---------------------------------------------------------
  function xpToNext(level) {
    return 40 + 20 * level;
  }

  function levelInfo(xp) {
    let level = 1;
    let rest = xp;
    while (rest >= xpToNext(level)) {
      rest -= xpToNext(level);
      level++;
    }
    return { level, rest, need: xpToNext(level) };
  }

  function mpMax(level) {
    return 100 + 6 * level;
  }

  function mpNow(mp, level, now) {
    const max = mpMax(level);
    if (mp.v >= max) return { v: max, at: now };
    const gained = Math.floor((now - mp.at) / MP_REGEN_MS);
    if (gained <= 0) return { v: mp.v, at: mp.at };
    const v = Math.min(max, mp.v + gained);
    return { v, at: v >= max ? now : mp.at + gained * MP_REGEN_MS };
  }

  // ---- ガチャ ------------------------------------------------------------
  const CHARACTERS = [
    { id: 'c01', name: 'ハル', rar: 'N', face: '😀', color: '#4aa8ff' },
    { id: 'c02', name: 'ミナト', rar: 'N', face: '😎', color: '#38d6c4' },
    { id: 'c03', name: 'ソラ', rar: 'N', face: '🙂', color: '#7aa2ff' },
    { id: 'c04', name: 'リク', rar: 'N', face: '😄', color: '#52d273' },
    { id: 'c05', name: 'ナギ', rar: 'N', face: '😊', color: '#f2b84b' },
    { id: 'c06', name: 'ユイ', rar: 'N', face: '😌', color: '#ff8fb1' },
    { id: 'c07', name: 'カイ', rar: 'R', face: '🤠', color: '#ff9f43' },
    { id: 'c08', name: 'レナ', rar: 'R', face: '😻', color: '#ff6b9d' },
    { id: 'c09', name: 'ジン', rar: 'R', face: '🥷', color: '#6c7a89' },
    { id: 'c10', name: 'アオイ', rar: 'R', face: '🧑‍🎤', color: '#5f7bff' },
    { id: 'c11', name: 'ミコト', rar: 'SR', face: '🦊', color: '#ff7a3d' },
    { id: 'c12', name: 'ライカ', rar: 'SR', face: '🐺', color: '#9aa7ff' },
    { id: 'c13', name: 'ココロ', rar: 'SR', face: '🐱', color: '#ff7ad9' },
    { id: 'c14', name: 'ネオン・クイーン', rar: 'LR', face: '👑', color: '#ffd23f' },
    { id: 'c15', name: 'ギャラクシー・キング', rar: 'LR', face: '🤴', color: '#b86bff' }
  ];

  const GACHA_WEIGHTS = [['LR', 2], ['SR', 8], ['R', 30], ['N', 60]];
  const DUPLICATE_COINS = { N: 100, R: 300, SR: 1000, LR: 3000 };
  const GACHA_COST = { single: 1000, ten: 9500 };

  function rollRarity(rng, minimum) {
    const rank = { N: 0, R: 1, SR: 2, LR: 3 };
    const table = GACHA_WEIGHTS.filter(([r]) => !minimum || rank[r] >= rank[minimum]);
    const total = table.reduce((a, [, w]) => a + w, 0);
    let x = rng() * total;
    for (const [r, w] of table) {
      if (x < w) return r;
      x -= w;
    }
    return table[table.length - 1][0];
  }

  function rollCharacter(rng, minimum) {
    const rar = rollRarity(rng, minimum);
    const pool = CHARACTERS.filter((c) => c.rar === rar);
    return pool[Math.floor(rng() * pool.length)];
  }

  // 10連は最後の1枠がR以上確定
  function rollTen(rng) {
    const out = [];
    for (let i = 0; i < 10; i++) out.push(rollCharacter(rng, i === 9 ? 'R' : null));
    return out;
  }

  // ---- ミッション ---------------------------------------------------------
  const MISSIONS = [
    { id: 'spin100', label: '100回転する', key: 'spins', goal: 100, reward: { coins: 300 } },
    { id: 'spin300', label: '300回転する', key: 'spins', goal: 300, reward: { stars: 2 } },
    { id: 'bonus1', label: 'ボーナスを1回引く', key: 'bonus', goal: 1, reward: { coins: 500 } },
    { id: 'session3', label: 'ホールで3回遊ぶ', key: 'sessions', goal: 3, reward: { stars: 1 } },
    { id: 'net500', label: '1回の遊技で差枚+500を出す', key: 'bestNet', goal: 500, reward: { coins: 1000 } }
  ];

  const TITLES = [
    { id: 't_spin100', label: 'ビギナー', ok: (s) => s.stats.spins >= 100 },
    { id: 't_spin1000', label: '常連', ok: (s) => s.stats.spins >= 1000 },
    { id: 't_big1', label: '初ボーナス', ok: (s) => s.stats.big + s.stats.reg >= 1 },
    { id: 't_big10', label: 'ボーナスハンター', ok: (s) => s.stats.big + s.stats.reg >= 10 },
    { id: 't_net1000', label: '千枚の壁', ok: (s) => s.stats.maxNet >= 1000 }
  ];

  return {
    BET, REEL_LEN, SLIDE_MAX, STRIPS, SYMBOL_LABEL, ROLE_LABEL, PAYOUT, BONUS_GAMES,
    BONUS_BELL_PAYOUT, BIG_DENOM, REG_DENOM, ROLE_DENOM, HALLS, CHARACTERS, GACHA_COST,
    DUPLICATE_COINS, MISSIONS, TITLES, MP_REGEN_MS,
    hashString, seededRng, newMachine, beginSpin, stopReel, evaluate, finishSpin,
    drawRole, drawBonusRole, lineSymbols, isOpen, hoursLabel, dayKey, hallSetting,
    settleCoins, xpToNext, levelInfo, mpMax, mpNow, rollCharacter, rollTen
  };
});
