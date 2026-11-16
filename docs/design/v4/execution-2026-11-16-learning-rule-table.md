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

## L1–L8 — kết quả

| Stage | Commit | Cổng | Kết quả |
|---|---|---|---|
| L1 định dạng, hash, lint, migrate | `feat(kernel): add the rule table format…` | `npm test` xanh, 12-layers xanh, migrate hai lần cùng cây | 3 rule `task-executor` thành 3 file; mỗi luật lint có fixture đỏ và xanh |
| L2 bộ chọn trong `order open` | `…choose the rules an order loads…` | receipt mang `kb_load_set`, hai lần chạy cùng `load_set`, `verify:cross-dir` xanh | `git diff --stat skills/*/SKILL.md` rỗng ở L2. Chỉ mục `.shapeup/_kb/index-*.json` **không làm** (chỉ là bộ nhớ đệm; lint và bộ chọn đọc cây trực tiếp, chưa thấy cần) |
| L3 `KbSignal` | `…failure-class vocabulary…` | mọi giá trị có nơi phát, test duyệt mã nguồn | 18 giá trị; guard lấy `PA3` từ enum |
| L4 `file` ở Retro Ownership | `…Retro Ownership file…` | test gate cũ không đổi kết quả | resolver đọc lại ledger và tính lại digest; ngưỡng chốt 2 do kernel tính |
| L5 reflector, order `learn` | `…reflect on every ending…` | fence chặn ngoài substrate; chỉ mục ghi bởi `order close` | thêm `kb evidence`, `kb apply`, `kb add`; golden `envelope/retired-operation` đổi đúng một chỗ (danh sách operation thêm `learn`) |
| L6 probation | `…promote, expire or retire…` | chuỗi không base rate không bao giờ thăng hạng | thêm trường `targets` (lớp lỗi rule nhắm tới) tách khỏi `when`: một rule điều kiện theo chính lớp lỗi chỉ nạp khi lớp lỗi đang có, nên không thể đo "lớp lỗi vắng" |
| L7 registry | `…closed-check registry…` | check không đổi gate/verdict | KB-TE-002 thành `check`, guide cũ `retired` |
| L8 tài liệu, 6.0.0 | `…document the rule table and release 6.0.0` | `npm test` 514 checks 0 failure; `claude plugin validate --strict` cả hai manifest; demo chạy lại không lệch | audit: không path nội bộ trong tập ship, không mã gate ngoài bảng, version khớp |

## Run thật với model (2026-11-16, phiên Claude Desktop của PO, dự án kiểm)

Sáu run `/ship` thật, đọc lại từ bản ghi của kernel trong `proj-shapeup-sdlc-plugin-testing`, không từ lời của loop:

| Run | Rule trong dự án | Kết thúc | Ghi nhận |
|---|---|---|---|
| `hello` | không có | `shipped`, PASS vòng 1 | khối Learning "không nạp rule nào"; Retro Ownership `skip`; 4 receipt `attestation: host`, model hỏi = model chạy |
| `wordcount` | 4 rule `active` (orient, qa-edge-hunter, 2 task-executor) | `shipped`, PASS vòng 1 | `kb_load_set` khác rỗng trên receipt orient, task-executor, qa-edge-hunter; spec-evaluator `null` (không có rule cho judge); 3 file biên dịch dưới `.shapeup/_kb/compiled/`; khối Learning liệt kê rule đã nạp |
| `contradiction` | 4 rule | `aborted` ở Intake & Config | reflect chạy trước `order close`, `candidates.json` rỗng, Retro Ownership `skip`, có hàng index; chưa order nào mở nên không nạp rule |
| `upper` | 4 rule | `shipped`, PASS vòng 1 | như `wordcount`, cùng `kb_load_set` (cùng rule, cùng set) |
| `noop` | 4 rule | `shipped`, PASS vòng 1 | ép `escalated` **không thành**: gate agent vẫn cho qua một board có việc kiểm tra; không có hunt (`skip`) |
| `orphan` | 4 rule | `shipped`, PASS vòng 1 trên kiểm tra tĩnh | ép `escalated` lần hai **không thành**: pitch cấm mọi call site; gate agent ghi "no call site by design" ở Orient, Wiring và Board Review (mỗi lần `Review first: yes`) và cho qua thay vì trả findings hay `abort`; QA `skip` |

Đã chứng minh bằng model thật: bộ chọn chạy trong `order open` và receipt ghi set đã chọn (L2); reflect chạy trước khi đóng ở hai kiểu kết thúc (`shipped`, `aborted`) và hàng index được ghi cho cả sáu run (L5, một phần); khối Learning có mặt trong cả năm ship report (L6, một phần, xem dưới).

Chưa đạt, nói thẳng:

- **Chưa có run `escalated` thật.** Ba lần ép (pitch tự mâu thuẫn, pitch không có gì để build, pitch cấm mọi call site) cho `aborted`, `shipped`, `shipped`: gate agent chọn nhận một bet hẹp hơn thay vì dừng. Quyết định dừng cần bằng chứng kernel (board 0 task, findings lặp lại, từ chối ở Ship Sign-off), mà model luôn tìm được cách làm cho bằng chứng đó không xảy ra. Kết thúc `escalated` mới chỉ được chạy bởi `verify:learning`, không bởi model.
- **"Ba run thật liên tiếp" chưa khớp chữ.** Năm ship report có Learning, nhưng chỉ bốn run (`wordcount`, `upper`, `noop`, `orphan`) nạp rule, và giữa `wordcount` với `upper` có một run `aborted` không có report.
- **Không run nào sinh lesson:** `classes` rỗng ở cả sáu hàng index, `candidates.json` rỗng ở cả sáu run. Lỗi EPIPE mà hunt báo ở hai run là phát hiện của hunt, không phải lớp lỗi do kernel ghi, nên không đủ làm bằng chứng. Vì vậy **chưa có rule nào do vòng học sinh ra từ một run thật**, chưa có rule probation nào, và `.shapeup/_kb/effect.jsonl` chưa tồn tại. Phần ghi rule, probation và retire chỉ được chứng minh bằng `verify:learning`.
- **Q6 chưa đo:** `usage.tokens_total` là `null` trên mọi receipt của sáu run, nên không tính được token của gate agent từ các bản ghi này.
- `rule_checks` không xuất hiện trong T0 ở `wordcount`/`upper`/`noop`: check chỉ báo khi có fixture phủ định thiếu bản đối chứng, và các fixture ở đó không có.

## Cái chưa làm được, nói thẳng

- **Lúc viết đợt đầu, không có phiên lồng thật với model (phần "Run thật" ở trên đã bù một phần).** `claude -p` từ trong phiên này trả `403 oauth_not_allowed_for_organization` (cả với câu lệnh `say ok`), nên các điều kiện "một phiên lồng thật" của L2, "hai run thật" của L5 và "ba run thật" của L6 **chưa được kiểm bằng model**. Thay bằng `npm run verify:learning` (`tools/verify-learning-loop.mjs`): tự đóng vai loop, chạy các verb kernel và hook thật trong một thư mục dự án thật (đã chạy trên `proj-shapeup-sdlc-plugin-testing`), hai kết thúc `shipped` và `escalated`. Nó chứng minh các bản ghi kernel và hook ghi là các bản ghi mà việc ghi rule đọc, và rule sinh ra ở run 1 được nạp ở run 2 rồi bị retire khi lớp lỗi quay lại. Nó **không** chứng minh một model làm theo `reflect.md`. Việc đó cần chạy `/ship` thật khi quyền gọi model có lại.
- Q6 (token gate agent) chưa đo, cùng lý do.
- Ba quyết định PO (§6) dùng giá trị đề xuất: ngân sách 2.000 (theo Q2, không phải 1.500), N = 3, M = 10, ngưỡng chốt 2 như plan, `_shared/` **chưa làm** (lint chấp nhận thư mục `_shared` cho rule nhiều reader, bộ chọn chỉ nạp được rule có đúng một reader dưới `<reader>/` và rule `_shared` có reader trong danh sách), fallback 5.x giữ hết dòng 6.x. Mục 6 của plan (HD cho PA3 ngay) chưa làm: PA3 giờ tự thành candidate khi lớp lỗi lặp lại.
- Xung đột `status` giữa máy (§5): chưa có `kb migrate --resolve-status`; thứ tự ưu tiên `retired` > `expired` > `active` > `probation` chưa mã hoá.
- Hai giới hạn đã biết của chốt 1: (a) một citation chỉ được kiểm là *tồn tại* trong ledger của kernel, không kiểm là *liên quan* tới lớp lỗi của candidate — lớp lỗi được xác nhận riêng bằng `runClasses`; (b) kết quả đánh giá (`evaluate-r*.json`, "verdict FAIL" của chốt 1) chưa là ledger được trích, nên lesson `eval.fail.*` và `qa.lens.*` hiện chỉ trích được một dòng metrics/trial/gate khác. Receipt không do host chứng thực (Codex) bị từ chối làm nguồn.
- Dự án kiểm: đã `git init` và một commit `seed` trong `proj-shapeup-sdlc-plugin-testing` (trước đó không phải repo); trạng thái tổng hợp của `verify:learning` đã được dọn.

## Chạy lại khi quyền gọi model có lại

```bash
cd ../proj-shapeup-sdlc-plugin-testing && claude -p "/shapeup-sdlc-plugin:ship shapeup/hello/pitch.md --max-rounds 2" --plugin-dir ../proj-shapeup-sdlc-plugin --permission-mode acceptEdits --model sonnet --max-budget-usd 25
```
