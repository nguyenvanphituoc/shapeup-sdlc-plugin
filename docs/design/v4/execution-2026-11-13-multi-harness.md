# Execution — multi-harness plan (S0)

| | |
|---|---|
| **Ngày** | 2026-11-14 |
| **Baseline** | `e2ec76a` trên `main`, cây sạch |
| **Trạng thái** | S0 **dừng ở baseline**: chưa đo được M1–M12, M14–M18 vì máy này không có Codex CLI và chưa có khóa DeepSeek. Cổng S0 chưa qua nên S1–S10 chưa bắt đầu |

## Baseline (đo 2026-11-14)

| Lệnh | Kết quả |
|---|---|
| `npm test` | 297 checks, 0 failures |
| `npm run demo` | xanh: `sandbox-guard` từ chối ghi ngoài substrate, cho phép ghi trong substrate; sinh lại `docs/assets/demo-gate.svg` |
| `claude plugin validate . --strict` | Validation passed |

## Bảng đo

| Mã | Trạng thái | Ghi chú |
|---|---|---|
| M1–M12, M15–M18 | **chưa đo** | `codex` không có trên PATH. Cần Codex CLI cài sẵn và đăng nhập; mọi đo phải ghi `codex --version` và ngày, payload thô vào `tests/fixtures/codex/<mã>.json` |
| M13 | **chỉ có tài liệu** (plan mục 9.3) | Endpoint `https://api.deepseek.com/anthropic` theo tài liệu chính thức, chưa gọi thử. Phần `Agent.model` nhận id thô hay không và `resolvedModel` báo gì: chưa đo |
| M14 | **chưa đo** | Cần khóa API DeepSeek và quyết định PO số 9 (dữ liệu gửi tới dịch vụ ở Trung Quốc đại lục) |

## Cổng S0

Chưa thể quyết go, lite hay no-go: cổng cần M1–M3 (và M5, M13). Theo nguyên tắc của plan, không dùng tài liệu thay cho phép đo để qua cổng, nên không stage nào sau S0 được bắt đầu.

## Cần từ PO để tiếp tục

1. Cài Codex CLI (và đăng nhập) trên máy này, hoặc chỉ định máy khác chạy S0.
2. Cho phép chạy S0 phần DeepSeek (khóa API và quyết định số 9), hoặc bỏ S9/S9b.
3. Các quyết định mục 7 chặn S4 (số 2), S5 (số 3, 8), S6 (số 7), S8 (số 4), S3c (số 6).

## S1 — đường nối adapter (làm 2026-11-14, chưa commit)

Làm trước cổng S0 vì S1 không đổi hành vi và không dựa vào số đo Codex; nếu S0 ra no-go thì phần này vẫn vô hại.

- `kernel/core/host.mjs` mới: `hostFrom`, `withoutHost`, `hostMismatch`, `denyPayload`. Chỉ có parser host Claude; **chưa có parser Codex** (cần fixture M1).
- Bốn mục hook trong `hooks/hooks.json` mang `--host claude`; hook không có cờ vẫn là Claude.
- Payload mang tên công cụ của host khác ghi một dòng `allow` với `rule:"host-mismatch"` (vẫn fail-open, không im lặng).
- Test mới `tests/structural/14-host-seam.mjs`: phát lại 7 payload qua cây `70e1818` (`git archive`) và cây mới, so exit, stdout và dòng ledger (bỏ `at`, `pid`); cộng cổng envelope.
- `08-shipped-set.mjs` chỉ đổi cách đọc nhãn hook để bỏ `--host`; không nới kiểm tra.
- Kết quả: `npm test` 313 checks, 0 failures (297 cũ + 16 mới); `npm run demo`, `npm run verify:cross-dir`, `claude plugin validate . --strict` xanh.
- Lệch so với plan: không có "bộ phát lại toàn bộ payload Claude hiện có", chỉ 7 trường hợp đại diện.

Chưa làm: S2–S10, và toàn bộ phần cần Codex (S0 đo, S3, S5–S7, S9b).
