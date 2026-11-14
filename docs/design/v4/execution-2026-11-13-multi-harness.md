# Execution — multi-harness plan (S0)

| | |
|---|---|
| **Ngày** | 2026-11-14 |
| **Baseline** | `e2ec76a` trên `main`, cây sạch |
| **Trạng thái** | PO yêu cầu bỏ qua kiểm tra Codex CLI (2026-11-14). Cổng S0 **không được đo**; các stage không cần số đo đã làm theo đề xuất mặc định của mục 7. Xem "Tổng kết" cuối file |

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

## Tổng kết (2026-11-14, sau khi PO bỏ qua kiểm tra Codex)

Commit `a841766` (code, test, tài liệu) và `8e93142` (5.1.0). `npm test` 355 checks, 0 failures; `npm run demo`, `npm run verify:cross-dir` (cả `--host codex`), `claude plugin validate` cho cả hai manifest đều xanh.

| Stage | Trạng thái | Ghi chú |
|---|---|---|
| S0 | **bỏ qua theo lệnh PO** | M1–M12, M15–M18 không đo. Fixture trong `tests/fixtures/codex/` là hình dạng theo tài liệu, **không phải bản ghi** (README cạnh chúng nói vậy) |
| S1 | xong | `kernel/core/host.mjs`; phát lại 7 payload qua `70e1818`, không phải toàn bộ |
| S2 | xong, theo phương án mặc định | `init --target codex` kết xuất hai file có `${CLAUDE_PLUGIN_ROOT}` với đường dẫn runtime tuyệt đối, kèm dấu version; `--check` bắt lệch version. Không kiểm M9 |
| S3a, S3b | xong, chưa đo | Bộ đọc `apply_patch` (nhiều file, xóa, đổi tên) và lệnh shell (`bash -lc <script>`) |
| S3c, S3d | **chưa làm** | Receipt và attestation trên Codex, cổng envelope ở thời điểm spawn: cần M4/M5/M6. Chưa wired; `SECURITY.md` và `AGENTS.md` nói rõ |
| S4 | xong, theo đề xuất số 2 | Id ngoài họ Claude phải có trong bảng (`deepseek-v4-pro`, `gpt-5` không mini) hoặc `--accept-unranked-models`; launch record có `host` và `acceptUnrankedModels`. Bảng tier là quyết định tạm, PO chưa duyệt |
| S5 | **chưa làm** | Cấu hình chạy không người trên Codex cần M10 và quyết định số 3 và 8 |
| S6a | xong | `bin/lib/steps/`, `bin/lib/targets/`; cây file giống từng byte với `70e1818` (lần cài thứ hai cũng giống; khối `AGENTS.md` chuyển lên đầu ở lần cài thứ hai, như bản cũ vẫn làm) |
| S6 | xong, theo phương án A | Runtime ở `~/.shapeup-sdlc/<version>/`, cấu hình mức người dùng, `--home` để đổi chỗ. Không kiểm M11 (tin cậy hook) nên chỉ in cảnh báo |
| S7 | xong | `ship` và `retro` thành skill; cờ đi qua dòng đầu (M8 chưa đo). Lượt `codex exec` thật chưa chạy |
| S8 | xong | Bảng "Enforcement by host" trong `AGENTS.md`, `SECURITY.md`, `README.md`, `docs/install.md`; audit chạy, không có drift mới |
| S9, S9b | **chưa làm** | Cần khóa DeepSeek và quyết định số 9. Chỉ có bảng tier và cờ ở S4; README nói chưa có run nào đo được |
| S10 | xong phần có thể | Version 5.1.0 ở cả hai file, CHANGELOG, `verify-cross-dir --host codex`. Test phát lại fixture Codex nằm trong `16-codex-adapter.mjs` |

Quyết định PO được dùng mặc định theo đề xuất: số 2 (từ chối id chưa xếp hạng), số 4 (một khối có bảng), số 6 (không đổi cổng; chưa có nhãn attestation vì S3c chưa làm), số 7 (phương án A).

## Còn lại, cần Codex thật hoặc khóa DeepSeek

S0 đo M1–M12 và M15–M18 và thay fixture bằng bản ghi; S3c/S3d; S5; M13/M14, S9, S9b.
