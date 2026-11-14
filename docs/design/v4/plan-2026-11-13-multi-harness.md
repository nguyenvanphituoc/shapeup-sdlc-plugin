# Plan — đưa plugin sang harness khác: Codex CLI (OpenAI) và model DeepSeek

| | |
|---|---|
| **Ngày** | 2026-11-13 |
| **Baseline** | `70e1818` (5.0.3) trên `main`; plan viết lúc `26cc9a4`, hai commit này chỉ khác file version và `CHANGELOG.md`, nên hook và kernel giống nhau. `npm test`: 297 checks, 0 failures, chạy 2026-11-13 trong phiên viết plan này. `npm run demo` và `claude plugin validate . --strict` **chưa chạy** — S0 chạy hai lệnh đó trước khi sửa bất cứ gì |
| **Mục tiêu** | Hai kênh phân phối mới. (1) **DeepSeek**: chạy plugin hiện tại trên model DeepSeek, giữ Claude Code làm harness. (2) **OpenAI**: chạy plugin trên Codex CLI, giữ được càng nhiều trong năm thứ runtime cưỡng chế càng tốt, và nói thẳng thứ nào mất |
| **Nguyên tắc** | Mọi năng lực của Codex và DeepSeek dưới đây là **"có trong tài liệu, chưa đo"** cho đến khi S0 đo bằng một phiên thật. Plan này không dựa vào tài liệu để quyết định một stage nào qua cổng S0 |
| **Quy tắc stage** | Một stage một commit. Mỗi stage có **cổng go/no-go** là lệnh chạy được, không phải mô tả. Một stage đỏ thì dừng ở đó, không sửa kiểm tra cho xanh |
| **Trạng thái** | Chưa thực hiện. Chưa có stage nào được PO duyệt |

Từ dùng ở đây. **Kênh**: một đích cài đặt (harness + model). **Adapter**: lớp dịch payload hook của một harness sang dạng trung tính mà logic của hook đọc. **Receipt**: dòng ghi lại một lần dispatch. Tên cổng (Round Close, Ship Sign-off, …) theo `AGENTS.md`.

## 1. Cái gì mang đi được, đọc từ cây hiện tại

| # | Sự thật | Đọc ở |
|---|---|---|
| F1 | Executable là Node ESM thuần, không phụ thuộc, không mạng; lõi (`kernel/core/*.mjs`) nhận dữ liệu qua tham số | `kernel/core/`, `CLAUDE.md` |
| F2 | **Bốn** mục hook, không phải ba: `safety-spine`, `sandbox-guard`, `dispatch-receipt`, và kiểm tra envelope `kernel/harness.mjs verify envelope` trên `Skill|Agent` (cổng "dispatch không có WorkOrder hợp lệ bị từ chối"). Cả bốn đọc payload Claude Code trực tiếp: `tool_name` ∈ {`Edit`,`Write`,`MultiEdit`,`Bash`,`Read`,`Skill`,`Agent`}, `tool_input.file_path` / `edits[]`, và (receipt) `tool_response.agentType` / `resolvedModel` / `totalTokens` / `totalDurationMs` | `hooks/hooks.json`, `hooks/sandbox-guard.mjs:64`, `hooks/safety-spine.mjs:30`, `hooks/dispatch-receipt.mjs:71`, `kernel/verify/envelope.mjs` |
| F12 | Luật tầng: hook → {hook, shapeup, core}; `kernel/shapeup` và `kernel/verify` → {shapeup, core}; **không bao giờ ngược lại**; `kernel/core/` không được nêu tên Shape Up. Verifier envelope nằm ở tầng `shapeup` nên không được import từ `hooks/` | `tests/structural/12-layers.mjs`, `tests/structural/layers-expected.json` |
| F3 | Từ chối bằng `hookSpecificOutput.permissionDecision:"deny"` | `hooks/sandbox-guard.mjs:65` |
| F4 | `sandbox-guard` làm **hai việc**: trích đường dẫn ghi, và quét **nội dung** ghi vào (`committedTierLeaks`: đường dẫn run-trace, id `TASK-NNN`) | `hooks/sandbox-guard.mjs:305` |
| F5 | Bằng chứng "skill đóng gói đã chạy" = tên agent trong `tool_response.agentType`, vì định nghĩa agent nạp sẵn skill (`skills:` trong `agents/*.md`). Dispatch lỗi **không để lại dòng nào** (đã đo trên Claude Code) | `hooks/dispatch-receipt.mjs:1-60`, `agents/task-executor.md` |
| F6 | `model_requested` lấy từ `tool_input.model`; `null` nghĩa là "kế thừa". Ship Sign-off đọc `usage.model` so với launch record | `hooks/dispatch-receipt.mjs:47,207` |
| F7 | *(đã sửa sau khi kiểm với code)* Model floor là denylist **theo tên tầng rẻ, không riêng Claude**: `haiku`, `instant`, `mini`, `nano`, `lite`, `small`. Id lạ được cho qua có chủ đích, nên `deepseek-flash` và `deepseek-v4-pro` lọt qua mà không được xếp hạng; `gpt-5-mini` đã bị từ chối. Mặc định `sonnet`; `qa` theo `exec` | `kernel/shapeup/floor.mjs:9-14` (dữ liệu), `kernel/core/floor.mjs` (cơ chế nhận mẫu qua tham số), `kernel/init/run.mjs:46,116-118` |
| F8 | `${CLAUDE_PLUGIN_ROOT}` nằm trong **nội dung skill** (`skills/building/SKILL.md:44,103`, `skills/building/resources/intake/open-run.md:50,98`) và mô tả schema. Claude Code mở rộng nó lúc nạp skill; work order mang đường dẫn kernel tuyệt đối riêng | `bin/lib/grant.mjs` (chú thích), `kernel/schemas/work-order.schema.json:27` |
| F9 | Grant quyền là hai rule `permissions.allow` của Claude Code; installer phát hiện workspace chưa tin cậy qua `~/.claude.json` | `bin/lib/grant.mjs:110` |
| F10 | `commands/` chỉ có `ship.md`, `retro.md`; chúng gọi skill `building` | `commands/` |
| F11 | `files` trong `package.json` đã trung lập với harness; `npx shapeup-sdlc init` là cửa vào chung | `package.json`, `bin/init.mjs` |

## 2. Cái Codex cho, theo tài liệu OpenAI (đọc 2026-11-13, chưa đo)

Nguồn: `learn.chatgpt.com/docs/...` (các URL `developers.openai.com/codex/...` chuyển hướng 308 về đó). Không trang nào ghi ngày hay phiên bản Codex. Nửa sau trang hook chỉ đọc được qua bản tóm tắt do công cụ tóm, không phải nguyên văn.

