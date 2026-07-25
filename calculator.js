(function exposeCalculator(root) {
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function interpolate(points, input) {
    const x = Number(input) || 0;
    if (x <= points[0][0]) return points[0][1];
    if (x >= points.at(-1)[0]) return points.at(-1)[1];
    const upperIndex = points.findIndex(([point]) => point >= x);
    const [x1, y1] = points[upperIndex - 1];
    const [x2, y2] = points[upperIndex];
    return y1 + ((x - x1) / (x2 - x1)) * (y2 - y1);
  }

  function rateValues(lendCoins, exchangeRate) {
    const lend = clamp(Number(lendCoins) || 46, 1, 100);
    const exchange = clamp(Number(exchangeRate) || 5.6, 1, 20);
    return {
      costPerCoin: 1000 / lend,
      cashPerCoin: 100 / exchange,
    };
  }

  function calculateHokuto(input) {
    const abesi = clamp(Number(input.abesi) || 0, 0, 1536);
    const bankroll = Math.max(0, Number(input.bankroll) || 0);
    const rates = rateValues(input.lendCoins, input.exchangeRate);
    const remainingGames = Math.ceil((1536 - abesi) / 1.05);
    const requiredCoins = remainingGames * (50 / 31);
    const investmentRisk = Math.min(bankroll, requiredCoins * rates.costPerCoin);
    const equalRateEv = interpolate([[0, -6800], [450, -4300], [650, -2400], [900, 200], [1200, 3200], [1536, 7200]], abesi);
    const exchangeGap = 420 * Math.max(0, rates.costPerCoin - rates.cashPerCoin);
    return { expectedValue: equalRateEv - exchangeGap, investmentRisk, detail: `天井まで最大約${remainingGames}Gとして試算` };
  }

  function calculateTokyo(input) {
    const cz = clamp(Number(input.cz) || 0, 0, 1200);
    const bankroll = Math.max(0, Number(input.bankroll) || 0);
    const alreadyInvested = Math.max(0, Number(input.currentInvest) || 0);
    const rates = rateValues(input.lendCoins, input.exchangeRate);
    const remainingGames = Math.max(80, 700 - cz);
    const requiredCoins = remainingGames * (50 / 31);
    const additionalRisk = Math.min(bankroll, requiredCoins * rates.costPerCoin);
    const equalRateEv = interpolate([[0, -5600], [180, -4300], [350, -2200], [500, -500], [700, 2300], [1200, 3200]], cz);
    const exchangeGap = 500 * Math.max(0, rates.costPerCoin - rates.cashPerCoin);
    return {
      expectedValue: equalRateEv - exchangeGap,
      investmentRisk: additionalRisk,
      exposure: alreadyInvested + additionalRisk,
      detail: `投資済み${Math.round(alreadyInvested).toLocaleString('ja-JP')}円は期待値と分けて表示`,
    };
  }

  function calculateJuggler(input) {
    const totalG = Math.max(0, Number(input.totalG) || 0);
    const big = Math.max(0, Number(input.big) || 0);
    const reg = Math.max(0, Number(input.reg) || 0);
    const hamari = Math.max(0, Number(input.hamari) || 0);
    const heldCoins = Math.max(0, Number(input.heldCoins) || 0);
    const plannedCash = Math.max(0, Number(input.plannedCash) || 0);
    const rates = rateValues(input.lendCoins, input.exchangeRate);
    const regRate = reg > 0 ? totalG / reg : 999;
    const sampleWeight = clamp(totalG / 5000, 0, 1);
    const observedPayout = regRate <= 280 ? 1.005 : regRate <= 330 ? 0.99 : 0.97;
    const payoutRate = 0.97 + (observedPayout - 0.97) * sampleWeight;
    const horizonGames = 500;
    const wagerCoins = horizonGames * 3;
    const equalRateEv = wagerCoins * (payoutRate - 1) * rates.costPerCoin;
    const exchangeGap = wagerCoins * payoutRate * Math.max(0, rates.costPerCoin - rates.cashPerCoin);
    const grossCoinNeed = Math.max(0, wagerCoins - heldCoins);
    const investmentRisk = Math.max(plannedCash, grossCoinNeed * rates.costPerCoin);
    const combined = big + reg > 0 ? Math.round(totalG / (big + reg)) : 999;
    return {
      expectedValue: equalRateEv - exchangeGap,
      investmentRisk,
      detail: `次の${horizonGames}Gを仮定（合算1/${combined}・REG1/${Math.round(regRate)}）。${hamari}Gハマリ自体は当選率を上げません`,
    };
  }

  const api = { calculateHokuto, calculateTokyo, calculateJuggler, rateValues };
  root.PachiCalculator = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof globalThis === 'undefined' ? window : globalThis));

