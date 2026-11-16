# Plan — knowledge base thành bảng rule do kernel chọn, rồi vòng tự học tự động trên đó

| | |
|---|---|
| **Ngày** | 2026-11-16 |
| **Baseline** | `227a018` (5.1.0) trên `main`. `npm test`: 364 checks, 0 failures, chạy 2026-11-16 trong phiên viết plan này. `npm run demo` và `claude plugin validate . --strict` **chưa chạy** — L0 chạy trước khi sửa bất cứ gì |
| **Nguồn** | [research-2026-11-16-rule-table-knowledge-base.md](research-2026-11-16-rule-table-knowledge-base.md) (gọi tắt **RT**) và [research-2026-11-15-self-learning-agents.md](research-2026-11-15-self-learning-agents.md) (gọi tắt **SL**) |
| **Mục tiêu** | (1) Knowledge base lưu mỗi rule một file, kernel chọn theo predicate lúc `order open`, trong một ngân sách nạp, và ghi lại tập đã nạp. (2) Trên nền đó, việc học trong run tự động hoàn toàn (D-L1): gate agent quyết ở Retro Ownership, năm chốt cơ học thay cho người duyệt, PO chỉ quan sát |
| **Nguyên tắc** | Bảng rule đi **trước** việc học tự động: từ lúc việc học tự ghi, mỗi máy là một người ghi, và file phẳng bắt đầu xung đột git (RT §3). Mọi con số ngân sách và ngưỡng ở đây là đề xuất cho tới khi L0 đo |
| **Quy tắc stage** | Một stage một commit, subject `type(scope): lowercase declarative`. Mỗi stage có **cổng go/no-go** là lệnh chạy được. Stage đỏ thì dừng; không sửa kiểm tra cho xanh. Số check của `npm test` không bao giờ giảm |
| **Phát hành** | 6.0.0 (major): đổi bố cục knowledge base, ý nghĩa `kb_rules_path`, và câu trả lời của một gate |
| **Trạng thái** | Đã làm L0–L8 trong code và tài liệu (xem [execution-2026-11-16-learning-rule-table.md](execution-2026-11-16-learning-rule-table.md)); **năm run thật đã chạy trong dự án kiểm (L2 đạt; L5 và L6 đạt một phần: chưa có run `escalated` thật, chưa có lesson nào do model sinh, Q6 chưa đo; xem execution)** |

Từ dùng ở đây. **Rule**: một file dưới `shapeup/knowledge-base/rules/`. **Tập nạp** (`load_set`): các rule kernel chọn cho một order. **File biên dịch**: một file gộp tập nạp, mà `payload.kb_rules_path` trỏ vào. **Reflector**: bước đọc ledger của run và viết candidate. **Chốt**: một trong năm cơ chế thay người duyệt (SL §3.2). Tên gate theo `AGENTS.md`.

## 1. Sự thật từ cây hiện tại

| # | Sự thật | Đọc ở |
|---|---|---|
| F1 | Worker nạp cả file `<reader>.md` qua `payload.kb_rules_path`; plan nạp bốn file ở mỗi bước, trong phiên của loop | `skills/building/resources/orders.md:61-66`, `skills/building/resources/guidance.md:12-14` |
| F2 | Kernel có `order open` và `order close`; bảng lệnh là `ROUTES` | `kernel/order.mjs:86`, `:93`; `kernel/harness.mjs:49` |
| F3 | Luật tầng: hooks → {hooks, shapeup, core}; shapeup → {shapeup, core}; core → core; core không được nêu tên Shape Up | `tests/structural/12-layers.mjs:37` |
| F4 | Enum có sẵn: `WorkerName`, `Operation`, `archetype`, `topology_type`; mười id gate | `kernel/schemas/domain.schema.json`; `kernel/shapeup/gates.mjs:14` |
| F5 | Không có từ vựng tín hiệu lỗi; `PA3` là một chuỗi trong hook | `hooks/sandbox-guard.mjs:402` |
| F6 | So glob với path đã có | `kernel/core/fence.mjs:12`, `:41` |
| F7 | Retro Ownership chỉ nhận `skip`; trong run luôn `skip`; run `escalated`/`aborted` bỏ retro | `kernel/shapeup/gates.mjs:28`; `skills/building/resources/retro/retro.md:24`, `:31` |
| F8 | Retro viết lại cả file KB; trần 15 rule | `retro.md:145`, `:230` |
| F9 | Knowledge base nằm ngoài luật tầng của fence | `hooks/sandbox-guard.mjs:258` |
| F10 | Close retire pointer của fence | `AGENTS.md`, mục Setup & Execution |
| F11 | KB hiện có 3 rule, tất cả `task-executor` | `shapeup/knowledge-base/task-executor.md` |
| F12 | 21 trace: attempt tối đa 1, L3 PASS round 1, PA3 36 dòng trên 12 trace | `traces/` (SL §3.1) |