| Cần | Tài liệu nói | Hệ quả cho plan |
|---|---|---|
| Hook chặn được | `PreToolUse` chặn bằng exit code 2 hoặc `hookSpecificOutput.permissionDecision:"deny"`; trang tự gọi hook là "a useful guardrail, not a complete enforcement boundary" | Cưỡng chế yếu hơn Claude Code về nguyên tắc; S0 đo |
| Ghi file | `apply_patch` khớp matcher `Edit` hoặc `Write` | Đầu vào là patch, không phải `file_path` — cần bộ trích mới (S3) |
| Spawn sub-agent | `spawn_agent` khớp matcher `Agent`; có `SubagentStart`, `SubagentStop` | Đường dispatch hookable |
| Gọi skill, đọc file | Không nói | Mặc định **không hookable** tới khi đo |
| Payload | Có `model` ở mọi sự kiện; `token_usage` chỉ ở `PostModelRequest`; không có thời lượng | Receipt phải ghép nhiều sự kiện |
| Hook lỗi / quá giờ | Không nói rõ; với hook MCP "không chặn" | Mặc định coi là **fail-open**; S0 đo |
| Biến root plugin | `PLUGIN_ROOT`, và `CLAUDE_PLUGIN_ROOT` để tương thích — nhưng chỉ cho hook đóng gói trong plugin | Không có cho nội dung skill (F8) |
| Hook trong plugin | Chỉ chạy với plugin cài thủ công trong ứng dụng desktop; plugin có hook **không đủ điều kiện vào thư mục công khai** | Đường phân phối là `init` ghi `.codex/hooks.json` |
| Tin cậy | Hook dự án chỉ nạp khi lớp `.codex/` được tin cậy; hook không quản lý phải được duyệt | Thất bại im lặng — cần phát hiện (S6) |
| Sub-agent | TOML trong `.codex/agents/` (`name`, `description`, `developer_instructions` bắt buộc; `model`, `model_reasoning_effort` tùy chọn); không có trường nạp skill, không có `tools`; kế thừa sandbox và approval của parent; cần approval mới trong chạy không tương tác thì **lỗi trả về parent** | S3 (attestation) và S5 (chạy không người) |
| Model theo lần spawn | "Yêu cầu trong prompt", ghi đè `agents.default_subagent_model`; không phải tham số cứng | `model_requested` sẽ gần như luôn `null` |
| Skill | `SKILL.md` với `name`, `description`; tìm ở `.agents/skills` từ cwd lên gốc repo, `$HOME/.agents/skills`; gọi bằng `$tên` hoặc `/skills`; tham số **không được tài liệu hóa** | S7 |
| Custom prompt | Đã deprecated, chỉ ở `~/.codex/prompts/`, không chia sẻ qua repo | `commands/` không có đường tương đương; dùng skill |
| Headless | `codex exec` mặc định read-only; `--sandbox workspace-write`; `--full-auto` "no longer supported"; `--approve-for-me` | S5 |
| Provider ngoài | `model_providers` với `base_url`, `env_key`, `wire_api`; mọi ví dụ dùng `"responses"`; Chat Completions không được nói tới; DeepSeek không được nhắc | Không đưa DeepSeek qua Codex vào phạm vi |

## 3. Phạm vi

**Trong phạm vi**: kênh DeepSeek qua Claude Code (S4, S9); kênh Codex CLI cài bằng `npx shapeup-sdlc init --target codex` (S1–S8); tài liệu và test đi kèm.

**Ngoài phạm vi, nói rõ**:

- Bản cho ChatGPT / GPTs: không có hook, không có sub-agent, không có hệ thống file — không giữ được thứ nào trong năm thứ runtime cưỡng chế, nên đó là sản phẩm khác.
- Thư mục plugin công khai của Codex: loại plugin có hook, mà hook là phần cốt lõi.
- *(đã rút khỏi danh sách ngoài phạm vi sau khi kiểm chứng, xem mục 9)* DeepSeek qua Codex: DeepSeek công bố hỗ trợ Responses API và có hướng dẫn chính thức cho Codex, nên kênh này vào phạm vi như S9b.
- Harness thứ ba (Gemini CLI, Cursor, …) và Windows.
- Đổi năm thứ runtime cưỡng chế, hay thêm cổng mới.
- Một "soak" coi như cổng phát hành — theo `CLAUDE.md`, soak chỉ tìm lỗi.

## 4. Đồ thị phụ thuộc

```
S0 (đo) ──┬─ S4 (floor theo model + trường host) ──┬─ S9 (DeepSeek)        ← kênh rẻ, không cần Codex
          │                                        │
          └─ S1 (adapter seam) ─ S2 (đường kernel) ┴─ S3 (fence, spine, receipt, envelope)
                                                        │
                                          S5 (chạy không người) ─ S6a (refactor init) ─ S6 (installer) ─ S7 (skill vào cửa)
                                                                                     │
                                                                          S8 (AGENTS.md + docs) ─ S10 (test + phát hành)
```

S4 → S9 và S1 → S2 chạy song song sau S0 (không chạm chung file). **S3 chờ cả S1/S2 lẫn S4**: S3c cần trường `host` của launch record, và S4 với S3c cùng sửa `kernel/init/run.mjs`, nên không làm đồng thời.

## 5. Các stage

Mỗi stage nêu: việc, **Done khi** (lệnh), **Cổng go/no-go**. Cổng chung của mọi stage chạm code: `npm test` xanh (≥ 297 checks) và `claude plugin validate . --strict` sạch; stage chạm `hooks/` hoặc `kernel/lib/paths.mjs` thêm `npm run verify:cross-dir`.

### S0 — Đo, không sửa gì

**Việc.** Chạy `npm test`, `npm run demo`, `claude plugin validate . --strict` và ghi kết quả làm baseline. Rồi, trên một dự án rác với Codex CLI thật (ghi phiên bản `codex --version` và ngày), đo từng điểm dưới đây. Mỗi đo ghi: lệnh, payload thô lưu thành fixture ở `tests/fixtures/codex/<mã>.json`, kết luận một dòng.

| Mã | Câu hỏi | Quyết định phụ thuộc |
|---|---|---|
| M1 | `tool_input` của `apply_patch` có hình gì: đường dẫn nằm đâu, nội dung thêm vào nằm đâu, một patch nhiều file ra sao? | S3 bộ trích đường dẫn và quét `committedTierLeaks` |
| M2 | `PreToolUse` từ chối `apply_patch` bằng exit 2 và bằng JSON `deny` — cả hai có thực sự ngăn file được ghi? | Có fence hay không |
| M3 | Hook crash, exit lạ, hoặc quá giờ: chặn hay cho qua? | Kiểu fail của fence |
| M4 | `SubagentStart`/`SubagentStop` có mang tên agent, `model`, `session_id` của sub-agent không; `spawn_agent` ở `PostToolUse` mang gì? **Và `tool_input` của `spawn_agent` ở `PreToolUse` mang gì — có tìm được đường dẫn order trong đó không?** | Cách dựng receipt (S3c); cổng envelope trên Codex (S3d) |
| M5 | `spawn_agent` với tên agent không tồn tại: bị từ chối ở thượng nguồn, hay sub-agent tự ứng biến? | Bất biến "dispatch lỗi không để lại dòng" (F5) còn đứng không |
| M6 | Gọi skill (`$tên`) có đi qua `PreToolUse`/`PostToolUse` không? | Có attestation skill từ host không |
| M7 | Đọc file có đi qua hook không? | Nhánh `Read` của `safety-spine` |
| M8 | Skill nhận tham số thế nào (`$ship <pitch> --no-qa`)? Có cách nào truyền chuỗi tùy ý? | S7 |
| M9 | Trong nội dung skill, biến nào được mở rộng? Skill tìm kernel bằng cách nào khi không có order? | S2 |
| M10 | `codex exec --sandbox workspace-write` có chạy được `node ".../kernel/harness.mjs"` và hook không; sub-agent cần approval mới thì chuyện gì xảy ra; cấu hình nào (`config.toml`, rules) cấp quyền cho lệnh kernel mà không mở toang? Trang `config-reference` **chưa đọc** — đọc ở đây | S5 |
| M11 | Trạng thái "lớp `.codex/` đã tin cậy" lưu ở đâu để installer phát hiện? | S6 |
| M12 | Spawn có tham số model thật không; `model` trong payload là model hỏi hay model chạy? | S3 phần `model_requested` |
| M13 | Tài liệu **chính thức của DeepSeek** có nói endpoint tương thích Anthropic không, và Claude Code cần biến môi trường nào để trỏ vào? Ghi URL và ngày. *(Câu "DeepSeek có endpoint tương thích Anthropic" ở lượt trả lời trước là nhớ lại, chưa kiểm — không coi là sự thật cho tới đây.)* **Thêm: tham số `model` của công cụ `Agent` có nhận id DeepSeek thô không, và `resolvedModel` trong `tool_response` báo gì?** | S9 có tồn tại không; receipt trên DeepSeek |
| M14 | Chạy một lượt ngắn trên model DeepSeek qua Claude Code: gate agent và evaluator có trả đúng schema không? Launch record ghi `sonnet` còn `resolvedModel` ra id DeepSeek — Ship Sign-off ghi gì ở mỗi dòng? | Rủi ro chính của S9 |
| M15 | `codex plugin marketplace add` đặt plugin ở đường dẫn ổn định nào trên đĩa? Skill của plugin có dùng được từ CLI (dù hook đi kèm chỉ chạy ở desktop) không? | Vị trí runtime ổn định (S6) |
| M16 | `tool_input` của công cụ shell trên Codex có hình gì (tên công cụ, trường lệnh)? | S3b — nhánh `Bash` của `safety-spine` |

