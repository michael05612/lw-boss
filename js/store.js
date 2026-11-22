// 儲存層：兩種模式，介面相同
//   單機模式：js/config.js 沒填 Firebase → 資料存在這台裝置的瀏覽器（localStorage）
//   雲端模式：有填 Firebase → 全公會共用同一份資料、即時同步
// 個人設定（暱稱、提醒、跨服開關…）永遠只存在自己的裝置。
// 紀錄採「只新增」：每次擊殺是一筆新資料，多人同時按也不會互相覆蓋。
(function () {
  const KEY = 'lw-boss-v1';           // 單機模式的全部資料
  const LOCAL_KEY = 'lw-boss-local';  // 雲端模式的個人設定
  const ROOM_KEY = 'lw-boss-room';    // 雲端模式記住的公會房間
  const MAX_RECORDS = 3000;
  const DAY = 86400000;
  const RECORD_DAYS = 35;             // 雲端只下載最近 35 天紀錄（夠學習 4 週開機順序，又省流量）
  const BOOT_DAYS = 70;
  // 全公會共用的設定；其他設定（暱稱、提醒、顯示數量…）是個人的
  const SHARED_SETTINGS = ['resetWeekday', 'resetTime', 'graceMin', 'eventOn'];
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';

  const cfg = window.LW_CONFIG || {};
  const cloudConfigured = !!(cfg.firebase && cfg.firebase.apiKey);
  const listeners = [], errorListeners = [];

  function empty() {
    return {
      settings: {},        // 覆寫 LW_DEFAULT_SETTINGS
      bossOverrides: {},   // { bossId: { hours, graceMin, event, enabled, bootOffset, nick } }
      fixedOverrides: {},  // { fixedId: { enabled, times, days, cat } }
      records: [],         // { id, bossId, type: 'kill', t, by, uid?, createdAt }
      boots: [],           // 手動記錄的開機時間（毫秒）；每週重置由引擎自動算
    };
  }

  let state = empty();
  // mode: local | connecting | noroom | denied | cloud
  let mode = cloudConfigured ? 'connecting' : 'local';
  let online = !cloudConfigured, isAdmin = !cloudConfigured;
  let serverOffset = 0;
  let db = null, user = null, room = null, roomRef = null;
  let shared = { settings: {}, bossOverrides: {}, fixedOverrides: {} };
  let recordNodes = {}, bootNodes = {};
  let local = {};

  const emit = () => listeners.forEach(fn => fn(state));
  const fail = (msg, e) => { if (e) console.warn(msg, e); errorListeners.forEach(fn => fn(msg)); };
  const now = () => Date.now() + serverOffset;
  const cloud = () => mode === 'cloud';
  const clean = o => JSON.parse(JSON.stringify(o));   // 去掉 undefined（Firebase 不接受）
  function rid(n) {
    const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const v = crypto.getRandomValues(new Uint8Array(n));
    return Array.from(v, x => a[x % a.length]).join('');
  }
  function write(p) {
    return p.catch(e => {
      const denied = String(e && (e.code || e.message)).toUpperCase().includes('PERMISSION');
      fail(denied ? '沒有權限：這項只有管理員能修改' : '寫入失敗，請檢查網路', e);
      throw e;
    }).catch(() => { });
  }

  // ── 單機模式 ──────────────────────────────────────
  function load() {
    if (mode !== 'local') return state;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) state = Object.assign(empty(), JSON.parse(raw));
    } catch (e) { console.warn('讀取資料失敗，使用空白資料', e); }
    return state;
  }
  function saveLocalAll() {
    if (state.records.length > MAX_RECORDS) state.records = state.records.slice(-MAX_RECORDS);
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('儲存失敗', e); }
    emit();
  }
  function saveLocalPersonal() {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(local)); } catch (e) { }
    compose();
  }

  // ── 雲端模式 ──────────────────────────────────────
  function compose() {
    state.settings = Object.assign({}, shared.settings || {}, local);
    state.bossOverrides = shared.bossOverrides || {};
    state.fixedOverrides = shared.fixedOverrides || {};
    state.records = Object.entries(recordNodes).map(([id, r]) => Object.assign({ id }, r)).sort((a, b) => a.t - b.t);
    state.boots = [...new Set(Object.values(bootNodes).map(b => b.t))].sort((a, b) => a - b);
    emit();
  }

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('載入失敗 ' + src));
      document.head.appendChild(s);
    });
  }

  async function initCloud() {
    try { local = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null'); } catch (e) { local = null; }
    if (!local) {   // 第一次用雲端：沿用單機版的個人設定（暱稱等）
      local = {};
      try {
        const old = JSON.parse(localStorage.getItem(KEY) || '{}').settings || {};
        Object.keys(old).filter(k => !SHARED_SETTINGS.includes(k)).forEach(k => { local[k] = old[k]; });
      } catch (e) { }
    }
    compose();
    try {
      await loadScript(SDK + 'firebase-app-compat.js');
      await loadScript(SDK + 'firebase-auth-compat.js');
      await loadScript(SDK + 'firebase-database-compat.js');
      firebase.initializeApp(cfg.firebase);
      db = firebase.database();
      db.ref('.info/serverTimeOffset').on('value', s => { serverOffset = s.val() || 0; });
      db.ref('.info/connected').on('value', s => { online = !!s.val(); emit(); });
      // 匿名登入：每台裝置一個身分（用來判斷「自己按的紀錄」與管理員），不用帳號密碼
      user = await new Promise(res => { const off = firebase.auth().onAuthStateChanged(u => { off(); res(u); }); });
      if (!user) user = (await firebase.auth().signInAnonymously()).user;
    } catch (e) {
      mode = 'denied'; fail('無法連上雲端資料庫，請確認網路後重新整理', e); emit(); return;
    }
    const params = new URLSearchParams(location.search);
    const pr = params.get('r'), pk = params.get('k');
    if (pr) localStorage.setItem(ROOM_KEY, pr);
    if (pk) {   // 管理員連結：記下身分後把金鑰從網址拿掉，避免截圖外流
      params.delete('k');
      history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash);
    }
    room = localStorage.getItem(ROOM_KEY);
    if (!room) { mode = 'noroom'; emit(); return; }
    if (pk) await write(db.ref(`adminClaims/${room}/${user.uid}`).set(pk));
    try {
      const c = await db.ref(`adminClaims/${room}/${user.uid}`).once('value');
      isAdmin = c.exists();
    } catch (e) { isAdmin = false; }
    attach();
  }

  function attach() {
    roomRef = db.ref('rooms/' + room);
    const onErr = e => { mode = 'denied'; fail('讀不到公會資料：連結可能錯誤，請向管理員重新要連結', e); emit(); };
    const watch = (ref, fn) => ref.on('value', s => { fn(s.val() || {}); if (mode === 'connecting') mode = 'cloud'; compose(); }, onErr);
    watch(roomRef.child('settings'), v => { shared.settings = v; });
    watch(roomRef.child('bossOverrides'), v => { shared.bossOverrides = v; });
    watch(roomRef.child('fixedOverrides'), v => { shared.fixedOverrides = v; });
    watch(roomRef.child('boots').orderByChild('t').startAt(now() - BOOT_DAYS * DAY), v => { bootNodes = v; });
    watch(roomRef.child('records').orderByChild('t').startAt(now() - RECORD_DAYS * DAY), v => { recordNodes = v; });
  }

  async function createRoom() {
    if (!db || !user) throw new Error('尚未連上雲端');
    const id = rid(20), key = rid(24);
    await db.ref('roomKeys/' + id).set(key);
    await db.ref(`adminClaims/${id}/${user.uid}`).set(key);
    await db.ref(`rooms/${id}/meta`).set({ createdAt: firebase.database.ServerValue.TIMESTAMP, by: local.nickname || '' });
    localStorage.setItem(ROOM_KEY, id);
    room = id; isAdmin = true; mode = 'connecting';
    attach();
    return { room: id, key };
  }

  // ── 共用 API ─────────────────────────────────────
  function setSetting(k, v) {
    if (mode === 'local') { state.settings[k] = v; return saveLocalAll(); }
    if (SHARED_SETTINGS.includes(k)) {
      if (!cloud()) return fail('尚未連上公會資料');
      return write(roomRef.child('settings/' + k).set(v));
    }
    local[k] = v; saveLocalPersonal();
  }

  function setOverride(kind, id, k, v) {
    if (mode === 'local') {
      const o = state[kind][id] = state[kind][id] || {};
      if (v === undefined) delete o[k]; else o[k] = v;
      return saveLocalAll();
    }
    if (!cloud()) return fail('尚未連上公會資料');
    write(roomRef.child(`${kind}/${id}/${k}`).set(v === undefined ? null : clean(v)));
  }

  function resetOverrides() {
    if (mode === 'local') { state.bossOverrides = {}; state.fixedOverrides = {}; return saveLocalAll(); }
    if (cloud()) write(roomRef.update({ bossOverrides: null, fixedOverrides: null }));
  }

  function addRecord(rec) {
    if (mode === 'local') {
      const r = Object.assign({ id: Date.now().toString(36) + rid(5), createdAt: Date.now() }, rec);
      state.records.push(r); saveLocalAll(); return r;
    }
    if (!cloud()) { fail('尚未連上公會資料，這筆沒有記錄'); return null; }
    const ref = roomRef.child('records').push();
    const data = clean(Object.assign({}, rec, { uid: user.uid }));
    data.createdAt = firebase.database.ServerValue.TIMESTAMP;
    write(ref.set(data));   // 離線時會先存在手機，恢復連線後自動上傳
    return Object.assign({ id: ref.key }, rec);
  }

  function removeRecord(id) {
    if (mode === 'local') { state.records = state.records.filter(r => r.id !== id); return saveLocalAll(); }
    if (cloud()) write(roomRef.child('records/' + id).remove());
  }

  function addBoot(t, by) {
    if (mode === 'local') {
      if (!state.boots.includes(t)) state.boots.push(t);
      state.boots.sort((a, b) => a - b);
      state.boots = state.boots.slice(-30);
      return saveLocalAll();
    }
    if (!cloud()) return fail('尚未連上公會資料');
    write(roomRef.child('boots').push().set({ t, by: by || '', uid: user.uid }));
  }

  function removeBoot(t) {
    if (mode === 'local') { state.boots = state.boots.filter(b => b !== t); return saveLocalAll(); }
    if (!cloud()) return;
    Object.entries(bootNodes).filter(([, b]) => b.t === t).forEach(([id]) => write(roomRef.child('boots/' + id).remove()));
  }

  function clearAll() {
    if (mode === 'local') { state = empty(); return saveLocalAll(); }
    if (cloud()) write(roomRef.update({ records: null, boots: null, settings: null, bossOverrides: null, fixedOverrides: null }));
  }

  function exportJSON() { return JSON.stringify(state, null, 2); }
  function importJSON(text) {
    if (mode !== 'local') throw new Error('雲端模式不能匯入備份');
    const obj = JSON.parse(text);
    if (!obj || !Array.isArray(obj.records)) throw new Error('格式不符');
    state = Object.assign(empty(), obj);
    saveLocalAll();
  }

  function memberLink() { return room ? location.origin + location.pathname + '?r=' + room : ''; }
  async function adminLink() {
    if (!isAdmin || !room || !db) return '';
    const c = await db.ref(`adminClaims/${room}/${user.uid}`).once('value');
    return c.exists() ? memberLink() + '&k=' + c.val() : '';
  }

  // 同一台裝置開多個分頁時同步
  window.addEventListener('storage', e => {
    if (mode === 'local' && e.key === KEY) { load(); emit(); }
    if (mode !== 'local' && e.key === LOCAL_KEY) { try { local = JSON.parse(e.newValue) || {}; } catch (x) { } compose(); }
  });

  window.Store = {
    load, now, setSetting, setOverride, resetOverrides,
    addRecord, removeRecord, addBoot, removeBoot, clearAll, exportJSON, importJSON,
    createRoom, memberLink, adminLink,
    get state() { return state; },
    info() { return { mode, online, isAdmin, room, uid: user ? user.uid : null, cloudConfigured }; },
    canEditShared() { return mode === 'local' || (cloud() && isAdmin); },
    canDelete(r) { return mode === 'local' || isAdmin || (user && r.uid === user.uid); },
    subscribe(fn) { listeners.push(fn); },
    onError(fn) { errorListeners.push(fn); },
  };

  if (cloudConfigured) initCloud(); else load();
})();