## 2. Phạm vi

Trong plan:
- Định dạng file rule, chuẩn hoá, hash, đặt tên, lint, migration (RT §6.2–6.4, §7).
- Bộ chọn trong `order open`, file biên dịch, `load_set` trong order và receipt (RT §5, §6.5).
- Từ vựng tín hiệu `KbSignal` (RT §6.1).
- Câu trả lời `file` ở Retro Ownership, reflector, order learn, chạy ở mọi kết thúc (SL §3.2, chốt 1–4).
- Probation, đo hiệu quả rule, khối Learning trong ship report (SL §3.2 chốt 5; RT §6.6).
- Registry kiểm tra đóng và đường `guide` → `check` (RT §4).
- Tài liệu công khai và phát hành 6.0.0.

Ngoài plan:
- Tối ưu skill offline kiểu GEPA (SL S4) — plan riêng, sau khi có ≥ 10 run dữ liệu của L6.
- Đổi `/retro` thủ công: vẫn hỏi PO (D-f còn hiệu lực ngoài run); chỉ đổi cách nó ghi (mỗi rule một file).
- Kênh Codex: thiết kế không chặn Codex, nhưng không đo trên Codex ở đây. Trên Codex receipt là lời tự khai của worker, nên ở chốt 1 nó không được tính là dòng do kernel ghi.

## 3. Đồ thị phụ thuộc

```
L0 (đo) ─ L1 (định dạng + hash + lint + migration) ─ L2 (bộ chọn trong order open) ─┬─ L3 (KbSignal) ──────────┐
                                                                                     ├─ L4 (câu trả lời file) ─ L5 (reflector + order learn) ─ L6 (probation + đo hiệu quả) ─ L8 (docs + phát hành)
                                                                                     └─ L7 (registry check) ───────────────────────────────────────────────┘
```

L3, L4 và L5 cùng sửa `domain.schema.json` (L5 thêm một giá trị `Operation`), nên làm lần lượt, không đồng thời. L7 chạm T0 và không chạm schema của gate, nên chạy song song với L4–L6 được. L6 cần cả L3 (lớp lỗi để đo) và L5 (rule được ghi tự động).

## 4. Các stage

### L0 — Đo, không sửa gì

**Việc.** Chạy `npm test`, `npm run demo`, `claude plugin validate . --strict` (và cho `./.claude-plugin/marketplace.json`); ghi kết quả làm baseline. Rồi trả lời từng câu dưới đây bằng một script trong scratchpad (không commit script vào `tools/` trừ khi một stage sau cần nó).

