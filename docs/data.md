# 資料與部署

## 線上版：GitHub Pages

直接開啟 [線上看板](https://kageryo.github.io/khh-flight-board/)，不需安裝。四種看板也有直接連結：

- [國際出境](https://kageryo.github.io/khh-flight-board/#int)
- [國際入境](https://kageryo.github.io/khh-flight-board/#int-arr)
- [國內離站](https://kageryo.github.io/khh-flight-board/#dom)
- [國內到站](https://kageryo.github.io/khh-flight-board/#dom-arr)

官方 JSON 目前沒有允許跨站讀取的 CORS 標頭，GitHub Pages 也無法執行 Node.js 代理。因此線上版由 GitHub Actions **約每 5 分鐘**抓取四組官方資料並發布靜態快照，頁面每 **60 秒**檢查網站上的新快照。排程與發布可能延遲；請以頁尾的實際取得時間判斷新鮮度，不是每 60 秒直接抓官方資料。

最後成功取得超過 **15 分鐘**時，線上版會顯示快取警示。官方故障時會嘗試保留上一次已發布的有效快照與原始成功時間；若任何資料源無法取得、且沒有有效舊快照，建置中止，現有網站繼續服務。可於 [Actions](https://github.com/KageRyo/khh-flight-board/actions/workflows/pages.yml) 手動執行 `Run workflow` 重試。

Pages 採用 GitHub Actions 發布；推送 `main`、手動執行與排程都會觸發。公開儲存庫長期無活動可能被 GitHub 停用排程；若停止更新，請檢查 Actions 是否仍啟用。

## 設定

複製 `.env.example` 為 `.env`，修改後重新啟動：

```dotenv
HOST=127.0.0.1
PORT=3000
POLL_SECONDS=60
UPSTREAM_TIMEOUT_SECONDS=12
```

| 設定 | 預設 | 用途 |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | 預設僅本機；區網展示可自行改為 `0.0.0.0` |
| `PORT` | `3000` | 1–65535，連接埠占用時改為 3001 等 |
| `POLL_SECONDS` | `60` | 本機查詢間隔，30–3600 秒 |
| `UPSTREAM_TIMEOUT_SECONDS` | `12` | 本機官方連線逾時，2–25 秒 |

`.env` 不影響 Pages 排程。Pages 的排程設定在 `.github/workflows/pages.yml`。本機伺服器預設只監聽 `127.0.0.1`，未提供帳號或驗證功能。

## 官方資料與時間語意

| 看板 | 官方資料 | 地點欄位 |
| --- | --- | --- |
| 國際出境 | [INTDEP](https://www.kia.gov.tw/Announce/NewsArea/InstantSchedule_INTDEP.json) | `goalAirportName / goalAirportCode`，目的地 |
| 國際入境 | [INTARR](https://www.kia.gov.tw/Announce/NewsArea/InstantSchedule_INTARR.json) | `upAirportName / upAirportCode`，來自地點 |
| 國內離站 | [DOMDEP](https://www.kia.gov.tw/Announce/NewsArea/InstantSchedule_DOMDEP.json) | 目的地 |
| 國內到站 | [DOMARR](https://www.kia.gov.tw/Announce/NewsArea/InstantSchedule_DOMARR.json) | 來自地點 |

`expectTime` 是表定時間；`realTime` 是異動時間，狀態已離站／抵達時標為實際，其餘為預計。國際線異動時間顯示在狀態區，國內線另有預計／實際欄位。時間以 `HHmm` 呈現，缺值為 `—`。不因時間差自行判定延誤，未知狀態原樣顯示，共掛文字不任意合併或刪除。英文為已知狀態的介面翻譯；未提供的行李轉盤、領取狀態等資訊不捏造。

官方 JSON 未提供航班日期、時區與來源發布時間。畫面採台灣時間（Asia/Taipei）；頁首時鐘是目前時間，不能證明清單屬於當日。**最後成功取得是本機或 GitHub 抓取及驗證資料的時間，不是官方更新時間。** 重新取得相同資料也無法證明上游是否新鮮；跨日快取保留完整原始時間與資料年齡。行程請以機場及航空公司公告為準。

## 快取與錯誤

本機成功資料保存於 `.cache/<source>.json`，瀏覽器另以 `localStorage` 保存。HTTP 錯誤、無效 JSON 或任一航班必要欄位異常不會覆蓋舊資料；合法空陣列 `[]` 則會清除舊清單。磁碟或瀏覽器快取無法寫入時會提示。

本機超過兩個輪詢間隔、Pages 超過 15 分鐘未成功取得時標為快取。代理或網路中斷後，已開啟頁面仍可保留清單；沒有 Service Worker，本機代理停止後重新整理整頁需先重啟 `npm start`。Logo 直接來自官方網站，失敗時保留航空公司文字。清除 `.cache/` 與網站儲存空間可重置快取。

## 更新監測

[Check published data](https://github.com/KageRyo/khh-flight-board/actions/workflows/freshness.yml) 在發布工作完成後，以及每 15 分鐘的排程檢查已發布網站。四組快照必須通過來源與欄位驗證、成功取得時間在 15 分鐘內，且未標為備援或錯誤，工作才會成功。合法空清單仍視為有效資料。

異常時會先檢查是否有等待或執行中的發布工作；若沒有，使用 GitHub 內建 token 觸發 `main` 的一次補發，不需外部排程服務或額外憑證。自動補發以 **30 分鐘**為冷卻間隔，失敗的補發也計入，避免官方故障時反覆觸發。補發完成後會再次執行監測；原本發現異常的監測仍標為失敗，新的監測結果才代表恢復狀態。GitHub API 失敗時會直接回報，不自動重送可能已被接受的觸發請求。

異常與補發處理結果列在 Actions log。需要通知時可在 GitHub 的通知設定啟用 Actions 失敗通知。監測與發布都依賴 GitHub Actions，排程可能一起延遲；需要固定更新頻率時，應改用獨立排程服務。

本機可執行 `npm run check:freshness`；使用 `SITE_URL` 指定其他部署網址。此檢查只讀取已發布快照，不查詢機場上游，也不修改網站。
