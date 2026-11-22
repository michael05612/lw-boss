(function () {
  const { MIN, HOUR } = Engine;
  const $ = sel => document.querySelector(sel);
  const WD = ['日', '一', '二', '三', '四', '五', '六'];
  const DEDUPE_MS = 3 * MIN;

  Store.load();
  const nowT = () => Store.now();   // 雲端模式＝伺服器時間（每支手機時鐘不準也沒關係）
  let view = null;           // 最近一次 compute 結果
  let lastSig = '';
  let sheetBossId = null;
  const openGroups = new Set(['hot-4']);
  const notified = new Set();

  // ── 工具 ──────────────────────────────────────────
  const pad = n => String(n).padStart(2, '0');
  const hm = t => { const d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const hms = t => { const d = new Date(t); return hm(t) + ':' + pad(d.getSeconds()); };
  const md = t => { const d = new Date(t); return (d.getMonth() + 1) + '/' + d.getDate() + '(' + WD[d.getDay()] + ')'; };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function countdown(t, now) {
    const diff = t - now;
    const a = Math.abs(diff);
    const h = Math.floor(a / HOUR), m = Math.floor((a % HOUR) / MIN), s = Math.floor((a % MIN) / 1000);
    const txt = h ? `${h}時${pad(m)}分` : `${m}分${pad(s)}秒`;
    return diff >= 0 ? txt : '已過 ' + txt;
  }

  function statusText(st) {
    switch (st.status) {
      case 'unset': return '未設定重生間隔';
      case 'unknown': return '本週尚無紀錄';
      case 'alive': return `在場（${hm(st.last.t)} 回報）`;
      case 'due': return `應出現 ${hm(st.nextT)}`;
      case 'presumed': return `推定 ${hm(st.nextT)}${st.inGrace ? ' 應出現' : ''} · 輪空${st.skips}`;
      case 'waiting':
        return `${hm(st.nextT)} 重生` + (st.source === 'seed' || st.source === 'learned' ? '（開機預測）' : '');
    }
    return '';
  }

  function stClass(st, now) {
    if (st.status === 'alive') return 'alive';
    if (st.status === 'due' || st.inGrace) return 'due';
    if (st.status === 'presumed') return 'presumed';
    if (st.nextT && st.nextT - now <= 15 * MIN) return 'soon';
    return '';
  }

  // ── 紀錄動作 ───────────────────────────────────────
  function nick() { return Engine.settings(Store.state).nickname || ''; }
  function bossById(id) { return Engine.bosses(Store.state).find(b => b.id === id); }

  function addKill(bossId, t) {
    const dup = Store.state.records.find(r => r.bossId === bossId && r.type === 'kill' && Math.abs(r.t - t) < DEDUPE_MS);
    if (dup) { toast(`${bossById(bossId).label} 已在 ${hm(dup.t)} 記錄過`, null); return; }
    const r = Store.addRecord({ bossId, type: 'kill', t, by: nick() });
    if (!r) return;
    const day = new Date(t).toDateString() === new Date(nowT()).toDateString() ? '' : md(t) + ' ';
    toast(`${bossById(bossId).label} 擊殺 ${day}${hm(t)}`, () => Store.removeRecord(r.id));
  }

  // ── toast + 復原（undo 是一個函式）──────────────────
  let toastTimer = null, toastUndo = null;
  function toast(msg, undo) {
    $('#toastMsg').textContent = msg;
    toastUndo = undo || null;
    $('#toastUndo').hidden = !undo;
    $('#toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('#toast').hidden = true; }, undo ? 10000 : 3000);
  }
  $('#toastUndo').onclick = () => {
    if (toastUndo) toastUndo();
    toastUndo = null;
    $('#toast').hidden = true;
  };

  // 每週重置由引擎自動算（Engine.bootList），不用寫入資料
  Store.onError(msg => toast(msg, null));

  // ── 繪製 ───────────────────────────────────────────
  function signature(v) {
    const m = Math.floor(v.now / MIN);
    return [m, v.s.eventOn, v.boot,
      v.statuses.map(st => st.boss.id + st.status + st.nextT + st.skips).join('|'),
      v.timeline.map(x => x.key).join('|'), Store.state.records.length, JSON.stringify(Store.info())].join('#');
  }

  function render(force) {
    const now = nowT();
    view = Engine.compute(Store.state, now);
    $('#clock').textContent = hms(now);
    const sig = signature(view) + $('#search').value;
    if (force || sig !== lastSig) {
      lastSig = sig;
      renderHeader();
      renderTimeline();
      renderHot();
      renderGroups();
      if (sheetBossId) renderSheet();
    }
    updateCountdowns(now);
    checkNotify(now);
  }

  function renderHeader() {
    const s = view.s;
    $('#eventBtn').setAttribute('aria-pressed', s.eventOn);
    $('#eventLabel').textContent = s.eventOn ? '減半活動：開' : '減半活動：關';
    $('#crossBtn').setAttribute('aria-pressed', !!s.showCross);
    $('#crossLabel').textContent = s.showCross ? '跨服：開' : '跨服：關';
    $('#bootInfo').textContent = `本週開機 ${md(view.boot)} ${hm(view.boot)}`;
    $('#horizonLabel').textContent = s.timelineCount;
    $('#dataVer').textContent = window.LW_DATA_VERSION + '／網站 ' + window.LW_APP_VERSION;
    const info = Store.info();
    const sync = {
      local: ['單機模式', ''],
      connecting: ['連線中…', 'wait'],
      noroom: ['未加入公會', 'off'],
      denied: ['連線失敗', 'off'],
      cloud: info.online ? ['● 已同步', 'on'] : ['○ 離線（恢復後自動上傳）', 'off'],
    }[info.mode];
    $('#syncInfo').textContent = sync[0] + (info.mode === 'cloud' && info.isAdmin ? '・管理員' : '');
    $('#syncInfo').className = 'sync ' + sync[1];
  }

  function renderTimeline() {
    const now = view.now;
    const mode = Store.info().mode;
    if (mode === 'connecting') { $('#timeline').innerHTML = '<li class="empty">正在讀取公會資料…</li>'; return; }
    if (mode === 'noroom' || mode === 'denied') {
      $('#timeline').innerHTML = `<li class="empty">${mode === 'noroom' ? '請用公會管理員給的連結開啟這個網站。' : '連不上公會資料，請確認網路或連結是否正確。'}</li>`;
      return;
    }
    if (!view.timeline.length) {
      $('#timeline').innerHTML = `<li class="empty">目前沒有已知的王。按下方擊殺按鈕開始記錄。</li>`;
      return;
    }
    const today = new Date(now).toDateString();
    let lastDay = today;
    $('#timeline').innerHTML = view.timeline.map(it => {
      const day = new Date(it.t).toDateString();
      let divider = '';
      if (it.kind !== 'alive' && day !== lastDay) {
        lastDay = day;
        const tomorrow = new Date(now + 24 * HOUR).toDateString() === day;
        divider = `<li class="tl-day">${tomorrow ? '明天' : ''} ${md(it.t)}</li>`;
      }
      return divider + timelineRow(it, now);
    }).join('');
  }

  function timelineRow(it, now) {
    {
      if (it.kind === 'fixed') {
        const live = now >= it.t && now <= it.end;
        const win = it.windowMin ? `～${hm(it.end)}` : '';
        return `<li class="tl ${live ? 'due' : (it.t - now <= 15 * MIN ? 'soon' : '')}">
          <span class="t">${hm(it.t)}</span>
          <span class="name">${esc(it.name)}${it.cat === 'cross' ? '<span class="tag arena">跨服</span>' : '<span class="tag fixed">固定</span>'}${win ? `<span class="tag fixed">${win}</span>` : ''}</span>
          <span class="cd">${live ? '進行中' : `<span data-cd="${it.t}"></span>`}</span></li>`;
      }
      const st = it.st;
      const cls = stClass(st, now);
      let tags = '';
      if (st.status === 'alive') tags += '<span class="tag alive">在場</span>';
      if (st.status === 'due' || st.inGrace) tags += '<span class="tag due">應出現</span>';
      if (st.status === 'presumed') tags += `<span class="tag presumed">推定輪空×${st.skips}</span>`;
      if (st.source === 'seed' || st.source === 'learned') tags += '<span class="tag pred">開機預測</span>';
      if (view.s.eventOn && st.boss.event) tags += '<span class="tag ev">加快</span>';
      const cd = st.status === 'alive'
        ? `回報後 <span data-cd="${st.last.t}" data-mode="since"></span>`
        : `<span data-cd="${it.t}"></span>`;
      return `<li class="tl ${cls}" data-open="${st.boss.id}" role="button" tabindex="0">
        <span class="t">${hm(it.t)}</span>
        <span class="name">${esc(st.boss.label)}${tags}</span>
        <span class="cd">${cd}</span></li>`;
    }
  }

  function killButton(st) {
    const cls = stClass(st, view.now);
    return `<div class="kbtn ${cls}">
      <button class="main" data-kill="${st.boss.id}" title="以現在時間記錄擊殺">
        <b>${esc(st.boss.label)}</b><small>${esc(statusText(st))}</small>
      </button>
      <button class="more" data-open="${st.boss.id}" aria-label="${esc(st.boss.label)} 補登記">⋯</button>
    </div>`;
  }

  function renderHot() {
    $('#hot').innerHTML = view.hot.length ? view.hot.map(killButton).join('') : '<div class="empty">沒有可按的王</div>';
  }

  function renderGroups() {
    const q = $('#search').value.trim().toLowerCase();
    const all = Engine.bosses(Store.state);
    const stMap = new Map(view.statuses.map(st => [st.boss.id, st]));
    const match = b => !q || [b.name, b.nick, b.full].concat(b.alias || []).some(a => a && a.toLowerCase().includes(q));
    const groups = new Map();
    all.filter(b => b.enabled !== false && match(b)).forEach(b => {
      const k = b.hours ? 'hot-' + b.hours : 'unset';
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(stMap.get(b.id));
    });
    const keys = [...groups.keys()].sort((a, b) => (parseFloat(b.slice(4)) || 0) - (parseFloat(a.slice(4)) || 0));
    if (!keys.length) { $('#groups').innerHTML = '<div class="empty">找不到符合的王</div>'; return; }
    $('#groups').innerHTML = keys.map(k => {
      const list = groups.get(k).filter(Boolean).sort((a, b) => (a.nextT || Infinity) - (b.nextT || Infinity));
      const h = k === 'unset' ? '未設定間隔' : `${k.slice(4)} 小時`;
      const open = q || openGroups.has(k) ? 'open' : '';
      return `<details class="group" data-group="${k}" ${open}>
        <summary>${h}（${list.length}）</summary>
        ${list.map(st => `<div class="row">
          <div class="info"><b>${esc(st.boss.label)}</b>${view.s.eventOn && st.boss.event ? '<span class="tag ev">加快</span>' : ''}
            <small>${esc(statusText(st))}${st.nextT ? ' · <span data-cd="' + st.nextT + '"></span>' : ''}${st.boss.region ? ' · ' + esc(st.boss.region) : ''}</small></div>
          <button class="btn sm primary" data-kill="${st.boss.id}" ${st.status === 'unset' ? 'disabled' : ''}>擊殺</button>
          <button class="btn sm" data-open="${st.boss.id}" aria-label="${esc(st.boss.label)} 補登記">⋯</button>
        </div>`).join('')}
      </details>`;
    }).join('');
  }

  function updateCountdowns(now) {
    document.querySelectorAll('[data-cd]').forEach(el => {
      const t = Number(el.dataset.cd);
      if (el.dataset.mode === 'since') {
        const m = Math.floor((now - t) / MIN);
        el.textContent = m + ' 分';
      } else el.textContent = countdown(t, now);
    });
  }

  // ── 事件委派 ───────────────────────────────────────
  document.addEventListener('click', e => {
    const kill = e.target.closest('[data-kill]');
    if (kill && !kill.disabled) { addKill(kill.dataset.kill, nowT()); return; }
    const open = e.target.closest('[data-open]');
    if (open) { openSheet(open.dataset.open); return; }
  });
  document.addEventListener('toggle', e => {
    const g = e.target.closest && e.target.closest('details.group');
    if (!g || $('#search').value) return;
    g.open ? openGroups.add(g.dataset.group) : openGroups.delete(g.dataset.group);
  }, true);
  $('#search').addEventListener('input', () => render(true));

  $('#eventBtn').onclick = () => {
    const on = !Engine.settings(Store.state).eventOn;
    const cloud = Store.info().mode !== 'local';
    if (!confirm(on ? `開啟減半活動？${cloud ? '（全公會都會一起切換）' : ''}` : `關閉減半活動？${cloud ? '（全公會都會一起切換）' : ''}`)) return;
    Store.setSetting('eventOn', on);
    toast(on ? '已開啟減半活動：標記「加快」的王重生時間 ÷2' : '已關閉減半活動', null);
  };
  $('#crossBtn').onclick = () => {
    const on = !Engine.settings(Store.state).showCross;
    Store.setSetting('showCross', on);   // 個人設定，只影響自己
    toast(on ? '顯示服內王＋跨服王' : '只顯示服內王', null);
  };

  // ── 臨時維修重置 ───────────────────────────────────
  function maintHTML() {
    const now = new Date(nowT());
    const opt = (n, sel) => Array.from({ length: n }, (_, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${pad(i)}</option>`).join('');
    return `
      <p>伺服器臨時維修重開後，所有死後計時王的時間都會重來。按下重置後：</p>
      <ul class="muted">
        <li>重開時間之前的擊殺紀錄不再用來推算（仍保留在「紀錄」裡，可看統計）</li>
        <li>王表回到「本週尚無紀錄」，開機預測會從重開時間重新算</li>
        <li>按錯可以在 10 秒內復原</li>
      </ul>
      <div class="backfill">
        <div class="bf-head"><b>伺服器重開時間</b><span>維修結束、可以登入的大約時間</span></div>
        <div class="bf-time">
          <select id="mtDay" aria-label="日期"><option value="0">今天</option><option value="-1">昨天</option></select>
          <select id="mtH" aria-label="時">${opt(24, now.getHours())}</select><span class="colon">:</span><select id="mtM" aria-label="分">${opt(60, now.getMinutes())}</select>
        </div>
        <button class="btn primary big" id="mtGo">確認重置</button>
      </div>`;
  }
  $('#maintBtn').onclick = () => openModal('臨時維修重置', maintHTML(), root => {
    root.querySelector('#mtGo').onclick = () => {
      const d = new Date(nowT());
      const t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + Number(root.querySelector('#mtDay').value),
        Number(root.querySelector('#mtH').value), Number(root.querySelector('#mtM').value)).getTime();
      if (t > nowT()) { toast('重開時間不能晚於現在', null); return; }
      if (Store.info().mode !== 'local' && !confirm('全公會的王表都會一起重置，確定伺服器剛維修重開？')) return;
      Store.addBoot(t, nick());
      closeModal();
      toast(`已重置，伺服器重開 ${md(t)} ${hm(t)}`, () => Store.removeBoot(t));
    };
  });

  // ── 單一王操作 ─────────────────────────────────────
  // 補登記：時/分下拉固定 24 小時制
  $('#bfH').innerHTML = Array.from({ length: 24 }, (_, i) => `<option value="${i}">${pad(i)}</option>`).join('');
  $('#bfM').innerHTML = Array.from({ length: 60 }, (_, i) => `<option value="${i}">${pad(i)}</option>`).join('');

  function setBfTime(t) {
    const d = new Date(t), today = new Date(nowT());
    const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    $('#bfDay').value = t < startToday ? '-1' : '0';
    $('#bfH').value = d.getHours();
    $('#bfM').value = d.getMinutes();
  }
  function getBfTime() {
    const now = new Date(nowT());
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + Number($('#bfDay').value),
      Number($('#bfH').value), Number($('#bfM').value)).getTime();
  }
  function sheetStatus() { return view.statuses.find(x => x.boss.id === sheetBossId); }

  function buildChips(st) {
    const now = nowT();
    const chips = [];
    const spawn = Engine.lastExpectedSpawn(st);
    if (spawn && spawn <= now) chips.push({ label: `預定出生 ${hm(spawn)}`, t: spawn, cls: 'spawn' });
    [[10, '10分前'], [30, '30分前'], [60, '1小時前'], [120, '2小時前'], [180, '3小時前']]
      .forEach(([m, label]) => chips.push({ label, t: Math.floor((now - m * MIN) / MIN) * MIN }));
    $('#bfChips').innerHTML = chips.map((c, i) =>
      `<button class="bf-chip ${c.cls || ''}" data-t="${c.t}" aria-pressed="${i === 0}">${c.label}</button>`).join('');
    setBfTime(chips[0].t);
  }

  function renderBfPreview() {
    const st = sheetStatus(); if (!st) return;
    const now = nowT(), t = getBfTime();
    const dayTxt = x => new Date(x).toDateString() === new Date(now).toDateString() ? '' : md(x) + ' ';
    if (t > now) {
      $('#bfPreview').innerHTML = '<span class="warn">這個時間還沒到，請選過去的時間。</span>';
      $('#bfSave').disabled = true; return;
    }
    if (!st.I) { $('#bfPreview').textContent = '這隻王還沒設定重生間隔。'; $('#bfSave').disabled = true; return; }
    $('#bfSave').disabled = false;
    let next = t + st.I, extra = '';
    if (next + st.G < now) {
      const k = Math.ceil((now - st.G - next) / st.I);
      extra = `<br>（原本 ${dayTxt(next)}${hm(next)} 重生已過、沒人回報，系統推定下次 <b>${dayTxt(next + k * st.I)}${hm(next + k * st.I)}</b>）`;
      next = null;
    }
    $('#bfPreview').innerHTML = `${dayTxt(t)}${hm(t)} 死亡` +
      (next ? ` → 下次重生 <b>${dayTxt(next)}${hm(next)}</b>（${countdown(next, now)}後）` : '') + extra;
  }

  function openSheet(id) {
    sheetBossId = id;
    const st = sheetStatus();
    if (st) buildChips(st);
    renderSheet();
    $('#sheetBackdrop').hidden = false;
  }
  function closeSheet() { sheetBossId = null; $('#sheetBackdrop').hidden = true; }
  function renderSheet() {
    const st = sheetStatus();
    if (!st) { closeSheet(); return; }
    const b = st.boss;
    $('#sheetTitle').textContent = b.label;
    const iv = st.I ? `每 ${st.I / HOUR} 小時${view.s.eventOn && b.event ? '（活動加快）' : ''}` : '未設定間隔';
    const last = st.last ? `；最後紀錄 ${md(st.last.t)} ${hm(st.last.t)} 擊殺${st.last.by ? '（' + st.last.by + '）' : ''}` : '';
    const full = b.full ? b.full + '｜' : '';
    $('#sheetSub').textContent = `${full}${statusText(st)}｜${iv}${b.region ? '｜' + b.region : ''}${last}`;
    $('#sheetKillNow').disabled = st.status === 'unset';
    renderBfPreview();
  }
  $('#sheetKillNow').onclick = () => { addKill(sheetBossId, nowT()); closeSheet(); };
  $('#bfChips').addEventListener('click', e => {
    const c = e.target.closest('.bf-chip'); if (!c) return;
    document.querySelectorAll('.bf-chip').forEach(x => x.setAttribute('aria-pressed', x === c));
    setBfTime(Number(c.dataset.t));
    renderBfPreview();
  });
  ['#bfDay', '#bfH', '#bfM'].forEach(s => $(s).addEventListener('change', () => {
    document.querySelectorAll('.bf-chip').forEach(x => x.setAttribute('aria-pressed', 'false'));
    renderBfPreview();
  }));
  $('#bfSave').onclick = () => {
    const t = getBfTime();
    if (t > nowT()) return;
    addKill(sheetBossId, t); closeSheet();
  };
  $('#sheetBackdrop').addEventListener('click', e => {
    if (e.target === e.currentTarget || e.target.closest('[data-close]')) closeSheet();
  });

  // ── 提醒（聲音＋系統通知）────────────────────────────
  let audioCtx = null;
  document.addEventListener('pointerdown', () => {
    if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } }
  }, { once: true });
  function beep() {
    if (!audioCtx) return;
    [0, 0.25].forEach(off => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
      const t0 = audioCtx.currentTime + off;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
      o.start(t0); o.stop(t0 + 0.22);
    });
  }
  function checkNotify(now) {
    const s = view.s;
    if (!s.notify) return;
    const lead = s.notifyLeadMin * MIN;
    view.timeline.forEach(it => {
      if (it.kind === 'alive') return;
      const key = it.key;
      if (notified.has(key)) return;
      const diff = it.t - now;
      if (diff > 0 && diff <= lead) {
        notified.add(key);
        const name = it.kind === 'fixed' ? it.name : it.st.boss.label;
        const msg = `${name} ${hm(it.t)} 出現（${Math.ceil(diff / MIN)} 分後）`;
        if (s.sound) beep();
        if ('Notification' in window && Notification.permission === 'granted') {
          try { new Notification('天堂W 王表', { body: msg, tag: key }); } catch (e) { }
        }
        toast('⏰ ' + msg, null);
      }
    });
  }

  // ── 設定 / 紀錄 視窗 ───────────────────────────────
  function openModal(title, html, bind) {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = html;
    $('#modalBackdrop').hidden = false;
    bind && bind($('#modalBody'));
  }
  function closeModal() { $('#modalBackdrop').hidden = true; render(true); }
  $('#modalBackdrop').addEventListener('click', e => {
    if (e.target === e.currentTarget || e.target.closest('[data-close]')) closeModal();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeSheet(); if (!$('#modalBackdrop').hidden) closeModal(); } });

  const toLocalInput = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${hm(t)}`; };
  const daysText = days => days.length === 7 ? '每天' : days.map(d => WD[d]).join('');
  const parseDays = txt => txt.includes('每天') ? [0, 1, 2, 3, 4, 5, 6] : WD.map((w, i) => txt.includes(w) ? i : -1).filter(i => i >= 0);

  function settingsHTML() {
    const s = Engine.settings(Store.state);
    const boot = Engine.currentBoot(nowT(), Store.state, s);
    const bosses = Engine.bosses(Store.state);
    const fixed = Engine.fixed(Store.state);
    const info = Store.info();
    const ro = Store.canEditShared() ? '' : 'disabled';
    const roNote = ro ? '<p class="muted">🔒 這一區是全公會共用的設定，只有管理員能修改。</p>' : '';
    return `
      ${syncHTML(info)}
      <h4>個人設定（只影響自己這台）</h4>
      <div class="form-grid">
        <label for="s-nick">暱稱</label><input id="s-nick" data-s="nickname" value="${esc(s.nickname)}" maxlength="20" placeholder="記錄是誰按的">
        <label for="s-hz">主畫面顯示</label><div>接下來 <input id="s-hz" type="number" min="5" max="50" data-s="timelineCount" data-num value="${s.timelineCount}" style="width:70px"> 隻王</div>
        <label for="s-hot">快速擊殺按鈕</label><div><input id="s-hot" type="number" min="2" max="20" data-s="hotCount" data-num value="${s.hotCount}" style="width:70px"> 個</div>
        <label for="s-nt">出王提醒</label><div><input id="s-nt" type="checkbox" data-s="notify" ${s.notify ? 'checked' : ''}>
          提前 <input type="number" min="1" max="60" data-s="notifyLeadMin" data-num value="${s.notifyLeadMin}" style="width:60px"> 分鐘
          <label><input type="checkbox" data-s="sound" ${s.sound ? 'checked' : ''}> 聲音</label>
          <button class="btn sm" id="s-perm">開啟系統通知</button>
          <div class="muted">提醒只在這個網頁開著時有效；手機鎖定螢幕或切到別的 App 可能不會響。</div></div>
        <label for="s-theme">外觀</label><div><select id="s-theme" data-s="theme">
          ${[['dark', '深色'], ['light', '淺色'], ['auto', '跟隨手機／電腦設定']].map(([v, n]) => `<option value="${v}" ${(s.theme || 'dark') === v ? 'selected' : ''}>${n}</option>`).join('')}
        </select></div>
        <label for="s-awake">保持螢幕開啟</label><div><input id="s-awake" type="checkbox" data-s="keepAwake" ${s.keepAwake ? 'checked' : ''}> 開著網頁時不讓手機自動鎖定（掛機盯王用）</div>
      </div>

      <h4>公會共用設定</h4>
      ${roNote}
      <div class="form-grid">
        <label for="s-wd">每週重置</label>
        <div><select id="s-wd" data-s="resetWeekday" data-num ${ro}>${WD.map((w, i) => `<option value="${i}" ${i === s.resetWeekday ? 'selected' : ''}>週${w}</option>`).join('')}</select>
          <input type="time" data-s="resetTime" value="${s.resetTime}" aria-label="重置時間" ${ro}></div>
        <label for="s-grace">推定輪空寬限</label><div><input id="s-grace" type="number" min="1" max="120" data-s="graceMin" data-num value="${s.graceMin}" style="width:70px" ${ro}> 分鐘（預測時間過後沒人回報 → 推到下一輪）</div>
      </div>

      <h4>本週開機時間</h4>
      <div class="form-grid">
        <label for="s-boot">開機時間</label><input id="s-boot" type="datetime-local" value="${toLocalInput(boot)}">
      </div>
      <div class="btn-row"><button class="btn warn" id="s-restart">伺服器重啟（設為現在）</button></div>
      <p class="muted">每週重置時間到了會自動清空死後計時王。臨時維修重開機時按「伺服器重啟」；若實際開機時間不同，直接改上面的時間。開機後的出生順序會依過去幾週的紀錄自動學習。</p>

      <h4>死後計時王</h4>
      ${roNote}
      <p class="muted">「活動」打勾＝「野外首領的逆襲」期間重生加快 2 倍（依官方 2026/10/14 名單）。「開機偏移」留空＝使用自動學習值。</p>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>顯示</th><th>王（本名）</th><th>暱稱</th><th>間隔(時)</th><th>寬限(分)</th><th>活動</th><th>開機偏移(分)</th></tr></thead>
        <tbody>${bosses.map(b => {
          const lo = Engine.learnedOffset(b.id, Store.state, boot);
          return `<tr data-boss="${b.id}">
            <td><input type="checkbox" data-b="enabled" ${b.enabled !== false ? 'checked' : ''} aria-label="顯示 ${esc(b.name)}" ${ro}></td>
            <td>${esc(b.name)}${b.full ? `<div class="muted">${esc(b.full)}</div>` : ''}</td>
            <td><input type="text" data-b="nick" value="${esc(b.nick || '')}" placeholder="無" style="width:70px" aria-label="${esc(b.name)} 暱稱" ${ro}></td>
            <td><input type="number" min="0" step="0.5" data-b="hours" value="${b.hours}" aria-label="${esc(b.name)} 間隔" ${ro}></td>
            <td><input type="number" min="1" data-b="graceMin" value="${b.graceMin != null ? b.graceMin : ''}" placeholder="${s.graceMin}" ${ro}></td>
            <td><input type="checkbox" data-b="event" ${b.event ? 'checked' : ''} aria-label="${esc(b.name)} 活動適用" ${ro}></td>
            <td><input type="number" data-b="bootOffset" value="${b.bootOffset != null ? b.bootOffset : ''}" placeholder="${lo ? '學習 ' + lo.minutes : ''}" ${ro}></td>
          </tr>`;
        }).join('')}</tbody></table></div>

      <h4>固定時刻王</h4>
      <p class="muted">星期填「每天」或「一二三四五」這種寫法；時間用逗號分隔（台灣時間）。分類設成「跨服」的王平常隱藏，打開主畫面上方的「跨服」開關才顯示。</p>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>顯示</th><th>名稱</th><th>分類</th><th>星期</th><th>時間</th></tr></thead>
        <tbody>${fixed.map(f => `<tr data-fixed="${f.id}">
          <td><input type="checkbox" data-f="enabled" ${f.enabled !== false ? 'checked' : ''} aria-label="顯示 ${esc(f.name)}" ${ro}></td>
          <td>${esc(f.name)}</td>
          <td><select data-f="cat" aria-label="${esc(f.name)} 分類" ${ro}>${[['server', '服內'], ['cross', '跨服']]
            .map(([v, l]) => `<option value="${v}" ${((f.cat && f.cat !== 'server') ? 'cross' : 'server') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
          <td><input type="text" data-f="days" value="${daysText(f.days)}" style="width:90px" ${ro}></td>
          <td><input type="text" data-f="times" value="${f.times.length > 6 ? '多個時段' : f.times.join(',')}" ${f.times.length > 6 || ro ? 'disabled' : ''}></td>
        </tr>`).join('')}</tbody></table></div>

      <h4>資料</h4>
      <div class="btn-row">
        <button class="btn" id="s-export">匯出備份</button>
        ${info.mode === 'local' ? '<label class="btn">匯入備份<input type="file" id="s-import" accept="application/json" hidden></label>' : ''}
        <button class="btn" id="s-resetcfg" ${ro}>王表設定還原預設</button>
        <button class="btn danger" id="s-clear" ${ro}>清除全部資料</button>
      </div>`;
  }

  // 雲端同步區塊
  function syncHTML(info) {
    if (info.mode === 'local') {
      return `<h4>雲端同步</h4><p class="muted">目前是<b>單機模式</b>：資料只存在這台裝置。${info.cloudConfigured ? '' : '要全公會共用，請照「上線步驟.md」設定 Firebase。'}</p>`;
    }
    if (info.mode === 'noroom') {
      return `<h4>雲端同步</h4>
        <p>這台裝置還沒加入公會。請打開管理員給你的連結。</p>
        <p class="muted">如果你是第一次架設的管理員，按下面建立公會房間。</p>
        <div class="btn-row"><button class="btn primary" id="s-create">建立公會房間（管理員）</button></div>`;
    }
    if (info.mode !== 'cloud') return `<h4>雲端同步</h4><p class="muted">${info.mode === 'connecting' ? '連線中…' : '連線失敗，請確認網路或連結。'}</p>`;
    return `<h4>雲端同步</h4>
      <p>${info.online ? '● 已連線，資料即時同步' : '○ 目前離線：按的擊殺會先存在手機，恢復網路後自動上傳'}｜身分：${info.isAdmin ? '<b>管理員</b>' : '成員'}</p>
      <div class="form-grid">
        <label>成員連結</label><div><input readonly value="${esc(Store.memberLink())}" onclick="this.select()"> <button class="btn sm" data-copy="member">複製</button></div>
        ${info.isAdmin ? '<label>管理員連結</label><div><button class="btn sm" data-copy="admin">複製管理員連結</button><div class="muted">⚠ 只給要管理王表的人。拿到的人可以改王表設定、清除資料。</div></div>' : ''}
      </div>`;
  }

  async function copyText(txt) {
    try { await navigator.clipboard.writeText(txt); toast('已複製連結', null); }
    catch (e) { prompt('複製下面的連結：', txt); }
  }

  function bindSettings(root) {
    root.querySelectorAll('[data-s]').forEach(el => el.addEventListener('change', () => {
      const k = el.dataset.s;
      Store.setSetting(k, el.type === 'checkbox' ? el.checked : ('num' in el.dataset ? Number(el.value) : el.value.trim()));
      if (k === 'keepAwake') applyWakeLock();
      if (k === 'theme') applyTheme();
    }));
    root.querySelectorAll('[data-copy]').forEach(b => b.onclick = async () => {
      copyText(b.dataset.copy === 'admin' ? await Store.adminLink() : Store.memberLink());
    });
    const create = root.querySelector('#s-create');
    if (create) create.onclick = async () => {
      if (!confirm('建立一個新的公會房間？你會成為管理員。')) return;
      try {
        const { key } = await Store.createRoom();
        const admin = Store.memberLink() + '&k=' + key;
        openModal('公會房間已建立', `
          <p><b>成員連結</b>（貼到公會群組給大家）：</p>
          <div class="btn-row"><input readonly value="${esc(Store.memberLink())}" onclick="this.select()"><button class="btn sm" data-copy="member">複製</button></div>
          <p><b>管理員連結</b>（自己收好，換手機時用這個找回管理員身分）：</p>
          <div class="btn-row"><input readonly value="${esc(admin)}" onclick="this.select()"><button class="btn sm" data-copy="admin">複製</button></div>
          <p class="muted">⚠ 管理員連結不要貼到群組。拿到的人可以改王表設定、清除資料。</p>`, bindSettings);
      } catch (e) { toast('建立失敗：' + e.message, null); }
    };
    root.querySelector('#s-perm').onclick = async () => {
      if (!('Notification' in window)) return toast('此瀏覽器不支援系統通知', null);
      const p = await Notification.requestPermission();
      toast(p === 'granted' ? '系統通知已開啟' : '未取得通知權限', null);
    };
    root.querySelector('#s-boot').addEventListener('change', e => {
      const t = new Date(e.target.value).getTime();
      if (!t) return;
      if (t > nowT()) { toast('開機時間不能晚於現在', null); return; }
      const cur = Engine.currentBoot(nowT(), Store.state, Engine.settings(Store.state));
      Store.removeBoot(cur);
      Store.addBoot(t, nick());
      toast('開機時間已更新為 ' + md(t) + ' ' + hm(t), null);
    });
    root.querySelector('#s-restart').onclick = () => {
      if (!confirm('確定伺服器剛重啟？本次開機前的死後計時王紀錄將不再採用。')) return;
      const t = Math.floor(nowT() / MIN) * MIN;
      Store.addBoot(t, nick());
      root.querySelector('#s-boot').value = toLocalInput(t);
      toast('已記錄伺服器重啟 ' + hm(t), null);
    };
    root.querySelectorAll('tr[data-boss] input').forEach(el => el.addEventListener('change', () => {
      const id = el.closest('tr').dataset.boss, k = el.dataset.b;
      let v;
      if (el.type === 'checkbox') v = el.checked;
      else if (el.type === 'text') v = el.value.trim();   // 暱稱：空字串＝不顯示括號
      else v = el.value === '' ? undefined : Number(el.value);
      Store.setOverride('bossOverrides', id, k, v);
    }));
    root.querySelectorAll('tr[data-fixed] input, tr[data-fixed] select').forEach(el => el.addEventListener('change', () => {
      const id = el.closest('tr').dataset.fixed, k = el.dataset.f;
      let v;
      if (k === 'enabled') v = el.checked;
      if (k === 'cat') v = el.value;
      if (k === 'days') v = parseDays(el.value);
      if (k === 'times') v = el.value.split(/[,，\s]+/).filter(x => /^\d{1,2}:\d{2}$/.test(x)).map(x => x.padStart(5, '0'));
      Store.setOverride('fixedOverrides', id, k, v);
    }));
    root.querySelector('#s-export').onclick = () => {
      const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `lw-boss-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click(); URL.revokeObjectURL(a.href);
    };
    const imp = root.querySelector('#s-import');
    if (imp) imp.onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try { Store.importJSON(await f.text()); toast('匯入完成', null); closeModal(); }
      catch (err) { toast('匯入失敗：' + err.message, null); }
    };
    root.querySelector('#s-resetcfg').onclick = () => {
      if (!confirm('把所有王的間隔、活動、顯示設定還原成預設？（擊殺紀錄保留）')) return;
      Store.resetOverrides();
      setTimeout(() => openModal('設定', settingsHTML(), bindSettings), 300);
    };
    root.querySelector('#s-clear').onclick = () => {
      const cloud = Store.info().mode !== 'local';
      if (!confirm(`清除全部資料（含擊殺紀錄與設定）${cloud ? '，全公會的資料都會被清掉' : ''}，無法復原。確定？`)) return;
      if (cloud && prompt('請輸入「清除」兩個字確認') !== '清除') return;
      Store.clearAll(); closeModal();
    };
  }

  // ── 外觀（深色／淺色）──────────────────────────────
  // index.html 開頭有一小段先套用，避免打開時先閃一下白色
  function applyTheme() {
    const t = Engine.settings(Store.state).theme || 'dark';
    if (t === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
  }

  // ── 保持螢幕開啟 ───────────────────────────────────
  let wakeLock = null;
  async function applyWakeLock() {
    const want = Engine.settings(Store.state).keepAwake && document.visibilityState === 'visible';
    try {
      if (want && !wakeLock && navigator.wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } else if (!want && wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch (e) { wakeLock = null; }
  }

  // ── 新版本提示：定期檢查 js/version.js，不同就顯示更新列 ─────
  async function checkVersion() {
    if (location.protocol === 'file:') return;
    try {
      const txt = await (await fetch('js/version.js?t=' + Date.now(), { cache: 'no-store' })).text();
      const m = txt.match(/LW_APP_VERSION\s*=\s*'([^']+)'/);
      if (m && m[1] !== window.LW_APP_VERSION) $('#updateBar').hidden = false;
    } catch (e) { }
  }
  $('#updateBar').onclick = () => location.reload();
  document.addEventListener('visibilitychange', () => {
    applyWakeLock();
    if (document.visibilityState === 'visible') { checkVersion(); render(true); }
  });

  // ── 第一次使用雲端：請輸入暱稱 ───────────────────────
  let askedNick = false;
  function askNickname() {
    const info = Store.info();
    if (askedNick || info.mode !== 'cloud' || nick()) return;
    askedNick = true;
    openModal('歡迎使用王表', `
      <p>請輸入你的遊戲暱稱，擊殺紀錄和統計會用這個名字。</p>
      <div class="btn-row"><input id="nk-in" maxlength="20" placeholder="遊戲暱稱"><button class="btn primary" id="nk-go">確定</button></div>
      <p class="muted">之後可以在 ⚙ 設定裡修改。</p>`, root => {
      const go = () => {
        const v = root.querySelector('#nk-in').value.trim();
        if (!v) return;
        Store.setSetting('nickname', v); closeModal();
      };
      root.querySelector('#nk-go').onclick = go;
      root.querySelector('#nk-in').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    });
  }

  $('#settingsBtn').onclick = () => openModal('設定', settingsHTML(), bindSettings);
  $('#bootInfo').onclick = () => openModal('設定', settingsHTML(), bindSettings);

  function historyHTML() {
    const names = new Map(Engine.bosses(Store.state).map(b => [b.id, b.label]));
    const boot = view.boot;
    const recs = Store.state.records.slice().sort((a, b) => b.t - a.t);
    // 統計：同一隻王 3 分鐘內多人同時按，只算最先按的人
    const week = [];
    recs.filter(r => r.t >= boot && r.type === 'kill').reverse().forEach(r => {
      if (!week.some(w => w.bossId === r.bossId && Math.abs(w.t - r.t) < DEDUPE_MS)) week.push(r);
    });
    const byPerson = {};
    week.forEach(r => { const k = r.by || '（未填暱稱）'; byPerson[k] = (byPerson[k] || 0) + 1; });
    const typeName = { kill: '擊殺', noshow: '輪空', alive: '在場' };
    return `
      <h4>本週擊殺統計（開機後 ${week.length} 筆）</h4>
      ${Object.keys(byPerson).length ? `<table class="tbl"><tbody>${Object.entries(byPerson).sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${v}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">本週尚無擊殺紀錄。</p>'}
      <h4>最近紀錄</h4>
      ${recs.length ? `<div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>時間</th><th>王</th><th>類型</th><th>回報者</th><th></th></tr></thead>
        <tbody>${recs.slice(0, 100).map(r => `<tr${r.t < boot ? ' style="opacity:.5"' : ''}>
          <td class="num">${md(r.t)} ${hm(r.t)}</td><td>${esc(names.get(r.bossId) || r.bossId)}</td>
          <td>${typeName[r.type]}${r.type === 'noshow' ? '（' + hm(r.spawnT) + '）' : ''}</td><td>${esc(r.by)}</td>
          <td>${Store.canDelete(r) ? `<button class="btn sm danger" data-del="${r.id}">刪除</button>` : ''}</td></tr>`).join('')}</tbody></table></div>
        ${Store.info().mode !== 'local' ? '<p class="muted">只能刪除自己按的紀錄；管理員可以刪除全部。</p>' : ''}
        <p class="muted">半透明＝本次開機前的紀錄（只用於統計與學習開機順序）。</p>` : '<p class="muted">尚無紀錄。</p>'}`;
  }
  $('#historyBtn').onclick = () => openModal('紀錄', historyHTML());
  $('#modalBody').addEventListener('click', e => {
    const d = e.target.closest('[data-del]');
    if (d && confirm('刪除這筆紀錄？')) { Store.removeRecord(d.dataset.del); openModal('紀錄', historyHTML()); }
  });

  // ── 啟動 ───────────────────────────────────────────
  Store.subscribe(() => { render(true); askNickname(); });
  render(true);
  applyTheme();
  applyWakeLock();
  setInterval(() => render(false), 1000);
  setInterval(checkVersion, 5 * MIN);
})();