| Mã | Câu hỏi | Stage phụ thuộc |
|---|---|---|
| Q1 | Với mỗi order trong 21 trace, khoá nào có sẵn lúc mở: `operation`, `round`, `attempt`, substrate, `archetype`, `topology_type`? Bao nhiêu order có ít nhất một khoá ngoài `reader`? | L2 có đáng làm không (RT §10) |
| Q2 | Dựng một kho tổng hợp ~200 rule rải trên các khoá Q1; chạy thuật toán RT §6.5 bằng script. Kích thước tập nạp trung vị và p95 là bao nhiêu token? | Ngân sách L2 |
| Q3 | Loop có đọc lại guidance plan ở mỗi bước trong bốn bước không? Đọc trong một trace có bước plan, hoặc trong văn bản activity | Áp lực cửa sổ loop (RT §3) |
| Q4 | Một order có substrate chỉ là `shapeup/knowledge-base/rules/**` có được fence chặn ghi ra ngoài không? Bắn `hooks/sandbox-guard.mjs` với một order như vậy và hai payload ghi (trong và ngoài) | L5 order learn |
| Q5 | `kernel/gate.mjs` có nhận một dòng Retro Ownership trên run `escalated`/`aborted`, và sau `order close` không? Chạy trên dự án rác | L4, L5 |
| Q6 | Token thực của một lần gate agent ở Retro Ownership hôm nay (`skip`) | Chi phí L5 |

**Done khi.** Một file `execution-2026-11-16-learning-rule-table.md` cạnh plan này có Q1–Q6, mỗi dòng có lệnh và kết quả.

**Cổng go/no-go.**

| Kết quả | Quyết định |
|---|---|
| Q1 ≥ 80% order có khoá ngoài `reader`, và Q2 trung vị ≤ ngân sách | **Go** L1–L8 như viết |
| Q1 < 80% | **Go** L1 (mỗi rule một file vẫn đáng làm vì git); L2 chỉ làm bộ chọn tối thiểu (reader + operation), hoãn khoá khác |
| Q4 ra "fence không chặn" | L5 phải ghi KB trước `order close` bằng một cơ chế khác; dừng và viết lại L5 trước khi tiếp |
| Q5 ra "resolver từ chối sau close" | L5 đặt Retro Ownership trước `close` ở cả ba kết thúc (đã là thiết kế); ghi lại, không đổi resolver |

### L1 — Định dạng rule, hash, lint, migration

**Việc.**
- **Cơ chế trung tính** ở `kernel/core/` (không nêu tên Shape Up, theo F3): đọc frontmatter dạng `key: value` với giá trị phức là JSON một dòng; chuẩn hoá (UTF-8, CRLF → LF, bỏ khoảng trắng cuối dòng, gộp dòng trống, trim; khoá `when` sắp xếp, danh sách sắp xếp, `JSON.stringify` không khoảng trắng); hàm hash `sha256` cắt ngắn; khớp predicate (AND giữa khoá, OR trong danh sách, khoá vắng = mọi giá trị).
- **Dữ liệu Shape Up** ở `kernel/shapeup/`: danh sách reader và mã reader (`te`, `or`, `qa`, `pl`, `bu`), các khoá hợp lệ của `when` lấy từ enum trong schema (không chép tay), luật lint.
- **Đặt tên và hash** theo RT §6.4: `id` = mã reader + 8 hex của hash thân lúc tạo, cố định; `rev` = 12 hex của hash (reader, kind, when, thân), không gồm `status`; tên file `<id>.<slug>.md`.
- **Lint** (`kb lint`, thêm vào `ROUTES` ở `kernel/harness.mjs:49`): frontmatter hỏng là lỗi, không lặng lẽ nạp như rule không điều kiện; khoá `when` không có trong enum là lỗi; hai rule cùng `rev`; quá 3 rule `active` cùng chữ ký `when`; thân quá ~120 từ; path `.shapeup/`, id `TASK-NNN`, lệnh shell, URL trong thân; từ của câu trả lời gate dạng mệnh lệnh; rule cho `spec-evaluator` hay census; id trùng.
- **Migration** (`kb migrate`): tách mỗi file cũ — `<reader>.md` và các tên cũ trong `guidance.md` — tại mỗi `- **KB-`; mỗi phần thành một file, `when` rỗng, `status: active`, id cũ vào `aliases`; bỏ qua nếu alias đã có; không xoá file cũ.
- Chạy migration trên chính repo này: 3 rule `task-executor` thành 3 file.

