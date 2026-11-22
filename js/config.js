// 網站設定
// firebase 留 null ＝ 單機模式（資料只存在這台裝置）。
// 貼上 Firebase 的設定 ＝ 雲端模式（全公會即時同步）。做法見「上線步驟.md」。
// 這些值本來就會公開在網頁上，安全性靠資料庫規則（database.rules.json）保護，不是秘密。
window.LW_CONFIG = {
  firebase: {
    apiKey: 'AIzaSyDBb22QD-O7lmZlP1WZ2FaRvtQ8RzvBpKM',
    authDomain: 'lw-boss-80305.firebaseapp.com',
    databaseURL: 'https://lw-boss-80305-default-rtdb.asia-southeast1.firebasedatabase.app',
    projectId: 'lw-boss-80305',
    appId: '1:822332941110:web:b2a97fff5df4494e0f8997',
  },
};