**Done khi.** `docs/design/v4/execution-2026-11-13-multi-harness.md` có đủ M1–M16, mỗi dòng có fixture hoặc đường dẫn log; fixture của M1–M4, M12 và M16 đã có trong `tests/fixtures/codex/`.

**Cổng go/no-go (quyết định hình dạng cả plan).**

| Kết quả đo | Quyết định |
|---|---|
| M1 + M2 đạt, M3 ra "chặn" hoặc "cho qua nhưng ghi lại được" | **Go** S1–S8 như viết |
| M2 đạt nhưng M1 không trích được đường dẫn đáng tin | Codex chỉ có **bản "lite"** (hướng dẫn, không cưỡng chế ghi); đổi tên kênh, S3 bỏ phần fence, S8 viết lại lời hứa |
| M2 không đạt (hook không ngăn được ghi) | **No-go** kênh Codex; chỉ giữ S4 + S9 |
| M5 ra "ứng biến" | Receipt trên Codex không chứng minh được gì về dispatch lỗi — chuyển sang attestation phía worker ở S3 và nói vậy trong tài liệu |
| M13 ra "không có endpoint tương thích" | **No-go** S9; DeepSeek không có kênh trong plan này |

### S1 — Đường nối adapter (không đổi hành vi)

**Việc.** Tách phần đọc payload khỏi logic. **Vị trí**: adapter phục vụ cả ba hook ở `hooks/` lẫn verifier envelope ở `kernel/verify/`, mà luật tầng (F12) cấm `kernel/verify` import từ `hooks/`. Vì vậy adapter là cơ chế trung tính về host nằm ở `kernel/core/host.mjs` (không nêu tên Shape Up, nhận dữ liệu qua tham số), với một bảng parser mỗi host: `normalize(payload, host)` → `{ event, tool, paths, addedText, command, cwd, agent, model, usage }` và `deny(reason, host)` → đối tượng/exit code đúng host. Đọc `tests/structural/12-layers.mjs` và `layers-expected.json` trước khi đặt file; nếu luật tầng thực tế khác, chọn chỗ theo luật chứ không sửa luật.

**Chọn host: tường minh, không mặc định im lặng.** Hôm nay thiếu cấu hình thì hook coi là Claude. Trên Codex, payload `apply_patch` rơi vào nhánh "không phải công cụ ghi, ngoài phạm vi" và fence tắt **không một dấu vết**. Do đó:
- host là **đối số dòng lệnh** do `init` ghi vào từng lệnh hook, ví dụ `node "<tuyệt đối>/hooks/sandbox-guard.mjs" --host codex`; `hooks/hooks.json` của Claude Code mang `--host claude`;
- một payload có hình **không khớp host được khai** (thiếu trường bắt buộc, `tool_name` lạ cho host đó) vẫn ghi **một dòng ledger** (`verdict:"allow"`, lý do `host-mismatch`) — vẫn fail-open, nhưng không im lặng;
- ngoài ra cả bốn mục hook (F2) đều đi qua adapter, gồm `kernel/verify/envelope.mjs`.

**Done khi.**
- `npm test` xanh, **số check không giảm**.
- Test mới phát lại mọi payload Claude hiện có (`tests/golden/` chỉ có `refusals.json`, không có payload hook ghi sẵn; bộ phát lại là **việc mới**, dựng từ `tests/lib/toy-hook.mjs` và `tests/lib/fixture.mjs`) qua hook cũ (`git show 70e1818:hooks/...`) và hook mới, và so **dòng `decisions.jsonl` giống từng byte** ngoài trường thời gian.
- Test mới: payload Codex đưa vào hook khai `--host claude` sinh dòng `host-mismatch`, không phải im lặng.

**Cổng.** Một dòng ledger khác → dừng, sửa adapter, không sửa test. `12-layers` đỏ → dừng.

### S2 — Skill tìm kernel ở đâu (khi không có `${CLAUDE_PLUGIN_ROOT}`)

**Việc.** Trên Codex, nội dung skill không được mở rộng `${CLAUDE_PLUGIN_ROOT}` (M9). Phạm vi hẹp: chỉ skill `building` (`SKILL.md:44,103`) và tài nguyên intake (`resources/intake/open-run.md:50,98`) viết biến đó; các skill worker đã dùng trường `kernel` của order. Chọn theo kết quả M9:

- **Mặc định:** `init --target codex` **kết xuất** hai file đó với `${CLAUDE_PLUGIN_ROOT}` thay bằng đường dẫn kernel tuyệt đối (có dấu nháy, giống dạng skill vẫn phát ra), kèm dòng dấu `<!-- rendered by shapeup-sdlc <version> -->`. `init --check` phát hiện bản kết xuất lệch version. **Đường dẫn tuyệt đối đó nằm ở đâu và ai giữ nó ổn định là việc của S6** (mục "vị trí runtime").
- **Thay thế nếu M9 cho phép:** một cách khai báo đường dẫn mà Codex mở rộng; bỏ bước kết xuất.

`work-order.schema.json` (mô tả có nhắc biến) chỉ là văn bản; sửa câu mô tả cho trung lập host.

**Done khi.** Test cấu trúc kết xuất cây skill vào thư mục tạm và khẳng định: không còn chuỗi `${CLAUDE_PLUGIN_ROOT}`; mọi đường dẫn kernel trỏ tới một file tồn tại; `node "<kernel>" --help` chạy được từ đường dẫn đã kết xuất.

**Cổng.** Test trên đỏ → dừng.

### S3 — Fence, spine, receipt trên Codex

Bốn việc con, mỗi việc một commit trong stage này. **S3c phụ thuộc S4** (cả hai sửa `kernel/init/run.mjs`; trường `host` của launch record do S4 thêm).

**3a. Fence.** Trong `kernel/core/host/codex.mjs` (không phải `hooks/host/`: luật tầng F12 cấm `kernel/` import từ `hooks/`), trích đường dẫn và **nội dung thêm vào** từ `apply_patch` (hình dạng lấy từ fixture M1). `committedTierLeaks` quét nội dung đó; không phải chỉ đường dẫn (F4). Một patch chạm nhiều file được xét từng file; một file ngoài substrate là từ chối cả patch.

**3b. `safety-spine`.** Nhánh `Bash` giữ nguyên nếu M16 cho thấy lệnh shell đi qua hook và có trường lệnh đọc được; adapter ánh xạ công cụ shell của Codex sang `command`. Nhánh `Read` **mất** nếu M7 ra không hookable — ghi đây là mất năng lực, không phải lỗi.