**Done khi.**
- `npm test` xanh, số check tăng.
- Test mới `tests/structural/18-kb-format.mjs`: cùng nội dung khác cách xuống dòng ra cùng `rev`; sửa thân đổi `rev` nhưng không đổi `id`; đổi `status` không đổi `rev`; migration chạy hai lần ra cùng cây (so hash thư mục); mỗi luật lint có một fixture đỏ và một fixture xanh.
- `node kernel/harness.mjs kb lint` xanh trên cây của repo sau migration.
- `12-layers` xanh.

**Cổng.** Một fixture lint đỏ mà lint không bắt → dừng, sửa lint. `12-layers` đỏ → dời file theo luật, không sửa luật.

### L2 — Bộ chọn trong `order open`

**Việc.**
- `order open` gọi bộ chọn trước khi bật fence. Thuật toán RT §6.5: reader → bỏ `retired` → predicate → xung đột (`overrides`, rồi độ cụ thể) → tách loại (`check` sang kernel, `ask` sang khối gate, `guide` đi tiếp) → xếp hạng (độ cụ thể, `active` trước `probation`, rồi `id`) → ngân sách → biên dịch.
- Chính sách chọn từng reader là một strategy trong `kernel/shapeup/`: `task-executor` (operation, substrate, round, attempt), `orient` (archetype), `qa-edge-hunter` (archetype), `plan` (bước), `building` (gate).
- **`building` không đi qua `order open`**: rule của nó được đọc ở Intake & Config (`skills/building/resources/intake/open-run.md:41`), và rule `ask` gắn vào các gate được trả lời bằng `gate --resolve`. Điểm vào kernel của nó là `init run`: lệnh này biên dịch một file `building` có một mục cho mỗi gate, ghi `load_set` vào launch record, và gate agent đọc mục của gate đang trả lời. `gate --resolve` ghi `load_set` của `building` vào dòng gate.
- File biên dịch `.shapeup/_kb/compiled/<load_set>.md`, thứ tự cố định, đầu file ghi `load_set` và danh sách rule vượt ngân sách (id + tiêu đề). Dùng lại nếu đã có.
- `payload.kb_rules_path` trỏ vào file biên dịch; `kb_rules_paths` của plan gộp về một file. Thêm `kb_load_set` vào order (schema).
- `hooks/dispatch-receipt.mjs` ghi `kb_load_set` vào dòng receipt.
- Chỉ mục `.shapeup/_kb/index-<kb_root>.json`, gitignored, tái tạo khi `kb_root` đổi.
- Fallback: không có thư mục `rules/<reader>/` thì giữ hành vi cũ (trỏ cả file), in một dòng.
- Ngân sách ban đầu 1.500 token, hoặc giá trị L0 Q2 đề xuất.

**Done khi.**
- Test mới `tests/structural/19-kb-select.mjs`: cùng order hai lần ra cùng `load_set` và cùng file biên dịch byte-for-byte; ngân sách không bao giờ vượt trên kho tổng hợp của L0; rule có `when: {"operation": ["fix"]}` không vào order `execute`; rule `retired` không bao giờ vào; repo không có `rules/` vẫn chạy như 5.1.0.
- Không `SKILL.md` nào của worker thay đổi (`git diff --stat skills/*/SKILL.md` rỗng, trừ `building`).
- **Kiểm chéo thư mục**: `npm run verify:cross-dir` xanh (stage này chạm `hooks/`).
- **Một phiên lồng thật**: `claude -p --plugin-dir <repo> --permission-mode acceptEdits` trên một dự án rác, một run nhỏ; mọi dòng receipt có `kb_load_set`; `decisions.jsonl` có dòng của fence.

