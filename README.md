# KHH Flight Board

繁體中文 · [English](README.en.md)

[![Live demo](https://img.shields.io/badge/Live_demo-KHH-216b29)](https://kageryo.github.io/khh-flight-board/)
[![CI](https://github.com/KageRyo/khh-flight-board/actions/workflows/check.yml/badge.svg)](https://github.com/KageRyo/khh-flight-board/actions/workflows/check.yml)
[![Pages](https://github.com/KageRyo/khh-flight-board/actions/workflows/pages.yml/badge.svg)](https://github.com/KageRyo/khh-flight-board/actions/workflows/pages.yml)
[![Data check](https://github.com/KageRyo/khh-flight-board/actions/workflows/freshness.yml/badge.svg)](https://github.com/KageRyo/khh-flight-board/actions/workflows/freshness.yml)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.19-417e38?logo=nodedotjs&logoColor=white)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

高雄機場的網頁航班看板，參考現場螢幕製作，可全螢幕輪播，也能指定登機門或報到櫃台。

**[開啟看板](https://kageryo.github.io/khh-flight-board/)**

[![四種看板預覽](docs/board-preview.gif)](https://kageryo.github.io/khh-flight-board/)

## 選擇畫面

[國際出境](https://kageryo.github.io/khh-flight-board/#int) · [國際入境](https://kageryo.github.io/khh-flight-board/#int-arr) · [國內離站](https://kageryo.github.io/khh-flight-board/#dom) · [國內到站](https://kageryo.github.io/khh-flight-board/#dom-arr)

也有獨立的[登機門](https://kageryo.github.io/khh-flight-board/gate.html)與[報到櫃台](https://kageryo.github.io/khh-flight-board/counter.html)畫面。登機門可選國際、國內離站；報到櫃台僅提供國際出境。指定位置與航班後，可直接分享網址。

總覽每 18 秒翻頁，可搜尋、篩選、暫停或開啟四看板輪播；設定會自動保留。`←`／`→` 翻頁，空白鍵暫停或繼續，`1`–`4` 切換看板。跑馬燈動畫可獨立關閉。

[操作說明與畫面預覽](docs/screens.md)

## 資料更新

這是非官方專案，使用高雄國際航空站的公開資料。行程請以機場及航空公司公告為準。

線上版由 GitHub Actions 排程抓取，**排程可能延遲**；請查看頁尾的資料取得時間。頁面每 60 秒檢查快照，超過 15 分鐘會提醒資料過期。取得時間不代表官方更新時間，官方資料也未附航班日期。

上方 Data check 徽章顯示最近一次排程檢查的結果，並非即時資料狀態。[資料來源、快取與部署方式](docs/data.md)

## 本機執行

需要 [Node.js 22.19+](https://nodejs.org/)，不需安裝套件或 API 金鑰。

```sh
git clone https://github.com/KageRyo/khh-flight-board.git
cd khh-flight-board
npm start
```

開啟 <http://127.0.0.1:3000>。Windows 也可雙擊 `start-board.cmd`；停止時按 `Ctrl+C`。連接埠、區網與查詢間隔設定見[資料文件](docs/data.md#設定)。

## 開發

```sh
npm run check
npm test
npm run build:pages
npm run check:freshness
```

`build:pages` 抓取四組官方資料並輸出至 `dist/`；`check:freshness` 檢查已發布快照。[更多設定](docs/data.md)

[外觀參考](docs/appearance.md) · [旅客提醒來源](docs/notices.md) · [驗證紀錄](docs/verification.md)

程式碼採用 [MIT License](LICENSE)。官方圖示與航班資料權利屬原權利人。
