---
appetite: lô nhỏ — một vòng xây dựng
---

# Đề xuất — trang web cá nhân một trang, dựng từ một tệp nội dung

## Vấn đề

Một người làm việc tự do đang giữ hồ sơ năng lực trong một bộ slide và gửi cho mọi người bản PDF. Họ muốn một
trang web thật để đặt ở bất kỳ đâu, nhưng không muốn framework, dịch vụ build hay CMS: họ chỉ muốn sửa một tệp
nội dung nhỏ rồi nhận được một trang.

## Hình dạng giải pháp

Một tập lệnh Node không phụ thuộc thư viện nào, `node build.mjs`, đọc `content.json` và ghi ra một tệp tĩnh duy nhất
`dist/index.html` (CSS nhúng trực tiếp, không cần JavaScript để đọc).

`content.json` gồm: `name`, `tagline`, `about` (một đoạn văn), `projects` (danh sách `{title, summary, url}`) và
`contact` (`{email}`).

Trang hiển thị theo thứ tự: tên là thẻ `<h1>` duy nhất của trang, tagline nằm dưới; mục Giới thiệu; mục Dự án với
một thẻ cho mỗi dự án, tiêu đề là liên kết tới `url`; mục Liên hệ với liên kết `mailto:`. Thẻ `<title>` của trang là tên.

Đường dẫn đầu ra là `dist/index.html`; `build.mjs` có thể đọc `$CONTENT_FILE` và `$OUT_DIR` để thay đổi vị trí đầu vào
và đầu ra, để bài kiểm tra trỏ được vào tệp tạm mà không động tới tệp thật.

## Hành vi ở biên (đây là một phần của đề xuất, không phải chi tiết phụ)

- Dự án không có `url` hiển thị tiêu đề dưới dạng văn bản thường, không bao giờ là liên kết tới `#` hay href rỗng.
- Không có dự án nào thì mục Dự án hiển thị câu "Projects are coming soon." và không có danh sách rỗng.
- Văn bản từ `content.json` được thoát ký tự HTML: tiêu đề như `<b>Rock & Roll</b>` phải hiện ra như văn bản.
- Thiếu hoặc không phân tích được `content.json` thì `node build.mjs` thoát với mã 1, in một dòng lỗi ra stderr nêu rõ vấn đề,
  và không ghi `dist/index.html`.
- Thiếu trường bắt buộc (`name`) cũng vậy: thoát mã 1, một dòng, không ghi gì.
- Chạy `node build.mjs` hai lần cho ra kết quả giống hệt từng byte.

## Hố sâu cần tránh

Markdown trong `about`, giao diện chủ đề, nhiều trang, hình ảnh, và mọi chế độ theo dõi hay phục vụ.

## Không làm

- Không phụ thuộc thư viện, không gọi mạng, không có JavaScript trong trang được tạo.
- Không ghi đè `content.json`.

## Kiểm chứng

Chạy bằng `node --test`: một tệp kiểm tra điều khiển `node build.mjs` trên các tệp nội dung tạm và khẳng định trên
văn bản HTML được tạo (không cần trình duyệt).
