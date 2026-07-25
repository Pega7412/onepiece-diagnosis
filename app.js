const machines = {
  hokuto: { name: 'スマスロ 北斗の拳 転生の章2', short: '北斗 転生2', border: '深いあべし or 明確な狙い目だけ', note: '天井までの残り投資を軍資金から逆算。中途半端なゾーン＋取り返したい気持ちは即停止。' },
  tokyo: { name: 'L 東京喰種', short: '東京喰種', border: 'CZ間・差枚の根拠がある時だけ', note: 'AT後の引き戻し追い、CZ間のズルズル追加投資に注意。上限を先に決める。' },
  juggler: { name: 'アイムジャグラーEX', short: 'ジャグラー', border: '高REG比率＋十分な総Gのみ', note: '合算だけ、ハマリ反発狙い、そろそろペカる思考は禁止。追加投資の前に撤退。' },
};

const riskCopy = {
  safe: { label: '安全', message: '今はルール内。上限投資を決めて、崩れたら即退店。' },
  caution: { label: '注意', message: '一呼吸。根拠が薄いなら、今日は見送るだけで勝ちです。' },
  danger: { label: '危険', message: 'ストップ。取り返すための投資は、勝つための投資ではありません。' },
};

const state = { machine: 'hokuto', mental: 'calm', sessions: [] };
const yen = (value) => new Intl.NumberFormat('ja-JP').format(Number(value) || 0);
const numberValue = (id) => Number(document.getElementById(id)?.value || 0);

function renderMachineFields() {
  const fields = document.getElementById('machine-fields');
  const templates = {
    hokuto: '<label class="number-field">現在のあべし数<span><input id="abesi" type="number" inputmode="numeric" value="450" />あべし</span></label>',
    tokyo: '<label class="number-field">現在のゲーム数 / CZ間<span><input id="cz" type="number" inputmode="numeric" value="220" />G</span></label><label class="number-field">この台への投資済み額<span><input id="currentInvest" type="number" inputmode="numeric" value="10000" />円</span></label>',
    juggler: '<label class="number-field">総ゲーム数<span><input id="totalG" type="number" inputmode="numeric" value="2800" />G</span></label><div class="entry-grid"><label class="number-field">BIG<span><input id="big" type="number" inputmode="numeric" value="8" />回</span></label><label class="number-field">REG<span><input id="reg" type="number" inputmode="numeric" value="5" />回</span></label></div><label class="number-field">現在のハマリ<span><input id="hamari" type="number" inputmode="numeric" value="420" />G</span></label><div class="entry-grid"><label class="number-field">持ちメダル<span><input id="heldCoins" type="number" inputmode="numeric" value="0" />枚</span></label><label class="number-field">追加投資予定<span><input id="plannedCash" type="number" inputmode="numeric" value="10000" />円</span></label></div>',
    tokyo: '<label class="number-field">現在のゲーム数 / CZ間<span><input id="cz" type="number" inputmode="numeric" value="220" />G</span></label>',
    juggler: '<label class="number-field">総ゲーム数<span><input id="totalG" type="number" inputmode="numeric" value="2800" />G</span></label><div class="entry-grid"><label class="number-field">BIG<span><input id="big" type="number" inputmode="numeric" value="8" />回</span></label><label class="number-field">REG<span><input id="reg" type="number" inputmode="numeric" value="5" />回</span></label></div><label class="number-field">現在のハマリ<span><input id="hamari" type="number" inputmode="numeric" value="420" />G</span></label>',
  };
  fields.innerHTML = templates[state.machine];
  fields.querySelectorAll('input').forEach((input) => input.addEventListener('input', renderRisk));
  renderRisk();
}

function judge() {
  const bankroll = numberValue('bankroll');
  let score = state.mental === 'tilt' ? 2 : 0;
  const reasons = [];

  if (bankroll < 15000) {
    score += 2;
    reasons.push('軍資金が薄く、追加投資で生活費ラインを割りやすい');
  }
  if (state.machine === 'hokuto') {
    const abesi = numberValue('abesi');
    if (abesi < 650 || (abesi > 900 && bankroll < 30000)) score += 2;
    reasons.push(`現在${abesi}あべし。天井までの投資リスクを先に見積もって。`);
  }
  if (state.machine === 'tokyo') {
    const cz = numberValue('cz');
    if (cz > 180 || state.mental === 'tilt') score += 2;
    reasons.push(`CZ間${cz}G。AT後・CZ間の追い銭が負けパターンになりやすい。`);
  }
  if (state.machine === 'juggler') {
    const totalG = numberValue('totalG');
    const big = numberValue('big');
    const reg = numberValue('reg');
    const hamari = numberValue('hamari');
    const combined = big + reg ? Math.round(totalG / (big + reg)) : 999;
    if (combined > 160 || hamari > 350 || reg < big * 0.55) score += 2;
    reasons.push(`合算1/${combined}、現在${hamari}Gハマリ。「そろそろ」は根拠ではない。`);
  }
  const economics = calculateEconomics();
  if (economics.expectedValue <= -3000) score += 2;
  else if (economics.expectedValue < 0) score += 1;
  return { risk: score >= 4 ? 'danger' : score >= 2 ? 'caution' : 'safe', reasons, economics };
}