**3c. Receipt và attestation.** Trên Claude Code, tên agent là bằng chứng vì định nghĩa agent nạp sẵn skill (F5). TOML của Codex **không nạp sẵn skill** — worker có thể chạy mà không nạp skill, nên receipt không còn chứng minh craft đã áp dụng. Thay thế, theo M5/M6:

- Nếu M6 cho skill hookable: dòng receipt thêm `skill_loaded` từ host.
- Nếu không: worker gọi `node "<kernel>" attest skill <tên>` làm việc đầu tiên, ghi một dòng `attested_by:"worker"`. Dòng này **do worker tự báo**, nên receipt mang `attestation:"host"` hoặc `"worker-reported"` và báo cáo ship in nhãn đó.
- **Đây là thay đổi cái Ship Sign-off đọc.** `AGENTS.md` nói cổng đọc census, bản ghi QA và model trên receipt "và không gì khác". Thêm nhãn attestation vào tập đó cần ba thứ cùng lúc: đổi `kernel/gate.mjs` kèm một gate test (ví dụ: `ship` bị từ chối khi receipt exec/eval là `worker-reported` mà dòng cổng chưa ghi nhãn đó), sửa chữ trong `AGENTS.md` ở S8, và một quyết định PO ở mục 7. Chưa có quyết định đó thì 3c chỉ ghi nhãn, không đổi cổng.
- `model_requested` trên Codex gần như luôn `null` (spawn không có tham số model cứng); receipt đã coi `null` là "kế thừa". Ship Sign-off so `usage.model` với launch record, **không** so với `model_requested`, nên không cần lọc "cùng họ" — làm vậy sẽ che một hạ cấp thật. Lệch giả ở mọi dòng chỉ đến từ **mặc định sai**; S4 đặt mặc định theo host/provider, và launch record mang `host` (cũng để receipt chọn đúng parser payload).
- Token/thời lượng: ghép `PostModelRequest.token_usage` và thời điểm `SubagentStart`/`SubagentStop` theo `session_id` của sub-agent (M4). Trường nào không ghép được thì `null`, không đoán.

**3d. Cổng envelope.** `verify envelope` đọc đường dẫn order từ `tool_input` của `Skill|Agent` (`kernel/verify/envelope.mjs`). Trên Codex, nếu M4 cho thấy `PreToolUse` của `spawn_agent` mang đường dẫn order, adapter ánh xạ nó và cổng chạy như cũ. Nếu không, cổng **không áp dụng được ở thời điểm spawn**: dispatch thiếu WorkOrder hợp lệ không còn bị từ chối ở hook, và chữ trong `AGENTS.md` về "hook-denied" phải đổi theo (S8) — kiểm tra thay thế duy nhất còn lại là loop tự validate trước khi dispatch, mà `AGENTS.md` đã nói không có script nào xác minh.

**Done khi.**
- Test mới phát lại fixture M1–M4, M12, M16 qua adapter Codex và khẳng định: một patch ngoài substrate bị từ chối với đúng lý do; một patch ghi chuỗi `.shapeup/…` hay `TASK-001` vào file đã commit bị từ chối; payload `SubagentStop` sinh đúng một dòng receipt với `attestation` đúng nhãn; `spawn_agent` với order thiếu hoặc sai schema bị từ chối (nếu 3d áp dụng được) hoặc có test nêu rõ nó không bị từ chối (nếu không).
- `npm test` xanh.

**Cổng.** Nếu 3a không qua trên fixture thật → áp quyết định "lite" của S0.

### S4 — Model floor theo provider

**Việc.** Floor hiện là denylist các tier Claude và cho id lạ qua (F7). Với model DeepSeek/OpenAI, id lạ nghĩa là **không kiểm tra gì**. **Hai trục khác nhau, đừng gộp**: *host* (harness chạy hook: `claude`, `codex`) quyết định parser payload; *model/provider* (họ của id model) quyết định floor. DeepSeek chạy qua Claude Code là host `claude` với model DeepSeek.

- Floor **khóa theo id/họ model**: bảng tier đóng gói `{ pattern, tier }` (`kernel/core/` nhận bảng qua tham số, đúng kiểu hiện tại). Id thuộc họ Claude giữ nguyên hành vi hiện tại (denylist, id lạ được qua). Id thuộc họ khác phải có trong bảng; id không có trong bảng bị **từ chối trừ khi** launch ghi rõ chấp nhận model chưa xếp hạng. Bảng và cờ là **quyết định của PO** (mục 7).
- Launch record thêm trường `host` (do `kernel/init/run.mjs` ghi; receipt dùng nó để chọn parser). Mặc định `sonnet` (`kernel/init/run.mjs:46`) trở thành mặc định theo host/provider, để run Codex hay DeepSeek không bắt đầu bằng một id không tồn tại ở đó.

**Done khi.** Test mới: id Claude hành xử y như cũ (golden không đổi); một id DeepSeek/OpenAI thuộc tier thấp bị từ chối ở `exec`/`eval`; id không có trong bảng bị từ chối và qua được với cờ chấp nhận; `qa` vẫn không bị kiểm; launch record có `host`.

**Cổng.** `tests/golden/refusals.json` không đổi cho trường hợp Claude.

### S5 — Chạy không người trên Codex (stage riêng, có spike riêng)

`grant.mjs` ghi rule `permissions.allow` của Claude (F9); Codex dùng sandbox và approval. Đây không phải việc con của installer.

**Spike (trước khi viết gì).** Dùng kết quả M10: chạy một lượt `codex exec` với đúng cấu hình dự định, ép một sub-agent cần approval mới, ghi chính xác chuyện gì xảy ra. Tìm cơ chế cấp quyền hẹp (chỉ lệnh kernel) trong `config-reference` — **chưa đọc, không đoán tên khóa**.

**Việc.** Tùy cơ chế tìm được: installer ghi cấu hình cấp quyền hẹp vào `.codex/`, hoặc tài liệu hóa rằng chạy không người trên Codex cần chế độ sandbox cụ thể và nói rõ mức mở. Nếu không có cơ chế hẹp, chọn giữa "mở rộng hơn Claude" và "không hỗ trợ chạy không người trên Codex" — **quyết định của PO**.

**Done khi.** Một test tích hợp (script, không phụ thuộc mạng) khẳng định cấu hình do installer ghi cho phép đúng hai dạng lệnh kernel và không cho một lệnh `node` khác; cộng một lượt `codex exec` thật ghi vào `execution-…` không bị kẹt ở bước một.

**Cổng.** Nếu lượt thật kẹt → stage không qua; Codex vẫn ship được như "tương tác", không như "không người".

### S6a — Refactor `init` thành bước nguyên tử, chỉ với target Claude (không đổi hành vi)

**Vì sao đứng riêng.** `bin/init.mjs` (314 dòng) là script chạy thẳng: parse args, hỏi xác nhận, ghi file ngay lúc import; không có hàm nào gọi riêng được, không có `--dry-run`. Thêm Codex vào dạng đó thành hai nhánh `if` đan nhau. Tách refactor khỏi tính năng để nếu bản Claude đổi hành vi thì biết ngay là lỗi của refactor.

**Cấu trúc đích** (`bin/` đã nằm trong `files` của `package.json`, nên thư mục mới tự được phát hành):

