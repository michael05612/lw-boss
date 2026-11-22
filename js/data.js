// 天堂W 王表 — 預設資料
// 所有時間皆為台灣時間 (UTC+8)。官方公告多用韓國時間 (UTC+9)，抄入前要減 1 小時。
// 數值來源與核對狀態寫在 note；遊戲更新後請到「設定」修改，不必改程式。
window.LW_DATA_VERSION = '2026-11-22';

// ── 死後計時王（需要按擊殺）────────────────────────────
// hours: 死後幾小時重生   event: 「野外首領的逆襲」活動是否加快 2 倍（官方 2026/10/14 名單）
// bootOffset: 開機後第幾分鐘出生（推測種子值，系統會用每週紀錄自動學習修正）
// 顯示格式：本名(暱稱)；沒有暱稱只顯示本名。暱稱可在「設定」修改。
// full: 補充說明（只有合併的王用到）；alias: 搜尋用的其他叫法
window.LW_DEFAULT_BOSSES = [
  // 12 小時
  { id: 'sise',     name: '四色',           nick: '',     alias: [],                     hours: 12, event: false, region: '古魯丁地監 3/4F' },
  { id: 'giant',    name: '巨人',           nick: '',     alias: ['二巨', '烏爾森', '戈爾森'], hours: 12, event: true, region: '巨人峽谷',
    full: '啃咬山峰的烏爾森／吞噬岩石的戈爾森' },
  // 8 小時
  { id: 'ramasu',   name: '審判者拉馬修',   nick: '蛇女', alias: ['拉馬修', '審判'],       hours: 8, event: true,  region: '遺忘的春之庭院' },
  { id: 'dahei',    name: '大黑長者',       nick: '',     alias: ['大黑'],                hours: 8, event: false, region: '' },
  { id: 'ule',      name: '烏勒庫斯',       nick: '',     alias: ['烏勒'],                hours: 8, event: true,  region: '妖魔城堡' },
  { id: 'neck',     name: '奈克偌斯',       nick: '',     alias: ['奈克', '奈克諾斯'],     hours: 8, event: true,  region: '妖魔城堡' },
  { id: 'queenant', name: '巨蟻女皇',       nick: '',     alias: ['蟻后'],                hours: 8, event: false, region: '' },
  { id: 'aot',      name: '扭曲的艾奧特',   nick: '',     alias: ['艾奧特', '扭曲'],       hours: 8, event: false, region: '' },
  { id: 'kloring',  name: '克洛林',         nick: '',     alias: [],                     hours: 8, event: false, region: '古魯丁地監 6F' },
  { id: 'kurto',    name: '庫爾託',         nick: '狼王', alias: [],                     hours: 8, event: true,  region: '悲哀森林' },
  { id: 'hagma',    name: '頭目哈格瑪',     nick: '',     alias: ['頭目', '哈格瑪'],       hours: 8, event: true,  region: '影子山賊頭目居處' },
  { id: 'croc',     name: '史前巨鱷',       nick: '鱷魚', alias: ['巨鱷'],                hours: 8, event: true,  region: '霧月島' },   // 官方舊公告：每 8 小時，待核對
  { id: 'mayu',     name: '大腳瑪幽',       nick: '',     alias: ['大腳', '瑪幽'],         hours: 8, event: true,  region: '瑪幽雪壁' }, // 僅私服資料 8 小時，待核對
  // 6 小時
  { id: 'kuyo',     name: '獻上祭品的庫約', nick: '',     alias: ['庫約'],                hours: 6, event: true,  region: '說話之島地監' },
  // 4 小時
  { id: 'madam',    name: '巴爾博薩夫人',   nick: '',     alias: ['夫人'],                hours: 4, event: true,  region: '海賊墳墓', bootOffset: 0 },
  { id: 'slayer',   name: '殺戮者',         nick: '肥肥', alias: ['殺戮'],                hours: 4, event: true,  region: '死亡廢墟', bootOffset: 70 },
  { id: 'macken',   name: '黑蛇騎士團麥肯', nick: '',     alias: ['麥肯'],                hours: 4, event: true,  region: '亞丁城堡地下監獄', bootOffset: 90 },
  { id: 'kardisu',  name: '卡爾迪修',       nick: '蜥蜴', alias: ['卡爾', '迪修', '蜥蜴王'], hours: 4, event: true,  region: '風木東部沙漠', bootOffset: 100 },
  { id: 'kast',     name: '卡司特王',       nick: '',     alias: ['卡王'],                hours: 4, event: true,  region: '死亡森林' },
  { id: 'nirod',    name: '尼羅德',         nick: '豬',   alias: ['尼羅'],                hours: 4, event: true,  region: '波若斯妖魔部落', bootOffset: 120 },
  { id: 'tiger',    name: '黑虎恰姆帕瓦特', nick: '',     alias: ['黑虎'],                hours: 4, event: true,  region: '亞丁農場' },
  { id: 'oduya',    name: '奧杜亞',         nick: '',     alias: [],                     hours: 4, event: false, region: '' },
  { id: 'molitia',  name: '屠殺者莫利提亞', nick: '茉莉', alias: ['莫利提亞', '屠殺者'],   hours: 4, event: true,  region: '光與影子森林' },
  { id: 'drake',    name: '乾渴的德雷克',   nick: '海賊', alias: ['德雷克'],              hours: 4, event: true,  region: '海賊墳墓' },
  { id: 'wyvern1',  name: '飛龍1',          nick: '',     alias: ['飛龍'],                hours: 4, event: true,  region: '龍之谷' },
  { id: 'wyvern2',  name: '飛龍2',          nick: '',     alias: ['飛龍'],                hours: 4, event: true,  region: '龍之谷' },
  { id: 'wyvern3',  name: '飛龍3',          nick: '',     alias: ['飛龍'],                hours: 4, event: true,  region: '龍之谷' },
  { id: 'wyvern4',  name: '飛龍4',          nick: '',     alias: ['飛龍'],                hours: 4, event: true,  region: '龍之谷' },
];