**Cổng.** Receipt thiếu `kb_load_set` → dừng: hook không nạp hoặc không đọc được, tức là fail-open âm thầm. `load_set` khác nhau giữa hai lần chạy cùng order → dừng.

### L3 — Từ vựng tín hiệu `KbSignal`

**Việc.**
- Enum `KbSignal` trong `domain.schema.json`, dẫn xuất từ nơi kernel thực sự phát ra: `pathology.PA3`, `t0.regressed`, `t0.flat`, `eval.fail.<dimension>`, `qa.lens.<lens>`, `round.ge2`, `attempt.ge2`. Mỗi giá trị kèm nơi phát ra; giá trị không có nơi phát ra thì không thêm.
- Sáu lens QA đang chỉ có trong văn xuôi: đưa vào schema làm enum, và cho `skills/qa-edge-hunter/SKILL.md` dẫn chiếu enum đó.
- Hằng `PA3` trong `hooks/sandbox-guard.mjs:402` đọc từ enum, không còn là chuỗi rời.
- Khi mở một order `fix` hay một round ≥ 2, kernel dựng tập tín hiệu từ `digested_errors`, `trial_history`, verdict trước và metrics; khoá `signal` trong `when` khớp với tập đó.

**Done khi.**
- Test mới `tests/structural/20-kb-signal.mjs`: một order `fix` sau T0 regression nạp rule có `signal: ["t0.regressed"]`; cùng rule không vào order `execute` round 1; một `signal` không có trong enum làm lint đỏ.
- Mọi giá trị enum có ít nhất một nơi phát ra (test duyệt mã nguồn).

**Cổng.** Một giá trị enum không nơi nào phát ra → bỏ giá trị đó, không giữ "để dành".

### L4 — Câu trả lời `file` ở Retro Ownership

**Việc.**
- `kernel/shapeup/gates.mjs:28`: `"COACH-1": ["skip", "file"]`.
- Quy tắc bằng chứng (cùng kiểu `ship` cần census): `file` chỉ hợp lệ khi file candidate của run tồn tại và có ít nhất một candidate qua chốt 1. **Resolver tự kiểm, không tin lời người viết candidate**: mỗi candidate trích các dòng dưới dạng `{ledger, run_id, row_digest}`; resolver đọc lại chính các ledger do kernel ghi (metrics, `t0/trials.jsonl`, `gates.jsonl`, receipts), tính lại digest, và chỉ giữ candidate có trích dẫn khớp. Câu trả lời không bao giờ tự mang bằng chứng làm nó hợp lệ (`AGENTS.md`, mục The gate resolver). Không còn candidate nào thì thu hẹp về `skip` và ghi lý do.
- `skills/gate-agent/SKILL.md:40`: dòng Retro Ownership — đọc candidate, quyết `file` hay `skip`, với mỗi candidate chọn reader hoặc `harness-defect`; **phân vân thì `harness-defect`**; baseline vào decision log.
- Bảng "Gate names" của `AGENTS.md` không đổi id; chỉ đổi cột "What it checks" nếu cần (cùng commit, theo `CLAUDE.md`).

**Done khi.**
- `tests/structural/06-gate.mjs` thêm: `file` không có candidate bị thu hẹp về `skip`; `file` có candidate được ghi; `skip` vẫn hợp lệ.
- `harness-maintenance-audit` không báo gate lệch.

**Cổng.** Một test gate cũ đổi kết quả → dừng.

### L5 — Reflector và order learn, ở mọi kết thúc

**Việc.**
- Activity mới dưới `skills/building/resources/retro/` (một file `reflect.md`), theo quy trình 3 bước trong `CLAUDE.md`: bốn dòng hợp đồng → dòng trên index của `building` → phase hoặc sub-command dẫn tới nó.
- Thứ tự mới của phase 15 trong `skills/building/SKILL.md`, **trước** `order close`, ở cả ba đường (`shipped`, `escalated`, `aborted`):
  1. reflector đọc ledger của run và chỉ mục xuyên run, viết candidate;
  2. Retro Ownership cho gate agent;
  3. nếu `file`: mở order learn, substrate `shapeup/knowledge-base/rules/**` và `shapeup/knowledge-base/harness-defects.md`;
  4. ghi theo delta (`ADD`, `EDIT`, `MERGE`, `RETIRE`), rule mới với `status: probation`;
  5. `kb lint`; đỏ thì không ghi, ghi lý do vào decision log;
  6. `order close`.