```
bin/
  init.mjs                  # mỏng: parse args → chọn target → gom plan() → áp dụng → báo cáo
  lib/
    grant.mjs               # GIỮ NGUYÊN ĐƯỜNG DẪN (tests/structural/09-init.mjs import trực tiếp)
    steps/                  # COMMON — không biết target nào tồn tại
      agents-md.mjs         #   chèn khối HARNESS_START…HARNESS_END
      gitignore.mjs         #   quy tắc .gitignore do init quản lý
      scaffold.mjs          #   shapeup/metrics/, mẫu Tier C
      fsx.mjs               #   ghi idempotent, so byte, báo "không đổi"
    targets/
      index.mjs             # registry { claude } — S6 thêm codex
      claude/
        index.mjs           #   steps() và check()
        plugin-install.mjs  #   settings.json, CLAUDE.md @AGENTS.md
        trust.mjs           #   isWorkspaceTrusted (chuyển từ grant.mjs, grant.mjs re-export)
```

**Hợp đồng một bước** `{ id, plan(ctx) → [{op:"write"|"append"|"mkdir", path, content}], check(ctx) → {ok, problems[]} }`: `plan` chỉ **trả về** thay đổi dự định; `init.mjs` gom rồi áp dụng một lần. `--dry-run` (in plan, không ghi) và `--check` (chạy `check()` của mọi bước) có sẵn từ đó, và đều **mới** — hôm nay `init` không có hai cờ này. Chạy lần hai không đổi byte; bước nào không đổi gì thì báo "không đổi".

**Ba luật tầng**, kiểm bằng test mới `tests/structural/14-init-layers.mjs` (`12-layers` không quét `bin/` — nó chỉ duyệt `kernel/` và `hooks/` — nên cần test riêng): (1) `steps/` không import `targets/`; (2) một target không import target khác — muốn dùng chung thì đẩy xuống `steps/`; (3) `bin/lib/targets/*` không import từ `hooks/`. Giữ ràng buộc chung: `node:` builtins, không dependency, không mạng.

**Ràng buộc từ `scripts/FROZEN.md`.** `scripts/install-harness.sh`, `scripts/migrate.sh` và `scripts/shapeup-sdlc/lib/lib-harness.sh` là đường dẫn đã công bố (`curl | bash`): **không đổi tên, không di chuyển**. S6a không đụng chúng. Bản bash chỉ phục vụ Claude và không được mở rộng cho Codex; `init.mjs` phần dùng chung với bản bash (ghi trong chú thích đầu file: "hai bản lệch nhau là lỗi") phải còn đúng sau refactor — test cấu trúc hiện đang giữ phần dùng chung đó, nên chạy lại và không nới.

**Done khi.**
- Trên một dự án trống (và một dự án đã cài sẵn, để kiểm idempotent), `npx shapeup-sdlc init -y` từ `26cc9a4` và từ cây mới cho **cây file giống từng byte** (so sánh bằng băm toàn thư mục, không có `claude` trên PATH như `09-init.mjs` đang làm).
- `npm test` xanh, **số check không giảm**; `tests/structural/09-init.mjs` không bị sửa để qua (chỉ thêm).
- `14-init-layers` xanh và đỏ khi cố tình đảo một import (thử một lần, hoàn lại).
- `init --dry-run` không ghi file nào; `init --check` trên dự án vừa cài báo sạch, trên dự án thiếu khối `AGENTS.md` báo thiếu.
- `npm run verify:cross-dir` xanh.

**Cổng.** Cây file lệch dù một byte → dừng, sửa bước, không sửa phép so. Chỉ khi S6a xanh S6 mới thêm `targets/codex/`.

### S6 — Installer: `init --target codex`

**Phụ thuộc S6a.** Từ đây Codex là một module `bin/lib/targets/codex/` cắm vào registry, gồm `runtime.mjs`, `hooks-json.mjs`, `agents-toml.mjs`, `skills-render.mjs`, `trust.mjs`, mỗi file một bước theo hợp đồng của S6a; `--target both` chạy bước common một lần rồi `claude.steps()` rồi `codex.steps()`.

**Vị trí runtime — phải chọn trước khi ghi file nào.** S2 và S6 đặt đường dẫn tuyệt đối của kernel và hook vào `.codex/hooks.json` và `.agents/skills/`. Hai vấn đề: (1) các thư mục đó nằm trong dự án và thường được commit, nên đồng đội kéo về đường dẫn chỉ tồn tại trên máy người cài — chính lý do tồn tại của luật tier-direction; (2) `npx` chạy từ cache tạm, đường dẫn đó có thể biến mất. Phương án:

| Phương án | Chi tiết | Đánh đổi |
|---|---|---|
| **A (đề xuất)** | Sao chép runtime (`hooks/`, `kernel/`, `oracles/`) vào một thư mục có phiên bản, ổn định, **ngoài dự án** (ví dụ dưới thư mục người dùng) và ghi cấu hình ở mức **người dùng** (`~/.codex/hooks.json`, `$HOME/.agents/skills`); dự án không chứa đường dẫn máy nào | Cấu hình toàn máy, không theo dự án; cần cách gỡ |
| B | Cấu hình ở mức dự án nhưng **gitignored** (thêm `.codex/hooks.json`, `.agents/skills/` vào `.gitignore` do `init` quản lý) | Đồng đội phải tự chạy `init`; vẫn cần runtime ở chỗ ổn định |
| C | Dùng `codex plugin marketplace add` để Codex tự đặt plugin ở chỗ ổn định (M15) — nhưng hook đóng gói chỉ chạy ở desktop, nên chỉ lấy được skill/runtime | Hook vẫn cần A hoặc B |

Chọn theo M15 và quyết định PO (mục 7). Dù chọn gì, `init` ghi đường dẫn ra khỏi git (không bao giờ commit đường dẫn máy) và `init --check` báo khi runtime ở chỗ ổn định bị thiếu hoặc lệch version.

**Việc.** Thêm `--target claude|codex|both` (mặc định `claude`, để không đổi hành vi hiện có) vào `bin/init.mjs`. Với `codex`:

- ghi hook (mỗi lệnh mang `--host codex` tường minh, S1) vào nơi đã chọn ở trên, với đường dẫn **tuyệt đối tới runtime ổn định** (không dựa biến root);
- sinh `.codex/agents/<tên>.toml` từ `agents/*.md` (`name`, `description`, `developer_instructions` = thân file + chỉ dẫn nạp skill, `model`); không có `tools`, không có `skills`;
- kết xuất skill (S2) vào nơi đã chọn;
- chèn khối harness của `AGENTS.md` (đã có);
- phát hiện **lớp `.codex/` chưa tin cậy** theo M11 và nói rõ trong đầu ra — vì hook không nạp thì fence **fail-open im lặng**, đúng lớp lỗi `CLAUDE.md` đã cảnh báo; không bao giờ tự tin cậy thay người dùng;
- idempotent: chạy hai lần không đổi gì; `--check` báo lệch version.

Giữ ràng buộc: zero dependency, `node:` builtins, không mạng, hook fail-open trừ khi trạng thái xấu được chứng minh.

**Done khi.** `tests/structural/09-init.mjs` mở rộng: cài vào thư mục tạm (với `HOME` giả lập), kiểm các file sinh ra, kiểm lần chạy thứ hai không đổi byte nào, kiểm **không file nào trong cây dự án chứa đường dẫn tuyệt đối của máy** (grep thư mục dự án), kiểm đầu ra có cảnh báo khi giả lập trạng thái chưa tin cậy.

**Cổng.** Bất kỳ file nào do `--target codex` ghi mà `--target claude` đã tạo ra bị đổi → dừng.

### S7 — Cửa vào: `/ship` thành skill trên Codex

