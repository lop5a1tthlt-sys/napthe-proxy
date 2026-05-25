# Shop Vinh Nè Bana — Full Stack on Render.com

## Cấu trúc repo
```
shopvinhnebana/
├── server.js          ← Toàn bộ backend (index.php + callback.php + config.php đã gộp)
├── package.json       ← Dependencies
├── lognapthe.txt      ← Log giao dịch (tự tạo khi có thẻ nạp)
└── public/
    └── index.html     ← Toàn bộ giao diện web
```

## Các route
| Route | Chức năng |
|-------|-----------|
| `GET /` | Trang web chính |
| `POST /napthe` | Nhận thẻ từ web → ký MD5 → gọi TSR → trả kết quả |
| `GET /callback` | TSR callback về sau khi xử lý thẻ pending |
| `GET /log` | Xem log giao dịch (xoá đi khi chạy thật) |

## Config
Sửa trong `server.js` dòng đầu:
```js
const PARTNER_ID  = '60034605186';
const PARTNER_KEY = '83fcf6e737c746e2d2352bd8d55c430a';
```

## Deploy lên Render.com
- **Runtime**: Node
- **Build Command**: `npm install`
- **Start Command**: `node server.js`

## Callback URL
Vào trang TSR, điền Callback URL:
```
https://TÊN-APP.onrender.com/callback
```