- **Chốt 1** — xếp hạng bằng chứng: chỉ dòng của metrics, receipts, `t0/trials.jsonl`, `gates.jsonl`, verdict FAIL được đề cử; discovery ledger, QA finding, decision log chỉ hỗ trợ; pitch và nội dung `/retro --research` không bao giờ là nguồn.
- **Chốt 2** — ngưỡng: lớp lỗi ở ≥ 2 run, hoặc tốn ≥ 1 attempt. Chỉ mục xuyên run `.shapeup/_learning/index.jsonl`, một dòng mỗi run (lớp lỗi, số lần, slug, ngày), sống sót qua việc xoá trace. **Do `order close` ghi**, từ chính các ledger của kernel — không phải loop hay reflector, để con số ngưỡng không phải là lời của bên hưởng lợi.
- Order learn cần một giá trị `Operation` mới (`learn`) trong schema; bài kiểm tra ba-chiều của `npm test` đọc activity đối chiếu với các operation của schema.
- `retro.md:24`, `:31`, `:145` sửa theo; `/retro` thủ công ghi mỗi rule một file và vẫn hỏi PO.
- Fence **không** bảo vệ được metrics, receipts, trials khỏi gate agent hay reflector: lệnh shell ghi xuyên qua fence (`AGENTS.md`, mục Setup & Execution). Bảo vệ đến từ việc kiểm trích dẫn ở L4: một dòng ledger bị sửa thì digest không khớp, và một dòng không do hook hay lệnh kernel ghi thì không có trong ledger mà resolver đọc lại.

**Done khi.**
- Test structural: activity mới có hợp đồng, có dòng index, có phase dẫn tới (bài kiểm tra ba-chiều sẵn có của `npm test`).
- Test mới: một candidate chỉ có nguồn là pitch bị loại trước gate; một candidate PA3 có dòng metrics đi tới gate; một candidate trích một dòng metrics đã bị sửa tay bị resolver loại; dòng chỉ mục xuyên run chỉ xuất hiện sau `order close`.
- **Hai run thật** trong phiên lồng: một đóng `shipped`, một bị ép đóng `escalated`. Cả hai để lại: dòng Retro Ownership `agent:gate-agent`, mục decision log có baseline, và hoặc một file rule mới qua lint, hoặc một mục `HD-NNN`, hoặc `skip` có lý do.
- Fence: trong order learn, ghi ra ngoài `shapeup/knowledge-base/` bị chặn và có dòng trong `decisions.jsonl`.

**Cổng.** Run `escalated` không có dòng Retro Ownership → dừng. Một ghi KB không đi qua lint → dừng.

### L6 — Probation và đo hiệu quả

**Việc.**
- Bộ đếm hiệu quả `.shapeup/_kb/effect.jsonl`, gitignored: mỗi run, với mỗi rule trong các `load_set` của run, ghi lớp lỗi rule nhắm tới (`signal` của nó) có xảy ra không, và điều kiện kích hoạt có mặt không.
- **Chốt 5** — thăng hạng `probation` → `active` khi đủ cả ba: lớp lỗi có base rate trước khi có rule (≥ 2 run); rule được nạp trong ≥ N run có điều kiện kích hoạt; lớp lỗi không tái diễn trong các run đó. Không base rate → hết hạn sau M run. Tái diễn khi đã nạp → `RETIRE` và một mục `HD-NNN`.
- Khối **Learning** ở đầu `REPORT.md` (`skills/building/resources/ship/report.md`): rule thêm, thăng hạng, hết hạn, RETIRE, mỗi cái kèm bằng chứng — mô tả bằng chữ, không trỏ ledger (luật tầng).
- Thăng hạng và RETIRE là một thay đổi `status` trong file rule; không ghi bộ đếm vào file commit.