**Việc.** `commands/` không có tương đương Codex (custom prompt deprecated). Sinh các skill mỏng `ship`, `shapeup`, `retro` (chỉ kết xuất cho Codex) mà nội dung là thân của `commands/*.md` đổi `$ARGUMENTS` theo cách M8 tìm ra. Nếu M8 cho thấy skill không nhận tham số, các cờ (`--no-qa`, `--parallel-scopes N`, `--exec-model`) đi qua dòng đầu của prompt, skill đọc từ đó — ghi vào tài liệu như giới hạn.

**Done khi.** Test cấu trúc: mỗi `commands/*.md` có skill kết xuất tương ứng; không còn `$ARGUMENTS` chưa thay; một lượt tay `codex exec` gọi `$ship intake --check` và dừng đúng chỗ, ghi trong `execution-…`.

**Cổng.** Lượt tay không tới được kernel → quay về S2.

### S8 — `AGENTS.md` và tài liệu công khai

`AGENTS.md` là sản phẩm được phát hành (`bin/init.mjs` chèn khối `HARNESS_START…HARNESS_END`). Trên Codex, năm thứ runtime cưỡng chế co lại: receipt và gate resolver còn nguyên; T0 witness còn nguyên; write fence phụ thuộc M1–M3; dispatch receipt bị attestation yếu hơn (3c); tier-direction rule theo 3a; từ chối dispatch thiếu WorkOrder phụ thuộc M4 (3d). Chữ "Ship Sign-off đọc … và không gì khác" phải sửa nếu quyết định ở mục 7 (nhãn attestation) được duyệt.

**Việc.** Quyết **một lần** (mục 7): khối harness có bảng "cưỡng chế theo host", hoặc mỗi host một biến thể khối do `init` chọn. Viết bằng ngôn ngữ skill/lệnh/tùy chọn, không nêu đường dẫn `.mjs`; tên cổng là tên thường, không mã, không ký hiệu (`CLAUDE.md`). Cập nhật `README.md`, `docs/install.md`, `docs/quickstart.md`, `docs/upgrading.md`, `SECURITY.md` (nêu rõ: hook của Codex là "guardrail, not a complete enforcement boundary" — ghi theo M3 đo được).

**Done khi.** Chạy skill **`harness-maintenance-audit`** và nó không báo gì chưa giải quyết; `npm test` xanh, gồm test "gate names" của `AGENTS.md`.

**Cổng.** Audit báo một tài liệu lệch thực tế → sửa tài liệu theo thực tế, không sửa thực tế theo tài liệu.

### S9 — Kênh DeepSeek qua Claude Code

Chỉ chạy nếu M13 đạt.

**Việc.** Tài liệu hóa cách trỏ Claude Code vào endpoint DeepSeek (biến môi trường và URL **lấy từ trang chính thức đã ghim ở M13**, không nhớ lại), ánh xạ alias vai trò → model DeepSeek trong `--exec-model/--eval-model/--qa-model`, bảng tier ở S4. Không code mới ngoài S4.

**Receipt trên DeepSeek.** Launch record mặc định `sonnet` còn `resolvedModel` sẽ báo id DeepSeek: nếu không ánh xạ alias đúng (S4) thì Ship Sign-off ghi lệch model ở mọi dòng. M13/M14 trả lời `Agent.model` có nhận id DeepSeek thô không và `resolvedModel` báo gì; kết quả quyết định launch record ghi alias hay id thô.

**Đo, không hứa.** Một run thật trên DeepSeek, ghi **model, ngày, số lần gate agent và evaluator trả sai schema** vào `execution-…`. Soak này **chỉ tìm lỗi**: sạch nghĩa là "không thấy gì ở BUILD", không phải "đủ điều kiện phát hành". Mọi con số tỷ lệ gắn model và ngày đo.

**Done khi.** Tài liệu có mục DeepSeek với URL nguồn và ngày; `npm test` xanh; `execution-…` có kết quả M14 và run thật; nếu gate agent trả sai schema ở tần suất cao, mục tài liệu nói thẳng như hạn chế.

**Cổng.** Nếu M14 cho thấy model không giữ nổi schema ở gate agent → kênh ghi là "thử nghiệm", không đưa vào README chính.

### S10 — Test, phát hành

**Việc.** Test cấu trúc mới `tests/structural/15-codex-adapter.mjs` (`14` là của S6a) dùng fixture M1–M4, M12 (không cần Codex cài sẵn, không mạng). `tools/verify-cross-dir.mjs` nhận `--host codex`: `git archive` ra đường dẫn khác, `cwd` là dự án khác, bắn payload Codex vào hook và khẳng định quyết định tới `decisions.jsonl`; thiếu dòng = tín hiệu hỏng (`CLAUDE.md`). Tăng version ở **cả** `package.json` và `.claude-plugin/plugin.json`; `CHANGELOG.md`; `claude plugin validate . --strict` cho cả `./` và `./.claude-plugin/marketplace.json`. Subject commit: `type(scope): lowercase declarative`.

**Done khi.**
```bash
npm test
npm run demo
npm run verify:cross-dir
node tools/verify-cross-dir.mjs --host codex
claude plugin validate . --strict
claude plugin validate ./.claude-plugin/marketplace.json --strict
```
đều xanh, và `package.json` với `.claude-plugin/plugin.json` cùng version.

**Cổng.** Bất kỳ lệnh nào đỏ → không phát hành; không nới kiểm tra.

## 6. Rủi ro

| Rủi ro | Dấu hiệu | Giảm thiểu |
|---|---|---|
| Hook Codex không nạp (chưa tin cậy) nên fence tắt im lặng | Không có dòng nào trong `decisions.jsonl` | S6 phát hiện và báo; S10 kiểm thiếu-dòng |
| Hook Codex fail-open khi crash/quá giờ | M3 | Ghi trong `SECURITY.md`; không tuyên bố cưỡng chế mạnh hơn đo được |
| Worker chạy mà không nạp skill (TOML không preload) | Receipt xanh, craft không có | Attestation 3c, nhãn `worker-reported`, báo cáo ship in nhãn |
| Ship Sign-off ghi lệch model ở mọi dòng vì launch record mặc định `sonnet` còn host báo model khác | Dòng cổng nào cũng có cảnh báo lệch | Mặc định theo host/provider và trường `host` (S4); ánh xạ alias DeepSeek (S9) |
| Dispatch thiếu WorkOrder không bị từ chối ở hook trên Codex | M4: `PreToolUse` của `spawn_agent` không mang đường dẫn order | S3d: nói thẳng trong `AGENTS.md`, không hứa hook-denied |
| Đường dẫn máy bị commit vào dự án | `git status` sau `init --target codex` | Vị trí runtime ổn định (S6), test grep đường dẫn tuyệt đối |
| Skill kết xuất lệch version với plugin | `init --check` đỏ | Dấu version trong file kết xuất |
| Model DeepSeek không giữ nổi schema ở gate agent | M14 | Kênh "thử nghiệm" |
| Hai harness nhân đôi ma trận kiểm thử | Thời gian CI | Fixture phát lại, không cần cài Codex trong CI |

## 7. Quyết định cần PO (chưa ai quyết)

