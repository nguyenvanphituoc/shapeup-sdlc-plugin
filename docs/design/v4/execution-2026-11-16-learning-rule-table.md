# Execution — bảng rule và vòng học (plan 2026-11-16)

| | |
|---|---|
| **Plan** | [plan-2026-11-16-learning-rule-table.md](plan-2026-11-16-learning-rule-table.md) |
| **Ngày** | 2026-11-16 |
| **Baseline trước khi sửa** | `npm test` 364 checks, 0 failure · `npm run demo` verified · `claude plugin validate . --strict` và `./.claude-plugin/marketplace.json --strict` đều pass (chạy 2026-11-16 trước commit đầu tiên) |
| **Dự án kiểm** | `../proj-shapeup-sdlc-plugin-testing`, plugin nạp bằng `--plugin-dir` trỏ vào working copy; không cài plugin |

## L0 — Đo

Script nằm trong scratchpad của phiên, không commit. Mỗi dòng ghi lệnh/nguồn và kết quả.

| Mã | Câu hỏi | Cách đo | Kết quả |
|---|---|---|---|
| Q1 | Order có khoá nào ngoài `reader`? | đọc toàn bộ `traces/**/orders/*.json` (142 order, 20 thư mục trace; plan nói 21) | Mọi order đều có `operation` (100%). Nhưng với 4 reader đọc rule (121 order), `operation` là hằng trong ba reader: `orient` 16/16 `orient`, `qa-edge-hunter` 9/9 `hunt`, `plan` 63/63 `plan`. Khoá thật sự **phân biệt** order chỉ có: `step` ở plan (63 order, bốn giá trị), `fix` ở task-executor (3/33), attempt hoặc round ≥ 2 (3/33). Tức 66/121 = **54,5%** order có khoá phân biệt được. |
| Q2 | Tập nạp trung vị/p95 trên kho ~200 rule? | script dựng 200 rule tổng hợp qua `kb lint` (0 vấn đề; ≤ 3 rule active cùng `when`), chạy bộ chọn thật với 2.000 order tổng hợp, ngân sách vô hạn | trung vị **1.043 token**, p95 **2.035**, max 2.765; 335/2.000 order (16,8%) vượt 1.500. Một kho không qua lint (35% rule không điều kiện, không giới hạn nhóm) cho trung vị 3.482 — lint chính là cái giữ kho trong ngân sách. |
| Q3 | Loop đọc lại guidance plan ở mỗi bước? | đếm `payload.kb_rules_paths` trong các order `plan-*` của trace | 48/63 order plan mang đủ bốn file (192 đường dẫn): loop *được bảo* đọc 4 file × 4 bước = 16 lần đọc mỗi run. Trace không cho thấy lần đọc thật, chỉ cho thấy chỉ thị — áp lực cửa sổ loop là có trên giấy. |
| Q4 | Order có substrate chỉ là kho rule có chặn ghi ra ngoài không? | `hooks/sandbox-guard.mjs` bắn với order `learn`-like và ba payload ghi | ghi vào `shapeup/knowledge-base/rules/**` và `harness-defects.md`: `in-substrate`; ghi `src/x.js`: **DENY** `outside-substrate`. Fence chặn được. |
| Q5 | Resolver có nhận dòng Retro Ownership sau `order close` trên run `escalated`? | dự án rác: `init run` → `gate COACH-1 skip` → `order close --status escalated` → `gate COACH-1 skip` | exit 0, có dòng ledger. Resolver nhận cả trước và sau close; thiết kế đặt gate trước close vẫn đúng. |
| Q6 | Token thực của gate agent ở Retro Ownership? | tìm dispatch receipts có `usage` của gate-agent trong `traces/` | **Không đo được**: các trace có từ 2026-11-07/09, trước khi gate agent tồn tại (gate khi đó trả lời bằng preset). Số đầu tiên đến từ hai run thật ở mục L5 dưới đây. |

### Cổng L0

- Q1: đọc theo chữ ("có khoá ngoài reader") là 100%, đọc theo ý ("khoá phân biệt được order") là 54,5% < 80%. Chọn cách đọc nghiêm hơn. Hệ quả theo bảng quyết định: L1 làm đủ; L2 chỉ *bắt buộc* bộ chọn tối thiểu (reader + operation) — nhưng bộ chọn đầy đủ (thêm `step`, `archetype`, `gate`, `signal`) đã được làm vì L3 cần `signal` và chi phí thêm không đáng kể. Phần dư không phải là rủi ro: khoá không có trên order thì rule điều kiện theo nó không nạp.
- Q2: trung vị 1.043 ≤ 1.500, nên Go; p95 2.035 nên ngân sách mặc định đặt **2.000** (đề xuất của Q2 theo plan), không phải 1.500.
- Q4: fence chặn → không phải viết lại L5. Q5: không đổi resolver.
