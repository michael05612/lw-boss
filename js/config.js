// 網站設定
// firebase 留 null ＝ 單機模式（資料只存在這台裝置）。
// 貼上 Firebase 的設定 ＝ 雲端模式（全公會即時同步）。做法見「上線步驟.md」。
// 這些值本來就會公開在網頁上，安全性靠資料庫規則（database.rules.json）保護，不是秘密。
window.LW_CONFIG = {
  firebase: null,
  // firebase: {
  //   apiKey: '...',
  //   authDomain: '你的專案.firebaseapp.com',
  //   databaseURL: 'https://你的專案-default-rtdb.asia-southeast1.firebasedatabase.app',
  //   projectId: '你的專案',
  //   appId: '...',
  // },
};