function calculateEconomics() {
  const common = {
    bankroll: numberValue('bankroll'),
    lendCoins: numberValue('lend-coins'),
    exchangeRate: numberValue('exchange-rate'),
  };
  if (state.machine === 'hokuto') return PachiCalculator.calculateHokuto({ ...common, abesi: numberValue('abesi') });
  if (state.machine === 'tokyo') return PachiCalculator.calculateTokyo({ ...common, cz: numberValue('cz'), currentInvest: numberValue('currentInvest') });
  return PachiCalculator.calculateJuggler({
    ...common,
    totalG: numberValue('totalG'), big: numberValue('big'), reg: numberValue('reg'), hamari: numberValue('hamari'),
    heldCoins: numberValue('heldCoins'), plannedCash: numberValue('plannedCash'),
  });
}

function renderRisk() {
  const result = judge();
  const copy = riskCopy[result.risk];
  const card = document.getElementById('risk-card');
  card.className = `risk-card ${result.risk}`;
  card.innerHTML = `<span>危険度</span><h2>${copy.label}</h2><p>${copy.message}</p><ul>${result.reasons.map((reason) => `<li>${reason}</li>`).join('')}</ul>`;
}

function loadSessions() {
  state.sessions = JSON.parse(localStorage.getItem('pachiSessions') || '[]');
}

function saveSessions() {
  localStorage.setItem('pachiSessions', JSON.stringify(state.sessions));
}

function loadRateSettings() {
  const saved = JSON.parse(localStorage.getItem('pachiRateSettings') || '{}');
  if (saved.lendCoins) document.getElementById('lend-coins').value = saved.lendCoins;
  if (saved.exchangeRate) document.getElementById('exchange-rate').value = saved.exchangeRate;
}

function saveRateSettings() {
  localStorage.setItem('pachiRateSettings', JSON.stringify({
    lendCoins: document.getElementById('lend-coins').value,
    exchangeRate: document.getElementById('exchange-rate').value,
  }));
  renderRisk();
}

function renderReport() {
  const net = state.sessions.reduce((sum, item) => sum + item.payout - item.invest, 0);
  const tagCounts = state.sessions
    .filter((item) => item.payout - item.invest < 0)
    .reduce((acc, item) => ({ ...acc, [item.tag]: (acc[item.tag] || 0) + 1 }), {});
  const worst = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0];

  document.getElementById('net-total').textContent = `${net >= 0 ? '+' : ''}${yen(net)}円`;
  document.getElementById('worst-tag').textContent = `最多敗因: ${worst ? `${worst[0]}（${worst[1]}回）` : 'まだ記録なし'}`;
  document.getElementById('session-list').innerHTML = state.sessions.map((item) => `
    <article class="session-item">
      <b>${item.machine}</b><strong>${yen(item.payout - item.invest)}円</strong>
      <div class="muted">${item.date} / ${item.tag}</div>
    </article>
  `).join('');
}

function renderBorders() {
  document.getElementById('border-list').innerHTML = Object.values(machines).map((machine) => `
    <article class="border-card">
      <h2>${machine.name}</h2>
      <div class="border-line">${machine.border}</div>
      <p class="muted">${machine.note}</p>
    </article>
  `).join('');
}

function bindEvents() {
  document.querySelectorAll('.machine-btn').forEach((button) => button.addEventListener('click', () => {
    state.machine = button.dataset.machine;
    document.querySelectorAll('.machine-btn').forEach((item) => item.classList.toggle('is-selected', item === button));
    renderMachineFields();
  }));

  document.querySelectorAll('.mental-btn').forEach((button) => button.addEventListener('click', () => {
    state.mental = button.dataset.mental;
    document.querySelectorAll('.mental-btn').forEach((item) => item.classList.toggle('is-selected', item === button));
    renderRisk();
  }));

  document.getElementById('bankroll').addEventListener('input', renderRisk);
  document.getElementById('lend-coins').addEventListener('change', saveRateSettings);
  document.getElementById('exchange-rate').addEventListener('change', saveRateSettings);
  document.getElementById('add-session').addEventListener('click', () => {
    state.sessions.unshift({
      id: `${Date.now()}-${Math.random()}`,
      date: new Date().toLocaleDateString('ja-JP'),
      machine: document.getElementById('entry-machine').value,
      tag: document.getElementById('entry-tag').value,
      invest: numberValue('entry-invest'),
      payout: numberValue('entry-payout'),
    });
    saveSessions();
    renderReport();
  });

  document.querySelectorAll('.tab-btn').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((item) => item.classList.toggle('is-selected', item === button));
    document.querySelectorAll('.screen').forEach((screen) => screen.classList.toggle('is-active', screen.id === button.dataset.tab));
  }));
}

loadSessions();
renderMachineFields();
renderBorders();
renderReport();
bindEvents();
