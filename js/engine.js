// 推算引擎：純計算，不寫入資料。
// 「推定輪空」由每台裝置各自計算，不寫進資料庫 → 多人同時開著也不會互相覆蓋。
(function () {
  const MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;

  function settings(state) {
    return Object.assign({}, window.LW_DEFAULT_SETTINGS, state.settings);
  }

  function bosses(state) {
    return window.LW_DEFAULT_BOSSES.map(b => {
      const o = state.bossOverrides[b.id] || {};
      const m = Object.assign({ enabled: true }, b, o);
      m.label = m.nick ? `${m.name}(${m.nick})` : m.name;
      return m;
    });
  }

  function fixed(state) {
    return window.LW_DEFAULT_FIXED.map(f => Object.assign({ enabled: true }, f, state.fixedOverrides[f.id] || {}));
  }

  function parseHM(hm) {
    const [h, m] = String(hm).split(':').map(Number);
    return { h: h || 0, m: m || 0 };
  }

  // 最近一次（≤ now）的每週重置時間
  function lastReset(now, s) {
    const d = new Date(now);
    const { h, m } = parseHM(s.resetTime);
    const back = (d.getDay() - s.resetWeekday + 7) % 7;
    const r = new Date(d.getFullYear(), d.getMonth(), d.getDate() - back, h, m, 0, 0).getTime();
    return r > now ? r - 7 * DAY : r;
  }

  // 所有開機時間 = 手動記錄的開機（臨時維修）＋ 每週重置（直接算出來，不寫進資料庫）
  // 每週重置前 3 小時～後 6 小時內若有手動開機（維修延長／提早），以手動的為準
  function bootList(state, s, now) {
    const stored = state.boots || [];
    const list = stored.slice();
    const lr = lastReset(now, s);
    for (let k = 0; k < 6; k++) {
      const r = lr - k * 7 * DAY;
      if (!stored.some(b => b >= r - 3 * HOUR && b <= r + 6 * HOUR)) list.push(r);
    }
    return [...new Set(list)].filter(b => b <= now).sort((a, b) => a - b);
  }

  // 目前有效的開機時間 = 最新且 ≤ now 的一筆
  function currentBoot(now, state, s) {
    const past = bootList(state, s, now);
    return past.length ? past[past.length - 1] : lastReset(now, s);
  }

  function intervalMs(boss, s) {
    if (!boss.hours) return 0;
    return boss.hours * HOUR / (s.eventOn && boss.event ? 2 : 1);
  }

  // 從過去幾次開機紀錄學習「開機後第幾分鐘出現」（取中位數）
  function learnedOffset(bossId, state, boot) {
    const all = bootList(state, settings(state), boot);
    const boots = all.filter(b => b < boot).slice(-4);
    const offs = [];
    boots.forEach(b => {
      const nextBoot = all.find(x => x > b) || boot;
      const end = Math.min(b + 16 * HOUR, nextBoot);
      const first = state.records
        .filter(r => r.bossId === bossId && r.type === 'kill' && r.t >= b && r.t < end)
        .sort((x, y) => x.t - y.t)[0];
      if (first) offs.push((first.t - b) / MIN);
    });
    if (!offs.length) return null;
    offs.sort((a, b) => a - b);
    const mid = Math.floor(offs.length / 2);
    const med = offs.length % 2 ? offs[mid] : (offs[mid - 1] + offs[mid]) / 2;
    return { minutes: Math.round(med), samples: offs.length };
  }

  // 單一死後計時王的狀態
  // status: unset | unknown | waiting | due | presumed | alive
  function bossStatus(boss, ctx) {
    const { now, boot, s, state } = ctx;
    const I = intervalMs(boss, s);
    const G = (boss.graceMin != null ? boss.graceMin : s.graceMin) * MIN;
    const res = { boss, I, G, status: 'unknown', nextT: null, skips: 0, source: null, last: null, inGrace: false, lowConf: false };
    if (!I) { res.status = 'unset'; return res; }

    const recs = state.records.filter(r => r.bossId === boss.id && r.t >= boot);
    const last = recs.sort((a, b) => a.t - b.t)[recs.length - 1] || null;
    res.last = last;

    let due;
    if (last && last.type === 'alive') {
      res.status = 'alive'; res.source = 'alive';
      return res;
    } else if (last && last.type === 'kill') {
      due = last.t + I; res.source = 'kill';
    } else if (last && last.type === 'noshow') {
      due = last.spawnT + I; res.source = 'noshow';
    } else {
      const learned = learnedOffset(boss.id, state, boot);
      const manual = boss.bootOffset;
      if (learned) { due = boot + learned.minutes * MIN; res.source = 'learned'; res.samples = learned.samples; }
      else if (manual != null && manual !== '') { due = boot + Number(manual) * MIN; res.source = 'seed'; res.lowConf = true; }
      else return res; // unknown：本週還沒有任何回報
    }

    if (now < due) { res.status = 'waiting'; res.nextT = due; }
    else if (now <= due + G) { res.status = 'due'; res.nextT = due; }
    else {
      const k = Math.ceil((now - G - due) / I);
      // 開機預測本身就是推測，連續推 2 輪以上沒人回報 → 不再可信，視為「尚無紀錄」
      if ((res.source === 'seed' || res.source === 'learned') && k > 2) {
        res.status = 'unknown'; res.source = null; return res;
      }
      res.status = 'presumed';
      res.skips = k;
      res.nextT = due + k * I;
      res.inGrace = now >= res.nextT;
      if (k >= 3) res.lowConf = true;
    }
    return res;
  }

  // 「沒出現」按下時，對應的是哪一次預定出生時間
  function lastExpectedSpawn(st) {
    if (st.status === 'due' || (st.status === 'presumed' && st.inGrace)) return st.nextT;
    if (st.status === 'presumed') return st.nextT - st.I;
    return null;
  }

  function fixedOccurrences(f, from, to) {
    const out = [];
    const base = new Date(from);
    for (let dayOff = -1; dayOff <= Math.ceil((to - from) / DAY) + 1; dayOff++) {
      const day = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayOff);
      if (!f.days.includes(day.getDay())) continue;
      f.times.forEach(hm => {
        const { h, m } = parseHM(hm);
        const t = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m).getTime();
        const end = f.windowMin ? t + f.windowMin * MIN : t + 5 * MIN;
        const note = f.dayNote && f.dayNote[day.getDay()];
        if (end >= from && t <= to) out.push({ t, end, windowMin: f.windowMin || 0, note });
      });
    }
    return out;
  }

  function compute(state, now) {
    const s = settings(state);
    const boot = currentBoot(now, state, s);
    const ctx = { now, boot, s, state };
    const list = bosses(state).filter(b => b.enabled !== false);
    const statuses = list.map(b => bossStatus(b, ctx));
    // 時間軸：接下來 N 隻王（固定王往後找 2 天）
    const horizon = now + 2 * DAY;
    const timeline = [];
    statuses.forEach(st => {
      if (st.status === 'alive') {
        timeline.push({ key: st.boss.id, kind: 'alive', name: st.boss.name, t: st.last.t, st });
      } else if (st.nextT != null && st.nextT >= now - st.G) {
        timeline.push({ key: st.boss.id + st.nextT, kind: 'boss', name: st.boss.name, t: st.nextT, st });
      }
    });
    const isCross = f => f.cat && f.cat !== 'server';
    const catOn = f => !isCross(f) || s.showCross;
    fixed(state).filter(f => f.enabled !== false && catOn(f)).forEach(f => {
      const occ = fixedOccurrences(f, now, horizon);
      // nextOnly：出現很頻繁的王（例：萊茵每 2 小時）只顯示下一場，避免佔滿列表
      (f.nextOnly ? occ.slice(0, 1) : occ).forEach(o => {
        const name = o.note ? (o.note.startsWith('＋') ? f.name + o.note : `${f.name} ${o.note}`) : f.name;
        timeline.push({ key: f.id + o.t, kind: 'fixed', cat: isCross(f) ? 'cross' : 'server', name, t: o.t, end: o.end, windowMin: o.windowMin });
      });
    });
    timeline.sort((a, b) => {
      if ((a.kind === 'alive') !== (b.kind === 'alive')) return a.kind === 'alive' ? -1 : 1;
      return a.t - b.t;
    });
    timeline.splice(s.timelineCount);

    // 快速擊殺區：最可能要按的王
    const rank = st => {
      if (st.status === 'alive') return 0;
      if (st.status === 'due' || st.inGrace) return 1;
      if (st.nextT != null && st.nextT - now <= 30 * MIN) return 2;
      if (st.nextT != null) return 3;
      return 4;
    };
    const hot = statuses.filter(st => st.status !== 'unset')
      .map(st => ({ st, r: rank(st) }))
      .sort((a, b) => a.r - b.r || (a.st.nextT || Infinity) - (b.st.nextT || Infinity))
      .slice(0, s.hotCount)
      .map(x => x.st);

    return { s, boot, statuses, timeline, hot, now };
  }

  window.Engine = { compute, settings, bosses, fixed, lastReset, currentBoot, bootList, intervalMs, lastExpectedSpawn, learnedOffset, fixedOccurrences, MIN, HOUR, DAY };
})();