1. **Ngưỡng S0**: nếu M2 đạt nhưng M3 ra "cho qua khi crash", có ship Codex là kênh "enforced" không, hay chỉ "guarded"? *Đề xuất: "guarded", ghi trong `SECURITY.md`.*
2. **S4**: id model không có trong bảng tier trên host không phải Claude — từ chối mặc định kèm cờ chấp nhận *(đề xuất)*, hay cho qua như Claude?
3. **S5**: nếu Codex không có cơ chế cấp quyền hẹp — mở rộng hơn Claude, hay không hỗ trợ chạy không người?
4. **S8**: một khối harness có bảng theo host, hay mỗi host một biến thể? *Đề xuất: một khối, có bảng — một nguồn sự thật.*
5. **Tên kênh Codex nếu rơi vào "lite"**: không gọi là cùng sản phẩm.
6. **S3c — nhãn attestation tại Ship Sign-off**: có cho cổng đọc nhãn `worker-reported` (đổi `kernel/gate.mjs` + gate test + chữ `AGENTS.md`) hay chỉ ghi nhãn vào receipt và báo cáo? *Đề xuất: cổng đọc nhãn và từ chối `ship` khi receipt exec/eval là `worker-reported` mà dòng cổng chưa ghi nhãn đó — nếu không, kênh Codex hứa "skill đóng gói đã chạy" mà không chứng minh được.*
7. **S6 — vị trí runtime**: phương án A (ngoài dự án, cấu hình mức người dùng), B (gitignored theo dự án) hay C (qua marketplace). *Đề xuất: A, sau khi M15 xác nhận C không đủ cho hook.*

## 8. Cái gì sẽ đổi câu trả lời

- M2 ra "hook không ngăn được ghi trên `apply_patch`": cả kênh Codex ngừng.
- M5 ra "ứng biến": receipt trên Codex chỉ còn là nhật ký, không phải bằng chứng.
- Codex đổi hợp đồng hook (tài liệu không có ngày/phiên bản): fixture S0 cũ đi; S10 test phát lại sẽ bắt, vì fixture ghi `codex --version`.
- M13 ra "không có endpoint tương thích": bỏ S9, DeepSeek chỉ đi được khi người dùng tự có cổng dịch, ngoài phạm vi. *(M13 đã được trả lời ở mục 9: endpoint có thật. Dòng này giữ làm lịch sử.)*

## 9. Kết quả bốn agent kiểm tra (2026-11-14) và các sửa đổi bắt buộc

Bốn agent chạy độc lập: một đọc LLD của repo (binding), một đọc tài liệu Codex nguyên văn và mã nguồn `openai/codex` (commit `b1573f1`), một đọc tài liệu DeepSeek chính thức, một đối chiếu plan với code. Nhãn dùng: **DOC** = tài liệu nguyên văn, **SRC** = chỉ thấy trong mã nguồn, **TÓM TẮT** = qua bản tóm tắt công cụ. **Chưa mục nào là đo** — mọi thứ vẫn chờ S0.

### 9.1 Sửa so với các mục trên

| # | Sửa | Ở đâu |
|---|---|---|
| 1 | F2: cổng envelope **không** đọc đường dẫn order từ một trường; nó chạy regex `--order …` trên `tool_input.skill_args`, `args`, `prompt` (`kernel/core/envelope.mjs:245-250`). Receipt còn đọc `commandName`, `agentId`, `isAsync`, `status` và `tool_input.subagent_type`, `run_in_background` cho agent chạy nền (`hooks/dispatch-receipt.mjs:84-209`). `committedTierLeaks` ở `sandbox-guard.mjs:267`, chỉ quét file `.md/.json/.yml/.txt` dưới `shapeup/<slug>/` | S3a, S3d |
| 2 | F7 và S4: xem hàng F7 đã sửa. S4 không "thêm" denylist cho model ngoài Claude: denylist hiện có đã nhận `mini/nano/lite`. Việc thật của S4 là **thiếu danh sách cho phép** — id lạ lọt qua — và mặc định `sonnet` không tồn tại trên DeepSeek/Codex | S4 |
| 3 | Parser host đặt ở `kernel/core/host/*.mjs`; S1 phải liệt kê thêm `kernel/core/hook.mjs` (luôn `exit 0` và in JSON, `:126,179-181`), `kernel/core/envelope.mjs:245-266` (tên công cụ `Skill`/`Agent` và JSON deny viết cứng) và `kernel/core/fence.mjs:145` (`tool === "Write"`). Codex chấp nhận deny bằng JSON `permissionDecision:"deny"` (DOC), nên **không cần** đường exit 2 | S1 |
| 4 | Thiếu yêu cầu **R4** (payload hook của sub-agent mang `agent_id`, để fence biết dispatch nào đang ghi, `sandbox-guard.mjs:373`) và **R10** (hook bắn cả với lời gọi công cụ của sub-agent). Thêm M17 | S0 |
| 5 | Worker mất `tools:` (hôm nay `Read, Write, Edit, Bash, Grep, Glob`, không có `Agent`, nên không lồng được). TOML Codex không có allowlist công cụ (DOC): chỉ tắt theo khóa tính năng (`features.shell_tool`, …). Quyền tối thiểu của worker **mất**; ghi vào `AGENTS.md` | S3, S8 |
| 6 | Tên agent: `building` gọi `shapeup-sdlc-plugin:<worker>` (`SKILL.md:59,97`). Codex dùng `agent_type` trơn. Adapter chuẩn hóa tên; `agentWorkerFrom` đã cắt tiền tố bằng `lastIndexOf(":")` | S1, S2 |
| 7 | `kernel/core/roster.mjs:62` đọc `.claude-plugin/plugin.json` cho preflight roster; `kernel/core/roster.mjs:38-44` đọc trường `skills:` của `agents/*.md` và **từ chối mở run nếu thiếu**. Runtime trên Codex phải mang manifest đó, hoặc roster có đường thay thế; nếu không `init run` từ chối | S6 |
| 8 | `tests/structural.mjs` có danh sách `MODULES` viết cứng: mỗi file test mới (`14-…`, `15-…`) phải được thêm vào đó; `tests/fixtures/` chưa tồn tại (S0 tạo). Khẳng định "không còn `${CLAUDE_PLUGIN_ROOT}`" của S2 phải loại hai dòng cấm dùng nó (`skills/spec-evaluator/SKILL.md:32`, `skills/task-executor/SKILL.md:19`) | S2, S10 |
| 9 | Cờ **mới**, không có sẵn: `harness attest`, `init --check`, `--dry-run`, `--target`, `--host` (của hook), `verify-cross-dir --host` (công cụ này cứng `sandbox-guard`). Đọc `.claude/settings*.json` để lấy model còn ở `open-run.md:39` và `commands/ship.md:53` | S2, S6, S7 |

### 9.2 Điều tra: những gì tài liệu Codex đã trả lời cho M1–M16

Vẫn **chưa đo**; cột "M" là điểm S0 còn phải xác nhận bằng một phiên thật.