**Done khi.**
- Test mới `tests/structural/21-kb-probation.mjs`: một chuỗi run tổng hợp **không có** lớp lỗi → rule không bao giờ thăng hạng và hết hạn sau M run (đây là test của lỗ hổng SL §3.2: kiểm tra không được qua khi thứ nó đo vắng mặt); chuỗi có base rate rồi hết tái diễn → thăng hạng; chuỗi tái diễn → RETIRE và có HD.
- Ba run thật liên tiếp: khối Learning có trong mọi `REPORT.md`.

**Cổng.** Rule thăng hạng trên chuỗi không base rate → dừng.

### L7 — Registry kiểm tra đóng

**Việc.**
- Registry trong `kernel/shapeup/`: mỗi kiểm tra là một strategy có tên, tham số có schema, thông báo lỗi viết như chỉ dẫn sửa cho worker.
- Kiểm tra đầu tiên từ KB-TE-002: một fixture có điều kiện qua là "lệnh này thất bại" phải xác nhận cả hai chiều.
- Rule `kind: check` gọi tên kiểm tra và truyền tham số; không chứa code. Kernel chạy các `check` của tập nạp cùng T0; kết quả là finding gửi worker, không bao giờ quyết gate.
- Đường chuyển: một `guide` `active` có `check` tương ứng được thay bằng `check`, `guide` cũ `RETIRE`.
- Kiểm tra mới chỉ đến qua bản phát hành; lint từ chối `check` gọi tên không có trong registry.

**Done khi.**
- Test mới: `check` báo trên fixture vi phạm, im trên fixture đúng, không thêm byte nào vào file biên dịch khi im; `check` gọi tên lạ làm lint đỏ.
- KB-TE-002 của repo được chuyển thành `check`.

**Cổng.** `check` làm đổi kết quả một gate → dừng (guidance never decides a gate).

### L8 — Tài liệu công khai và phát hành 6.0.0

**Việc.**
- `AGENTS.md` (khối harness: mục Retro, các chỗ nói về knowledge base, mục Setup), `skills/gate-agent/SKILL.md` (đã đổi ở L4), `skills/qa-edge-hunter/SKILL.md` (đã đổi ở L3), `skills/building/resources/guidance.md`, `retro.md`, `scan.md`, `research.md`, `orders.md`, `intake/open-run.md`, `commands/retro.md`, `docs/upgrading.md` (migration 5.x → 6.0.0), `README.md` nếu nói về knowledge base, `CHANGELOG.md`.
- `package.json` và `.claude-plugin/plugin.json` lên 6.0.0 trong cùng commit.
- Installer và `/shapeup-sdlc-plugin:init` chạy `kb migrate`.

**Done khi.**
- `npm test` xanh; `claude plugin validate . --strict` xanh cho cả hai manifest; `npm run demo` chạy lại không lệch.
- `harness-maintenance-audit` sạch cả hai lượt (tài liệu khớp artifact; không có bookkeeping lọt vào tập ship).
- `npm run verify:cross-dir` xanh; một phiên lồng thật để lại `kb_load_set` trên receipt và dòng fence trong `decisions.jsonl`.
- Migration trên một dự án consumer có file 5.x: chạy hai lần, không nhân bản, file cũ còn nguyên.

**Cổng.** Tài liệu công khai nhắc một path vào `docs/`, `tests/`, `tools/`, hoặc một id nội bộ → dừng.

## 5. Rủi ro

