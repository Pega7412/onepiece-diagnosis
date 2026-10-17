(function () {
  'use strict';

  const E = window.SlotEngine;
  const KEY = 'slotgame.v1';
  const N = E.REEL_LEN;
  const SPIN_SPEED = 22; // コマ/秒（見た目の回転速度）
  const LUCKY_SPINS = 100;
  const LUCKY_MULT = 1.5;

  const $ = (sel, root) => (root || document).querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => Number(n).toLocaleString('ja-JP');
  const charById = (id) => E.CHARACTERS.find((c) => c.id === id) || E.CHARACTERS[0];
  const GLYPH = { seven: '7', bar: 'BAR', bell: '🔔', melon: '🍉', cherry: '🍒', replay: '🔁' };
  const symHTML = (s) => '<span class="sym s-' + s + '">' + GLYPH[s] + '</span>';

  // ---- セーブデータ -----------------------------------------------------------
  function defaults() {
    return {
      v: 1,
      id: String(100000 + Math.floor(Math.random() * 900000)),
      name: 'プレイヤー', bio: '', title: null,
      stars: 15, coins: 5000, xp: 0,
      mp: { v: E.mpMax(1), at: Date.now() },
      icon: 'c01', owned: { c01: 1 },
      items: { lucky: 1, mpfull: 1 }, luck: 0,
      stats: { spins: 0, big: 0, reg: 0, maxNet: 0, sessions: 0 },
      missions: { day: '', progress: {}, claimed: {} },
      presents: [], login: { last: '', streak: 0 }
    };
  }

  function merge(base, saved) {
    if (!saved || typeof saved !== 'object') return base;
    for (const k of Object.keys(base)) {
      if (!(k in saved)) continue;
      const b = base[k];
      base[k] = b && typeof b === 'object' && !Array.isArray(b) ? merge(b, saved[k]) : saved[k];
    }
    // 辞書型（所持キャラ・進捗・受取済み）は保存値をそのまま使う
    for (const k of ['owned']) if (saved[k]) base[k] = saved[k];
    if (saved.missions) {
      base.missions.progress = saved.missions.progress || {};
      base.missions.claimed = saved.missions.claimed || {};
    }
    return base;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return merge(defaults(), JSON.parse(raw));
    } catch (e) { /* 保存できない環境でも遊べるようにする */ }
    return defaults();
  }

  let S = load();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* noop */ }
  }

  const level = () => E.levelInfo(S.xp).level;
  function refreshMp() {
    S.mp = E.mpNow(S.mp, level(), Date.now());
    return S.mp.v;
  }

  // ---- 日替わり処理 -----------------------------------------------------------
  function rollDay() {
    const today = E.dayKey(new Date());
    if (S.missions.day !== today) S.missions = { day: today, progress: {}, claimed: {} };
    if (S.login.last !== today) {
      const y = new Date(); y.setDate(y.getDate() - 1);
      S.login.streak = S.login.last === E.dayKey(y) ? S.login.streak + 1 : 1;
      S.login.last = today;
      S.presents.push({
        id: 'login-' + today, title: 'ログインボーナス ' + S.login.streak + '日目',
        coins: 500 + 100 * Math.min(S.login.streak, 7), stars: S.login.streak % 7 === 0 ? 3 : 0
      });
    }
    save();
  }

  function addProgress(key, n) {
    S.missions.progress[key] = (S.missions.progress[key] || 0) + n;
  }

  function claimable() {
    return E.MISSIONS.filter((m) => !S.missions.claimed[m.id] && (S.missions.progress[m.key] || 0) >= m.goal);
  }

  function addXp(n) {
    const before = level();
    S.xp += n;
    if (level() > before) toast('レベルアップ! Lv.' + level());
  }

  // ---- 共通UI ----------------------------------------------------------------
  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  function showModal(html) {
    const m = $('#modal');
    m.innerHTML = '<div class="box">' + html + '</div>';
    m.hidden = false;
  }
  function closeModal() { $('#modal').hidden = true; }

  function updateTop() {
    refreshMp();
    $('#statStars').textContent = fmt(S.stars);
    $('#statCoins').textContent = fmt(S.coins);
    $('#statMp').textContent = S.mp.v + '/' + E.mpMax(level());
    const n = claimable().length;
    const b = $('#badgeMission');
    b.hidden = n === 0;
    b.textContent = n;
  }

  const TITLES = { home: 'ホーム', halls: 'ホール選択', machines: '機種を選ぶ', slot: '遊技中', mypage: 'マイページ',
    items: 'アイテム', gacha: 'ガチャ', shop: 'ショップ', missions: 'ミッション' };
  let current = 'home';

  function go(name, arg) {
    if (game && name !== 'slot') leaveGame();
    current = name;
    document.body.classList.toggle('in-slot', name === 'slot');
    $('#screenTitle').textContent = TITLES[name];
    document.querySelectorAll('#nav button').forEach((b) => {
      const target = { halls: 'home', machines: 'home', slot: 'home' }[name] || name;
      b.classList.toggle('on', b.dataset.nav === target);
    });
    const view = $('#view');
    view.scrollTop = 0;
    view.innerHTML = VIEWS[name](arg);
    if (name === 'slot') setupSlot();
    updateTop();
  }

  // ---- 画面: ホーム ------------------------------------------------------------
  function homeView() {
    const c = charById(S.icon);
    const presents = S.presents.length;
    return '<div class="hero" style="--c:' + c.color + '">' +
      '<div class="side">' +
      '<button data-act="notices">お知らせ</button>' +
      '<button data-act="presents">プレゼント' + (presents ? '<span class="badge">' + presents + '</span>' : '') + '</button>' +
      '<button data-go="missions">ミッション' + (claimable().length ? '<span class="badge">' + claimable().length + '</span>' : '') + '</button>' +
      '</div><div class="face">' + c.face + '</div>' +
      '<div class="name">' + esc(S.name) + '　Lv.' + level() + '</div></div>' +
      '<button class="btn pink play-big" data-go="halls">PLAY</button>' +
      '<div class="shortcuts">' +
      '<button class="btn gray" data-go="gacha">ガチャ</button>' +
      '<button class="btn gray" data-go="shop">ショップ</button>' +
      '<button class="btn gray" data-act="help">遊び方</button></div>';
  }

  // ---- 画面: ホール・機種 -------------------------------------------------------
  function hallsView() {
    const now = new Date();
    return '<div class="muted" style="margin-bottom:8px">ホールを選んで遊ぼう。差枚×レートがコインになります。</div>' +
      E.HALLS.map((h) => {
        const open = E.isOpen(h, now);
        const lock = level() < h.minLevel;
        const ok = open && !lock;
        return '<div class="card hall' + (ok ? '' : ' closed') + '">' +
          '<div class="icon">🏢<span class="rate">' + h.rate + '倍</span></div><div>' +
          '<b>' + esc(h.name) + '</b> <span class="pill">' + (open ? '営業中' : '営業時間外') + '</span>' +
          '<div class="kv"><span>営業時間</span><span>' + E.hoursLabel(h) + '</span>' +
          '<span>上限回転数</span><span>' + fmt(h.limit) + '</span>' +
          '<span>必要レベル</span><span>Lv.' + h.minLevel + '</span></div>' +
          '<button class="btn small" data-act="hall" data-id="' + h.id + '"' + (ok ? '' : ' disabled') + '>' +
          (lock ? 'Lv.' + h.minLevel + 'で解放' : '入店する') + '</button></div></div>';
      }).join('');
  }

  function machinesView(hallId) {
    pendingHall = E.HALLS.find((h) => h.id === hallId);
    return '<div class="muted" style="margin-bottom:8px">' + esc(pendingHall.name) + '（' + pendingHall.rate + '倍）</div>' +
      '<div class="card"><div class="row"><div class="avatar" style="--c:#7a2cff">🎰</div><div class="grow">' +
      '<b>ネオンパレード</b><div class="muted">3リール・1ライン／ボーナス目押しタイプ</div>' +
      '<div class="muted">BET 3枚・BIG 30G・REG 10G</div></div></div>' +
      '<div style="margin-top:10px"><button class="btn pink" style="width:100%" data-act="play">この機種を打つ</button></div></div>';
  }
  let pendingHall = null;

  // ---- 画面: スロット -----------------------------------------------------------
  let game = null;

  function slotView() {
    return '<div class="slot">' +
      '<div class="slot-head"><div>差枚<b id="gNet">0</b></div><div>回転数<b id="gSpins">0</b></div><div id="gMode">通常<b>—</b></div></div>' +
      '<div class="cab"><div class="reels">' +
      [0, 1, 2].map((i) => '<div class="reel" data-reel="' + i + '"><div class="strip">' +
        '<div class="cell"></div>'.repeat(5) + '</div></div>').join('') +
      '<div class="payline"></div></div><div class="msg" id="gMsg">レバーを叩いてスタート!</div></div>' +
      '<div class="stops">' + [0, 1, 2].map((i) => '<button class="btn gold" data-act="stop" data-reel="' + i + '" disabled>STOP</button>').join('') + '</div>' +
      '<div class="ctl"><button class="btn pink" id="gLever" data-act="lever">レバーON</button>' +
      '<button class="btn gray" id="gAuto" data-act="auto">オート</button>' +
      '<button class="btn gray" data-act="settle">精算</button></div></div>';
  }

  function enterHall(hall) {
    const now = new Date();
    game = {
      hall, setting: E.hallSetting(hall, now), machine: E.newMachine(),
      net: 0, spins: 0, phase: 'idle', spin: null, auto: false, timers: [],
      reels: [0, 1, 2].map((i) => ({ pos: Math.floor(Math.random() * N), mode: 'stopped', target: 0, lastC: null, i })),
      raf: 0, last: 0
    };
    go('slot');
  }

  function setupSlot() {
    game.reels.forEach((r) => {
      r.el = $('.reel[data-reel="' + r.i + '"] .strip');
      r.cell = r.el.parentNode.clientHeight / 3 || 71;
      r.lastC = null;
      drawReel(r);
    });
    updateSlotHud();
    game.last = performance.now();
    game.raf = requestAnimationFrame(frame);
  }

  function mod(n) { return ((n % N) + N) % N; }

  function drawReel(r) {
    const c = Math.round(r.pos);
    const f = r.pos - c;
    if (r.lastC !== c) {
      const strip = E.STRIPS[r.i];
      const cells = r.el.children;
      for (let k = 0; k < 5; k++) cells[k].innerHTML = symHTML(strip[mod(c + 2 - k)]);
      r.lastC = c;
    }
    r.el.style.transform = 'translateY(' + ((f - 1) * r.cell).toFixed(1) + 'px)';
  }

  function frame(ts) {
    if (!game) return;
    const dt = Math.min(0.05, (ts - game.last) / 1000);
    game.last = ts;
    for (const r of game.reels) {
      if (r.mode === 'spin') {
        r.pos += SPIN_SPEED * dt;
        if (r.pos >= N) r.pos -= N;
      } else if (r.mode === 'slide') {
        r.pos += SPIN_SPEED * dt;
        if (r.pos >= r.target) {
          r.pos = mod(r.target);
          r.mode = 'stopped';
          reelStopped();
        }
      }
      drawReel(r);
    }
    game.raf = requestAnimationFrame(frame);
  }

  function setMsg(text, cls) {
    const el = $('#gMsg');
    if (!el) return;
    el.textContent = text;
    el.className = 'msg' + (cls ? ' ' + cls : '');
  }

  function updateSlotHud() {
    if (!game) return;
    const m = game.machine;
    $('#gNet').textContent = (game.net > 0 ? '+' : '') + fmt(game.net);
    $('#gSpins').textContent = fmt(game.spins) + '/' + fmt(game.hall.limit);
    let mode = '通常<b>' + (S.luck > 0 ? 'ラッキー' + S.luck : '—') + '</b>';
    if (m.bonus) mode = m.bonus.type.toUpperCase() + '中<b>残り' + m.bonus.left + 'G</b>';
    else if (m.bonusPending) mode = 'ボーナス待機<b>7/BARを狙え!</b>';
    $('#gMode').innerHTML = mode;
    $('#gAuto').classList.toggle('on', game.auto);
    $('#gLever').disabled = game.phase !== 'idle';
    document.querySelectorAll('[data-act="stop"]').forEach((b) => {
      b.disabled = !(game.phase === 'spinning' && game.reels[b.dataset.reel].mode === 'spin');
    });
  }

  function lever() {
    if (!game || game.phase !== 'idle') return;
    if (game.spins >= game.hall.limit) { toast('上限回転数です。精算してください'); stopAuto(); return; }
    if (refreshMp() < 1) { toast('MPが足りません（アイテムかショップで回復）'); stopAuto(); return; }
    S.mp.v -= 1;
    if (S.mp.v === E.mpMax(level()) - 1) S.mp.at = Date.now();
    const luck = S.luck > 0 ? LUCKY_MULT : 1;
    if (S.luck > 0) S.luck -= 1;
    game.spin = E.beginSpin(game.machine, game.setting, Math.random, luck);
    game.net -= game.spin.bet;
    game.spins += 1;
    game.phase = 'spinning';
    S.stats.spins += 1;
    addProgress('spins', 1);
    addXp(1);
    game.reels.forEach((r) => { r.mode = 'spin'; });
    setMsg(game.spin.free ? 'リプレイ！ BETなし' : '回転中…');
    updateSlotHud();
    updateTop();
    if (game.auto) {
      [0, 1, 2].forEach((i) => {
        game.timers.push(setTimeout(() => pressStop(i), 450 + i * 380 + Math.random() * 300));
      });
    }
  }

  function pressStop(i) {
    if (!game || game.phase !== 'spinning') return;
    const r = game.reels[i];
    if (r.mode !== 'spin') return;
    const base = Math.ceil(r.pos - 1e-9);
    const res = E.stopReel(game.spin, i, mod(base));
    r.mode = 'slide';
    r.target = base + res.slide;
    updateSlotHud();
  }

  function reelStopped() {
    if (game.reels.some((r) => r.mode !== 'stopped')) { updateSlotHud(); return; }
    const out = E.finishSpin(game.machine, game.spin);
    game.net += out.payout;
    game.phase = 'idle';
    S.stats.maxNet = Math.max(S.stats.maxNet, game.net);
    let msg = E.ROLE_LABEL[out.result];
    let cls = '';
    if (out.payout > 0) { msg += ' +' + out.payout + '枚'; cls = 'win'; }
    if (out.result === 'replay') msg = 'リプレイ！ 次のゲームはBETなし';
    if (out.bonusStarted) {
      msg = out.bonusStarted.toUpperCase() + ' BONUS!! ' + E.BONUS_GAMES[out.bonusStarted] + 'G';
      cls = 'bonus';
      S.stats[out.bonusStarted] += 1;
      addProgress('bonus', 1);
    }
    if (out.bonusEnded) msg = 'ボーナス終了！';
    if (game.spin.role === 'big' || game.spin.role === 'reg') {
      if (!out.bonusStarted) msg = 'ボーナスを取りこぼし… まだ有効！';
    }
    setMsg(msg, cls);
    updateSlotHud();
    save();
    updateTop();
    if (game.auto) game.timers.push(setTimeout(lever, 700));
  }

  function stopAuto() {
    if (!game) return;
    game.auto = false;
    game.timers.forEach(clearTimeout);
    game.timers = [];
    updateSlotHud();
  }

  function toggleAuto() {
    if (!game) return;
    game.auto = !game.auto;
    if (game.auto && game.phase === 'idle') lever();
    else if (game.auto && game.phase === 'spinning') {
      [0, 1, 2].forEach((i) => game.timers.push(setTimeout(() => pressStop(i), 300 + i * 350)));
    }
    if (!game.auto) { game.timers.forEach(clearTimeout); game.timers = []; }
    updateSlotHud();
  }

  function leaveGame() {
    if (!game) return;
    cancelAnimationFrame(game.raf);
    game.timers.forEach(clearTimeout);
    game = null;
  }

  function settle() {
    if (!game) return;
    if (game.phase !== 'idle') { toast('回転が止まってから精算してください'); return; }
    const gain = E.settleCoins(game.net, game.hall);
    showModal('<h3>精算</h3><div class="kv"><span>回転数</span><span>' + fmt(game.spins) + '</span>' +
      '<span>差枚</span><span>' + (game.net > 0 ? '+' : '') + fmt(game.net) + '枚</span>' +
      '<span>レート</span><span>' + game.hall.rate + '倍</span><span>獲得コイン</span><b>' + fmt(gain) + '</b></div>' +
      '<div class="muted">マイナスの場合はコインは減りません。</div>' +
      '<div class="actions"><button class="btn gray" data-act="close">続ける</button>' +
      '<button class="btn pink" data-act="settleOk">精算して出る</button></div>');
  }

  function settleOk() {
    const gain = E.settleCoins(game.net, game.hall);
    S.coins += gain;
    S.stats.sessions += 1;
    addProgress('sessions', 1);
    S.missions.progress.bestNet = Math.max(S.missions.progress.bestNet || 0, game.net);
    save();
    closeModal();
    toast(gain > 0 ? fmt(gain) + 'コイン獲得!' : 'お疲れさま');
    go('home');
  }

  // ---- 画面: マイページ ---------------------------------------------------------
  function earnedTitles() { return E.TITLES.filter((t) => t.ok(S)); }

  function mypageView() {
    const c = charById(S.icon);
    const info = E.levelInfo(S.xp);
    const title = (E.TITLES.find((t) => t.id === S.title) || {}).label;
    return '<div class="card"><div class="row"><div class="avatar rar-' + c.rar + '" style="--c:' + c.color + '">' + c.face + '</div>' +
      '<div class="grow"><div class="row"><b style="font-size:18px">' + esc(S.name) + '</b>' +
      '<button class="btn small gray" data-act="editName">編集</button></div>' +
      '<div class="row" style="margin:6px 0"><span class="pill">Lv.' + info.level + '</span>' +
      '<div class="bar grow"><i style="width:' + Math.floor(info.rest / info.need * 100) + '%"></i></div></div>' +
      '<button class="btn small gray" data-act="pickTitle">' + (title ? '称号: ' + esc(title) : '称号未設定') + '</button></div></div>' +
      '<div style="margin-top:8px"><button class="btn small" data-act="pickIcon">アイコン変更</button></div></div>' +
      '<div class="card kv"><span>ID</span><span>' + esc(S.id) + '</span>' +
      '<span>通算回転数</span><span>' + fmt(S.stats.spins) + '回</span>' +
      '<span>BIG / REG</span><span>' + S.stats.big + ' / ' + S.stats.reg + '</span>' +
      '<span>最大差枚</span><span>' + fmt(S.stats.maxNet) + '枚</span>' +
      '<span>遊技回数</span><span>' + S.stats.sessions + '回</span></div>' +
      '<h2 class="sec">ひとこと</h2><div class="card"><div style="white-space:pre-wrap;min-height:40px">' + esc(S.bio || '（未設定）') + '</div>' +
      '<button class="btn small gray" data-act="editBio" style="margin-top:8px">編集</button></div>' +
      '<h2 class="sec">データ</h2><div class="card"><div class="muted">セーブデータはこの端末のブラウザに保存されます。</div>' +
      '<button class="btn small gray" data-act="reset" style="margin-top:8px">最初からやり直す</button></div>';
  }

  // ---- 画面: アイテム -----------------------------------------------------------
  const ITEM_DEFS = {
    mpfull: { name: 'MP全回復', desc: 'MPを最大まで回復します', icon: '💧', coins: 2000 },
    lucky: { name: 'ラッキーチャージ', desc: LUCKY_SPINS + 'ゲームの間、ボーナス抽選が' + LUCKY_MULT + '倍になります', icon: '🍀', coins: 4000 }
  };

  function itemsView() {
    return Object.keys(ITEM_DEFS).map((id) => {
      const d = ITEM_DEFS[id];
      const have = S.items[id] || 0;
      return '<div class="card row"><div class="avatar" style="--c:#2a3fd6;width:60px;height:60px;font-size:30px">' + d.icon + '</div>' +
        '<div class="grow"><b>' + d.name + '</b> <span class="pill">×' + have + '</span><div class="muted">' + d.desc + '</div></div>' +
        '<button class="btn small" data-act="useItem" data-id="' + id + '"' + (have ? '' : ' disabled') + '>使う</button></div>';
    }).join('') + '<div class="muted">アイテムはショップで購入、またはミッションやプレゼントで入手できます。</div>';
  }

  function useItem(id) {
    if (!(S.items[id] > 0)) return;
    if (id === 'mpfull') {
      S.mp = { v: E.mpMax(level()), at: Date.now() };
    } else if (id === 'lucky') {
      if (S.luck > 0) { toast('すでにラッキーチャージ中です'); return; }
      S.luck = LUCKY_SPINS;
    }
    S.items[id] -= 1;
    save();
    toast(ITEM_DEFS[id].name + 'を使いました');
    go(current);
  }

  // ---- 画面: ガチャ -------------------------------------------------------------
  function gachaView() {
    const owned = Object.keys(S.owned).length;
    return '<div class="gacha-banner">キャラクターガチャ<div class="muted" style="color:#fff">LR 2% / SR 8% / R 30% / N 60%<br>10連はR以上1枠確定</div></div>' +
      '<div class="gacha-btns">' +
      '<button class="btn" data-act="pull" data-n="1" data-pay="coins">1回<br>' + fmt(E.GACHA_COST.single) + 'コイン</button>' +
      '<button class="btn pink" data-act="pull" data-n="10" data-pay="coins">10連<br>' + fmt(E.GACHA_COST.ten) + 'コイン</button>' +
      '<button class="btn gray" data-act="pull" data-n="1" data-pay="stars">1回<br>★10</button>' +
      '<button class="btn gray" data-act="pull" data-n="10" data-pay="stars">10連<br>★90</button></div>' +
      '<h2 class="sec">図鑑 ' + owned + '/' + E.CHARACTERS.length + '</h2><div class="grid">' +
      E.CHARACTERS.map((c) => {
        const has = S.owned[c.id];
        return '<div class="rel"><div class="avatar rar-' + c.rar + (has ? '' : ' own-no') + '" style="--c:' + c.color + '">' + (has ? c.face : '？') + '</div>' +
          '<div class="muted" style="text-align:center;margin-top:2px"><span class="tag rar-' + c.rar + '">' + c.rar + '</span> ' + (has ? esc(c.name) : '???') + '</div></div>';
      }).join('') + '</div>';
  }

  function pull(n, pay) {
    const cost = pay === 'stars' ? (n === 1 ? 10 : 90) : (n === 1 ? E.GACHA_COST.single : E.GACHA_COST.ten);
    const have = pay === 'stars' ? S.stars : S.coins;
    if (have < cost) { toast((pay === 'stars' ? 'スター' : 'コイン') + 'が足りません'); return; }
    if (pay === 'stars') S.stars -= cost; else S.coins -= cost;
    const got = n === 1 ? [E.rollCharacter(Math.random)] : E.rollTen(Math.random);
    let refund = 0;
    const cards = got.map((c) => {
      const isNew = !S.owned[c.id];
      if (isNew) S.owned[c.id] = 1; else refund += E.DUPLICATE_COINS[c.rar];
      return '<div class="rel"><div class="avatar rar-' + c.rar + '" style="--c:' + c.color + '">' + c.face + '</div>' +
        (isNew ? '<span class="new">NEW</span>' : '') + '<div class="muted" style="text-align:center">' + c.rar + '</div></div>';
    }).join('');
    S.coins += refund;
    save();
    showModal('<h3>ガチャ結果</h3><div class="result-cards" style="' + (n === 1 ? 'grid-template-columns:1fr;max-width:140px;margin:12px auto' : '') + '">' + cards + '</div>' +
      (refund ? '<div class="muted">重複ぶんは ' + fmt(refund) + 'コインに交換されました</div>' : '') +
      '<div class="actions"><button class="btn" data-act="closeGacha">OK</button></div>');
    updateTop();
  }

  // ---- 画面: ショップ -----------------------------------------------------------
  function shopView() {
    return '<div class="muted" style="margin-bottom:8px">このバージョンは課金なし。スターはミッションとログインボーナスで貯まります。</div>' +
      '<h2 class="sec">コイン交換</h2><div class="card row"><div class="grow"><b>★1 → 500コイン</b><div class="muted">所持 ★' + fmt(S.stars) + '</div></div>' +
      '<button class="btn small gold" data-act="exchange"' + (S.stars < 1 ? ' disabled' : '') + '>交換</button></div>' +
      '<h2 class="sec">アイテム</h2>' + Object.keys(ITEM_DEFS).map((id) => {
        const d = ITEM_DEFS[id];
        return '<div class="card row"><div class="avatar" style="--c:#2a3fd6;width:60px;height:60px;font-size:30px">' + d.icon + '</div>' +
          '<div class="grow"><b>' + d.name + '</b><div class="muted">' + d.desc + '</div></div>' +
          '<button class="btn small" data-act="buy" data-id="' + id + '">' + fmt(d.coins) + '<br>コイン</button></div>';
      }).join('');
  }

  // ---- 画面: ミッション ---------------------------------------------------------
  function missionsView() {
    return '<div class="muted" style="margin-bottom:8px">毎日0時にリセットされます。</div>' +
      E.MISSIONS.map((m) => {
        const cur = Math.min(S.missions.progress[m.key] || 0, m.goal);
        const done = cur >= m.goal;
        const claimed = S.missions.claimed[m.id];
        const reward = (m.reward.coins ? fmt(m.reward.coins) + 'コイン' : '') + (m.reward.stars ? '★' + m.reward.stars : '');
        return '<div class="card"><div class="row"><div class="grow"><b>' + m.label + '</b><div class="muted">報酬: ' + reward + '</div></div>' +
          '<button class="btn small gold" data-act="claim" data-id="' + m.id + '"' + (done && !claimed ? '' : ' disabled') + '>' + (claimed ? '受取済' : '受取') + '</button></div>' +
          '<div class="row" style="margin-top:6px"><div class="bar grow"><i style="width:' + Math.floor(cur / m.goal * 100) + '%"></i></div>' +
          '<span class="muted">' + fmt(cur) + '/' + fmt(m.goal) + '</span></div></div>';
      }).join('');
  }

  function giveReward(r) {
    if (r.coins) S.coins += r.coins;
    if (r.stars) S.stars += r.stars;
    if (r.items) for (const k of Object.keys(r.items)) S.items[k] = (S.items[k] || 0) + r.items[k];
  }

  // ---- モーダル系 ---------------------------------------------------------------
  function presentsModal() {
    const list = S.presents.length ?
      S.presents.map((p, i) => '<div class="card row"><div class="grow"><b>' + esc(p.title) + '</b><div class="muted">' +
        (p.coins ? fmt(p.coins) + 'コイン ' : '') + (p.stars ? '★' + p.stars : '') + '</div></div>' +
        '<button class="btn small gold" data-act="takePresent" data-i="' + i + '">受取</button></div>').join('') :
      '<div class="muted">プレゼントはありません</div>';
    showModal('<h3>プレゼントボックス</h3>' + list + '<div class="actions">' +
      (S.presents.length ? '<button class="btn gold" data-act="takeAll">全部受け取る</button>' : '') +
      '<button class="btn gray" data-act="close">閉じる</button></div>');
  }

  function helpModal() {
    showModal('<h3>遊び方</h3><div class="muted">① ホールに入り、機種を選びます。<br>② レバーONで3つのリールが回ります。<br>' +
      '③ STOPボタンで1つずつ止めます。ボーナス(7/BAR)は目押しが必要です。<br>④ 精算すると、差枚×ホールのレートぶんのコインが手に入ります。<br>' +
      '⑤ 1ゲームごとにMPを1消費します。時間で少しずつ回復します。</div>' +
      '<div class="rules" style="margin-top:10px"><table><tr><th>出目</th><th>払出</th></tr>' +
      '<tr><td>🔁 リプレイ揃い</td><td>次ゲームBETなし</td></tr>' +
      '<tr><td>ベル揃い</td><td>8枚（ボーナス中12枚）</td></tr><tr><td>スイカ揃い</td><td>5枚</td></tr>' +
      '<tr><td>左リールにチェリー</td><td>2枚</td></tr><tr><td>7揃い</td><td>BIG 30G</td></tr>' +
      '<tr><td>BAR揃い</td><td>REG 10G</td></tr></table></div>' +
      '<div class="actions"><button class="btn gray" data-act="close">閉じる</button></div>');
  }

  function noticesModal() {
    showModal('<h3>お知らせ</h3><div class="card"><b>オフライン版 v1</b><div class="muted">ホーム、遊技、マイページ、アイテム、ガチャ、ショップ、ミッションを収録。ランキング・フレンド・ギルド・チャットは未対応です。</div></div>' +
      '<div class="actions"><button class="btn gray" data-act="close">閉じる</button></div>');
  }

  function pickIconModal() {
    showModal('<h3>アイコン変更</h3><div class="grid">' + E.CHARACTERS.filter((c) => S.owned[c.id]).map((c) =>
      '<button class="btn gray" style="padding:0;background:none;box-shadow:none" data-act="setIcon" data-id="' + c.id + '">' +
      '<div class="avatar rar-' + c.rar + '" style="--c:' + c.color + '">' + c.face + '</div></button>').join('') +
      '</div><div class="actions"><button class="btn gray" data-act="close">閉じる</button></div>');
  }

  function pickTitleModal() {
    const list = earnedTitles();
    showModal('<h3>称号</h3>' + (list.length ? list.map((t) => '<div style="margin-bottom:6px"><button class="btn gray" style="width:100%" data-act="setTitle" data-id="' + t.id + '">' + esc(t.label) + '</button></div>').join('') :
      '<div class="muted">まだ称号がありません。遊ぶと手に入ります。</div>') +
      '<div class="actions"><button class="btn gray" data-act="setTitle" data-id="">外す</button><button class="btn gray" data-act="close">閉じる</button></div>');
  }

  // ---- イベント -----------------------------------------------------------------
  const VIEWS = {
    home: homeView, halls: hallsView, machines: machinesView, slot: slotView, mypage: mypageView,
    items: itemsView, gacha: gachaView, shop: shopView, missions: missionsView
  };

  const ACTIONS = {
    close: closeModal,
    closeGacha() { closeModal(); go('gacha'); },
    notices: noticesModal,
    presents: presentsModal,
    help: helpModal,
    hall(el) { go('machines', el.dataset.id); },
    play() { enterHall(pendingHall); },
    lever,
    stop(el) { pressStop(Number(el.dataset.reel)); },
    auto: toggleAuto,
    settle,
    settleOk,
    editName() {
      const v = prompt('名前（12文字まで）', S.name);
      if (v && v.trim()) { S.name = v.trim().slice(0, 12); save(); go('mypage'); }
    },
    editBio() {
      const v = prompt('ひとこと（60文字まで）', S.bio);
      if (v !== null) { S.bio = v.slice(0, 60); save(); go('mypage'); }
    },
    pickIcon: pickIconModal,
    pickTitle: pickTitleModal,
    setIcon(el) { S.icon = el.dataset.id; save(); closeModal(); go('mypage'); },
    setTitle(el) { S.title = el.dataset.id || null; save(); closeModal(); go('mypage'); },
    reset() {
      if (confirm('セーブデータをすべて消して最初からやり直しますか？')) {
        try { localStorage.removeItem(KEY); } catch (e) { /* noop */ }
        S = defaults();
        rollDay();
        go('home');
      }
    },
    useItem(el) { useItem(el.dataset.id); },
    pull(el) { pull(Number(el.dataset.n), el.dataset.pay); },
    exchange() {
      if (S.stars < 1) return;
      S.stars -= 1; S.coins += 500; save(); updateTop(); toast('500コインに交換しました');
    },
    buy(el) {
      const d = ITEM_DEFS[el.dataset.id];
      if (S.coins < d.coins) { toast('コインが足りません'); return; }
      S.coins -= d.coins;
      S.items[el.dataset.id] = (S.items[el.dataset.id] || 0) + 1;
      save(); updateTop(); toast(d.name + 'を購入しました');
    },
    claim(el) {
      const m = E.MISSIONS.find((x) => x.id === el.dataset.id);
      if (!m || S.missions.claimed[m.id]) return;
      S.missions.claimed[m.id] = 1;
      giveReward(m.reward);
      save(); toast('報酬を受け取りました'); go('missions');
    },
    takePresent(el) {
      const p = S.presents.splice(Number(el.dataset.i), 1)[0];
      if (p) giveReward(p);
      save(); updateTop(); presentsModal();
    },
    takeAll() {
      S.presents.splice(0).forEach(giveReward);
      save(); updateTop(); closeModal(); toast('すべて受け取りました');
      if (current === 'home') go('home');
    }
  };

  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-act], [data-go], [data-nav]');
    if (!el) {
      if (ev.target.id === 'modal') closeModal();
      return;
    }
    if (el.dataset.nav) {
      if (game && !confirm('遊技を中断しますか？（精算されません）')) return;
      go(el.dataset.nav);
    } else if (el.dataset.go) {
      go(el.dataset.go);
    } else if (ACTIONS[el.dataset.act]) {
      ACTIONS[el.dataset.act](el);
    }
  });

  rollDay();
  go('home');
  setInterval(updateTop, 1000);
  window.addEventListener('pagehide', save);

  // 動作確認用（開発時のみ参照）
  window.__slotgame = { state: () => S, game: () => game };
})();