| M | Tài liệu / mã nguồn nói | M còn lại |
|---|---|---|
| M1 | `tool_input.command` chứa **toàn bộ patch**; không có danh sách đường dẫn riêng (SRC). Phải parse đường dẫn từ chữ patch. `tool_name` trong payload vẫn là `apply_patch` dù matcher nhận `Edit`/`Write` (DOC) | đo patch nhiều file, xóa, đổi tên |
| M2 | Chặn bằng JSON `permissionDecision:"deny"`, `{"decision":"block"}` cũ, hoặc exit 2 + stderr (DOC) | đo có thật sự ngăn ghi |
| M3 | PreToolUse: timeout, lỗi spawn, exit khác 0/2, JSON hỏng, exit 2 stderr rỗng đều **đánh dấu hook lỗi và tool vẫn chạy = fail-open** (SRC). Các sự kiện khác chưa kiểm. Mặc định timeout 600 s (DOC) | đo |
| M4 | `SubagentStart` có `agent_id`, `agent_type`, `model`, `session_id` **của cha**; `SubagentStop` có `last_assistant_message`, `agent_transcript_path`. Tham số của `spawn_agent`: `message`, `task_name`, `agent_type`, `model`, `reasoning_effort` (SRC) | `model` ở Start là của con hay của cha? order path có nằm trong `message`? |
| M5 | `agent_type` không tồn tại → **lỗi trả về cho model**, không ứng biến (SRC) | đo; nếu đúng thì bất biến "dispatch lỗi không để lại dòng" giữ được |
| M6, M7 | Không có hook cho gọi skill; không có công cụ đọc file riêng, đọc đi qua shell (`Bash`) (DOC) | nhánh `Read` của `safety-spine` coi là mất; `Bash` thay thế một phần |
| M8 | Skill **không có tham số** được tài liệu hóa; `$tên` chỉ là nhắc tên trong prompt | đo cách truyền cờ |
| M9 | **Không** có thay thế biến trong nội dung skill; `PLUGIN_ROOT`, `CLAUDE_PLUGIN_ROOT` chỉ có trong **môi trường tiến trình hook** (SRC) | kết xuất bằng `init` là bắt buộc |
| M10 | Lệnh `prefix_rule(pattern=[...], decision="allow")` cho phép đúng dạng lệnh `["node","/abs/kernel/harness.mjs"]`, nhưng "allow" nghĩa là **chạy ngoài sandbox** (DOC). Sub-agent cần approval mới thì **lỗi trả về cha** (DOC). `--full-auto` đã bị gỡ; dùng `--sandbox workspace-write` hoặc `--approve-for-me` | đo trọn một lượt |
| M11 | Trạng thái tin cậy hook nằm ở `~/.codex/config.toml`, bảng `[hooks.state."<key>"]` với `trusted_hash`; project: `projects.<path>.trust_level` (SRC + DOC). Hook không tin cậy bị **bỏ qua im lặng**. Có cờ `--dangerously-bypass-hook-trust` | tạo được `trusted_hash`? |
| M12 | `spawn_agent` có tham số `model` thật, nhưng có thể bị ẩn bởi `expose_spawn_agent_model_overrides` (SRC) | đo |
| M15 | Plugin cài vào `~/.codex/plugins/cache/<marketplace>/<plugin>/<version>/` (DOC); `codex plugin add` có thật. Tài liệu mâu thuẫn nội bộ về việc hook plugin chỉ chạy trên desktop hay cả CLI | đo trên CLI |
| M16 | Công cụ shell khớp matcher `Bash`; lệnh ở `tool_input.command` (DOC) | đo |
| M17 *(mới)* | `PreToolUse` có thể mang `agent_id`, `agent_type` (SRC schema) | đo trên một sub-agent đang ghi file |

Còn: hook trong plugin **không** đủ điều kiện vào thư mục công khai (DOC); marketplace Codex đọc cả `.claude-plugin/marketplace.json` (DOC); plugin **không** đóng gói được agent (không có trong tài liệu); `/import` của Codex chuyển lệnh, hook, sub-agent từ Claude Code nhưng "có thể khác hành vi" (DOC).

### 9.3 DeepSeek: M13 đã trả lời

Câu "DeepSeek có endpoint tương thích Anthropic" **được xác nhận bằng tài liệu chính thức**: `https://api.deepseek.com/anthropic` (`ANTHROPIC_BASE_URL`), model `deepseek-flash` và `deepseek-v4-pro`, context 1M, đầu ra tối đa 384K. Nhưng:

- Tên model không bắt đầu bằng `claude` bị từ chối 400; `claude-opus*` ánh xạ sang `deepseek-v4-pro`, `claude-sonnet*`/`claude-haiku*` sang `deepseek-flash`. Vì vậy `Agent.model` phải dùng **alias Claude**, không dùng id DeepSeek thô; `resolvedModel` sẽ báo gì thì **chưa biết** (M14).
- `tool_choice: tool` trả 400 khi bật thinking; `cache_control` bị bỏ qua; trường beta (`strict`, `output_config`) có thể 400 trừ khi đặt `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1`. Không có tài liệu về `json_schema` output; `strict` chỉ ở `/beta`.
- Alias đổi model ngầm bên dưới (`deepseek-flash` nâng lên bản 1017 ngày 2026-10-17): mọi tỷ lệ đo được phải gắn id bản và ngày.
- Tài liệu Claude Code nói thẳng là **không hỗ trợ** định tuyến Claude Code sang model không phải Claude.
- Dữ liệu: chính sách riêng tư nói lưu và xử lý ở Trung Quốc đại lục; điều khoản API theo luật Trung Quốc; việc dùng dữ liệu API để huấn luyện không được nói rõ. Cần đội pháp chế của tổ chức xem; nguồn về hạn chế chính phủ/doanh nghiệp là bên thứ ba, chất lượng thấp, chưa kiểm.
- Responses API được hỗ trợ cho cả hai model, và có hướng dẫn chính thức cho Codex (`wire_api = "responses"`, cần Codex 0.164 trở lên cho phần tìm kiếm). Codex đã **gỡ** Chat Completions (`wire_api = "chat"` bị từ chối).

### 9.4 Stage bổ sung

**S9b — DeepSeek qua Codex.** Sau khi S0–S8 xanh và M13/M14 chốt. Việc: `init --target codex` có tùy chọn ghi `[model_providers.deepseek]` (`base_url`, `wire_api = "responses"`, khóa lấy từ biến môi trường, không bao giờ ghi khóa vào file); bảng tier của S4 nhận id DeepSeek. Done khi: một lượt `codex exec` ngắn qua DeepSeek ghi vào `execution-…`: hook có chạy, sub-agent có spawn, receipt ghi model nào; thêm tỷ lệ worker trả sai schema (N ≥ 50, gắn id bản và ngày). Cổng: không qua thì kênh ghi là thử nghiệm.

**S0 mở rộng.** Thêm M17 (agent_id trên PreToolUse của sub-agent) và các câu "M còn lại" ở 9.2. Thêm **M18**: một hook thật chạy trong `codex exec` (tài liệu không nói; chỉ suy ra từ mã nguồn).

**S5 sửa.** Vì `prefix_rule(... allow)` chạy lệnh **ngoài sandbox**, cấp quyền cho kernel nghĩa là kernel chạy không sandbox. Đó là quyết định của PO (mục 7, thêm câu 8), không phải chi tiết của installer.

### 9.5 Lỗi code phát hiện, ngoài phạm vi plan này (không sửa ở đây)

- `AGENTS.md` nói gate được ghi "dưới tên của gate agent", nhưng `--by agent:gate-agent` là chuỗi tự khai; không hook hay code nào kiểm người gọi thật là gate agent. Theo quy ước repo đây là *code defect* báo riêng; tài liệu không được sửa cho khớp.
- Hai biến môi trường `SHAPEUP_ORCH_MODEL` và `SHAPEUP_DIGESTER_MODEL` trong `.claude/settings.local.example.json` không có chỗ đọc.

### 9.6 Quyết định PO thêm

8. **S5 — chạy không người trên Codex**: chấp nhận kernel chạy ngoài sandbox qua `prefix_rule`, hoặc dùng `--sandbox workspace-write` với `approval_policy = "never"` và chấp nhận sub-agent lỗi khi cần approval mới, hoặc không hỗ trợ chạy không người. *Đề xuất: thử `workspace-write` + `never` ở S0 trước; chỉ dùng `prefix_rule` nếu lượt đó kẹt.*
9. **DeepSeek**: chấp nhận gửi mã và pitch của dự án tới một dịch vụ lưu dữ liệu ở Trung Quốc đại lục? Đây là quyết định của tổ chức, không phải của plugin; tài liệu `README.md` phải nói rõ trước khi liệt kê kênh.