| Rủi ro | Dấu hiệu | Giảm thiểu |
|---|---|---|
| Bộ chọn không nạp được hoặc crash, fail-open âm thầm | Receipt thiếu `kb_load_set` | Cổng L2; fallback in một dòng; phiên lồng thật ở L2 và L8 |
| Predicate không lọc được gì vì order thiếu khoá | L0 Q1 < 80% | Bộ chọn tối thiểu; lợi ích git vẫn còn |
| Frontmatter hỏng biến rule có phạm vi thành rule nạp mọi nơi | Rule xuất hiện trong mọi `load_set` | Lint coi frontmatter hỏng là lỗi, không phải "không điều kiện" |
| Rule độc vào KB qua nội dung pitch hay web | Rule mới không có dòng kernel đề cử | Chốt 1 ở L5; test pitch-only |
| Loop hay reflector tự viết bằng chứng (sửa ledger bằng shell, ghi khống chỉ mục) | Candidate qua gate mà trích dẫn không khớp ledger | Resolver đọc lại ledger và tính lại digest (L4); chỉ mục do `order close` ghi (L5) |
| Thăng hạng cho không vì lớp lỗi vốn không xảy ra | Rule `active` khi base rate = 0 | Test L6 trên chuỗi không base rate |
| Xung đột git trên `status` | Bộ đếm là theo máy: máy A thăng hạng một rule trong khi máy B cho nó hết hạn hoặc RETIRE — cùng một dòng, hai giá trị | Thứ tự ưu tiên cố định `retired` > `expired` > `active` > `probation`; `kb lint` chỉ ra dòng xung đột và giá trị thắng, `kb migrate --resolve-status` ghi giá trị thắng. Xung đột vẫn xảy ra, nhưng một máy giải được mà không cần phán đoán |
| Chi phí token của reflector và gate agent mỗi run | L0 Q6 | Đo trước; reflector chỉ đọc ledger, không đọc code |
| Consumer mất rule khi nâng cấp | Rule cũ không có file mới | Migration không xoá; fallback đọc file cũ khi chưa có `rules/<reader>/` |
| Kênh Codex: receipt là lời tự khai | Chốt 1 tính receipt là bằng chứng kernel | Trên Codex, receipt không đề cử được; ghi trong `AGENTS.md` |

## 6. Quyết định cần PO

1. **Ngân sách nạp mỗi order.** *Đề xuất: 1.500 token, chỉnh theo L0 Q2.*
2. **N và M của probation** (số run để thăng hạng, số run để hết hạn). *Đề xuất: N = 3, M = 10.*
3. **Ngưỡng chốt 2.** *Đề xuất: ≥ 2 run hoặc ≥ 1 attempt.*
4. **Thư mục `_shared/`** cho rule nhiều reader, hay nhân bản một file mỗi reader. *Đề xuất: `_shared/` — một bài học, một danh tính.*
5. **Bao lâu thì bỏ fallback đọc file 5.x.** *Đề xuất: giữ hết dòng 6.x, bỏ ở 7.0.0.*
6. **PA3 ngay bây giờ**, trước cả plan: ghi vào `harness-defects.md` như một HD. *Đề xuất: có — đó là việc mà mặc định của chốt 5 sẽ làm khi cơ chế có.*

## 7. Cái gì sẽ đổi câu trả lời

- L0 Q1 cho thấy order gần như chỉ có khoá `reader`: L2 thu về bộ chọn tối thiểu; L3 trở thành stage đáng giá nhất vì `signal` là khoá duy nhất phân biệt được order.
- L0 Q4 ra "substrate không gọi tên được knowledge base": L5 cần một cơ chế ghi khác, và plan dừng ở L4 cho đến khi có thiết kế mới.
- Hai run thật ở L5 không sinh candidate nào qua chốt 1–2: vòng học chạy đúng nhưng chưa có gì để học. Không nới ngưỡng; chạy pitch khó hơn.
- Claude Code thêm khoá ngoài path cho `.claude/rules/` và ghi lại rule đã nạp: xem lại L2 cho kênh Claude Code; kênh Codex vẫn cần bộ chọn của kernel.