// ── 固定時刻王（不用按，自動顯示）────────────────────────
// 來源：祥可可首領時間表（2026/11/16 確認），逐日對照。
// days: 0=日 1=一 … 6=六；times: 台灣時間；windowMin: 隨機出現的時段長度（分鐘）
// dayNote: 某幾天額外出現的王；cat: server=服內  cross=跨服（含競技場，平常隱藏）
const ALL = [0, 1, 2, 3, 4, 5, 6];
window.LW_DEFAULT_FIXED = [
  // ── 服內（使用者 2026/11/22 確認）──
  // 克特、巫師、萊奧斯這批：使用者確認台灣 19:00／19:00／19:15
  // （＝官方指南「原本日程」20:00／20:15 KST −1 小時）
  { id: 'f-kurt',       cat: 'server', name: '克特、蜘蛛',     days: ALL, times: ['19:00'] },
  { id: 'f-wizard',     cat: 'server', name: '巫師、變怪王',   days: ALL, times: ['19:00'] },
  { id: 'f-leos',       cat: 'server', name: '黑色亡靈萊奧斯', days: ALL, times: ['19:15'],
    dayNote: { 1: '＋死亡騎士、鑽石高崙', 2: '＋死亡騎士、船長卡利索', 3: '＋死亡騎士、疾風的巨大飛龍',
               4: '＋死亡騎士、巨大蜈蚣', 5: '＋死亡騎士、大黑長者', 6: '＋死亡騎士、狂風的夏斯奇',
               0: '＋漆黑的死亡騎士' } },
  { id: 'f-ivory-f5',   cat: 'server', name: '象塔火焰5樓 巨蟻女皇', days: [1, 3], times: ['18:30'] },
  { id: 'f-ivory-y5',   cat: 'server', name: '象塔炎魔5樓 巨蟻女皇', days: [2, 4], times: ['18:30'] },
  { id: 'f-ivory-f8',   cat: 'server', name: '象塔火焰8樓 巨蟻女皇', days: [5], times: ['18:30'] },
  { id: 'f-hardin',     cat: 'server', name: '象塔炎魔8樓 哈汀',     days: [6], times: ['18:30'] },
  { id: 'f-flower',     cat: 'server', name: '大花草',               days: [0], times: ['18:30'] },
  // 萊茵：每個奇數整點（01:00、03:00 … 23:00），使用者 2026/11/22 確認
  { id: 'f-reinhard',   cat: 'server', name: '萊茵', days: ALL, nextOnly: true,   // 只顯示下一場
    times: Array.from({ length: 12 }, (_, i) => String(i * 2 + 1).padStart(2, '0') + ':00') },
  // ── 跨服（使用者 2026/11/22 確認；傲慢之塔＝官方「世界地監」）──
  { id: 'f-dream-ice',  cat: 'cross', name: '夢幻樂園 冰之女皇幻影', days: ALL, times: ['12:00'], windowMin: 120 },
  { id: 'f-thebes-room', cat: 'cross', name: '底比斯 BOSS房開放', days: [3], times: ['10:30'] },
  { id: 'f-tikal-room', cat: 'cross', name: '提卡爾 BOSS房開放', days: [4], times: ['10:30'] },
  { id: 'f-tower147',   cat: 'cross', name: '傲慢 1、4、7 樓', days: ALL, times: ['19:00'] },
  { id: 'f-tower258',   cat: 'cross', name: '傲慢 2、5、8 樓', days: ALL, times: ['19:15'] },
  { id: 'f-tower369',   cat: 'cross', name: '傲慢 3、6、9 樓', days: ALL, times: ['19:30'] },
  { id: 'f-tower10',    cat: 'cross', name: '傲慢10樓', days: ALL, times: ['19:45'] },
  { id: 'f-demon-top',  cat: 'cross', name: '魔族頂樓', days: [1, 2], times: ['20:00'] },
  { id: 'f-phoenix',    cat: 'cross', name: '不死鳥、團長', days: [1, 3, 5, 0], times: ['20:30'], dayNote: { 3: '＋遺忘飛龍王底比斯' } },
  { id: 'f-takun',      cat: 'cross', name: '塔坤、團長',   days: [2, 4, 6], times: ['20:30'], dayNote: { 4: '＋提卡爾' } },
  { id: 'f-icequeen',   cat: 'cross', name: '冰之女皇', days: [2], times: ['22:00'] },
  { id: 'f-dream',      cat: 'cross', name: '夢幻樂園', days: ALL, times: ['00:00'] },
  // 跨服（競技場）
  { id: 'a-shilen-room', cat: 'cross', name: '席琳 BOSS房開放', days: [0], times: ['10:00'] },
  { id: 'a-dusk-giant', cat: 'cross', name: '黃昏山脈巨人', days: [5, 6], times: ['18:00'], windowMin: 60 },
  { id: 'a-water-dragon', cat: 'cross', name: '水龍窟', days: [5], times: ['20:00'], windowMin: 60 },
  { id: 'a-four',       cat: 'cross', name: '拉動（四隻王同時）', days: [1, 2], times: ['21:00'] },
  { id: 'a-kronos',     cat: 'cross', name: '狂神夜、霧華', days: [3], times: ['21:00'] },
  { id: 'a-dolga',      cat: 'cross', name: '多魯加祕密 三王', days: [4], times: ['21:00'] },
  { id: 'a-dominion',   cat: 'cross', name: '頂樓死神、支配塔一階、二階', days: [6], times: ['21:00'] },
  { id: 'a-classic',    cat: 'cross', name: '傳統克特、傳統巴風特', days: [0], times: ['21:00'] },
  { id: 'a-center',     cat: 'cross', name: '中央王（隨機）', days: [1, 2], times: ['21:30'], windowMin: 30 },
  { id: 'a-laksal',     cat: 'cross', name: '滅亡之城 拉克沙爾', days: [3], times: ['22:00'] },
  { id: 'a-abyss',      cat: 'cross', name: '深淵 奈洛菈特莫爾', days: [4], times: ['22:00'] },
  { id: 'a-antharas',   cat: 'cross', name: '安塔瑞斯', days: [5], times: ['22:00'] },
  { id: 'a-godking',    cat: 'cross', name: '神界王', days: [6], times: ['22:00'] },
  { id: 'a-wind-dragon', cat: 'cross', name: '風龍窟 迪亞勒、席琳', days: [0], times: ['22:00'] },
  // 舊資料，預設關閉
  { id: 'f-elfking',    cat: 'server', name: '精靈王（隨機）', days: ALL, times: ['03:00', '09:00', '15:00', '21:00'], windowMin: 60, enabled: false },
];

window.LW_DEFAULT_SETTINGS = {
  nickname: '',
  resetWeekday: 3,      // 週三
  resetTime: '06:00',
  graceMin: 5,          // 預測時間過後幾分鐘沒人回報 → 推定輪空
  timelineCount: 15,    // 主畫面顯示接下來幾隻王
  hotCount: 8,          // 快速擊殺區按鈕數
  notify: true,
  notifyLeadMin: 5,
  sound: true,
  eventOn: false,       // 「野外首領的逆襲」重生加快 2 倍
  showCross: false,     // 顯示跨服王（含競技場）；關閉＝只顯示服內王
  keepAwake: false,     // 開著網頁時保持螢幕不鎖定
};
// 上面設定中，resetWeekday / resetTime / graceMin / eventOn 是全公會共用（雲端模式只有管理員能改，eventOn 大家都能切）；
// 其餘是個人設定，只存在自己的裝置。
