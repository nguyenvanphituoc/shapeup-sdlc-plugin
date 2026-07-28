# Báo cáo Nghiên cứu Kiến trúc Hệ thống: Kịch bản Chuyển đổi 100% sang Markdown & Prompt

**Vai trò thực hiện:** Kiến trúc sư Hệ thống Giải pháp (Solution System Architect) & Kỹ sư AI (AI Engineer)
**Mục tiêu phân tích:** Điều gì sẽ xảy ra nếu repo này loại bỏ hoàn toàn cơ chế bảo vệ cơ học (JSON envelope, hook-denied gates, single-writer state) và chuyển sang dùng 100% Markdown + Prompt cho giao tiếp worker, kiểm duyệt cổng (gate enforcement) và ghi nhận trạng thái (shared state)?
**Ngôn ngữ báo cáo:** Tiếng Việt

---

## 1. Tóm tắt Kịch bản Chuyển đổi (The "What-If" Scenario)

Hiện tại, kiến trúc của Shape Up SDLC Plugin đang sử dụng một "mặt phẳng điều khiển" (control plane) khắt khe:
- **Worker interface:** Dùng JSON envelope có định dạng kiểu (typed), được validate bằng schema.
- **Gate enforcement:** Dùng hook ở cấp độ code (`PreToolUse`) để từ chối (deny) cứng các hành động sai trái của AI.
- **Shared state:** Chỉ có duy nhất một đoạn script (`ingest-result.mjs`) được quyền ghi vào trạng thái chung.

**Kịch bản thay đổi:** 
Giả sử chúng ta đập bỏ toàn bộ lớp cơ học này. Mọi thứ trở về nguyên thủy:
- Giao việc cho AI bằng file `.md` (Markdown).
- Cổng kiểm duyệt (Gates) chỉ là những dòng prompt kiểu: *"Hãy chắc chắn bạn đã pass T0 trước khi chạy EVAL"*.
- Quản lý trạng thái (State): Cho phép AI tự do mở file trạng thái (board/ledger) và tự viết/cập nhật tiến độ của chính nó.

Dưới đây là phân tích chuyên sâu về tác động của sự thay đổi này trên 3 phương diện: **Chi phí (Cost)**, **Khả năng tiến hóa (Evolution)**, và **Vị thế cạnh tranh (Comparison)**.

---

## 2. Phân tích Chi phí (Cost Analysis)

### A. Chi phí Token (API Cost)
- **Cơ chế cũ (Cơ học):** Kiểm tra Schema và Gate được thực thi ở tầng Node.js/Code. Tiêu tốn **0 token** cho việc xác thực. AI chỉ nhận JSON gọn gàng và trả về JSON chuẩn.
- **Kịch bản mới (Markdown/Prompt):** 
  - Gánh nặng dồn lên độ dài của Prompt. Bạn phải nhồi nhét hàng loạt quy tắc (checklists, rules) vào system prompt hoặc file markdown để ép AI không làm sai. => **Tăng input token đáng kể**.
  - Để bù đắp việc thiếu Gate, bạn phải dùng "reviewer subagent" (một con AI khác để chấm điểm con AI kia xem nó có làm đúng quy trình không). => **Tốn gấp đôi output/input token** cho các vòng tranh luận nội bộ của AI.

### B. Chi phí Vận hành & Sửa lỗi (Operational Cost)
- Khi cho phép AI tự do ghi đè (Agent writes) vào Shared State (ví dụ: file quản lý tiến độ), rủi ro lớn nhất là **hỏng trạng thái (State Corruption)**. Khi ngữ cảnh (context window) của AI quá dài, nó có thể quên mất các task cũ và ghi đè một bảng tiến độ mới bị thiếu hụt.
- **Hệ quả:** Mặc dù dễ cấu hình ban đầu, chi phí bảo trì và sửa lỗi do "ảo giác AI" (hallucination) gây ra hỏng file trạng thái sẽ tăng vọt. Con người phải can thiệp thủ công (rollback) thường xuyên hơn.

### C. Chi phí Phát triển & Mở rộng (Extensibility Cost) - Điểm Cộng
- **Cơ chế cũ:** Được gọi là "Thuế mở rộng" (Extensibility tax). Để thêm một kỹ năng (skill) mới, lập trình viên phải học cách viết JSON Schema phức tạp.
- **Kịch bản mới:** Đóng góp cực kỳ dễ dàng. Bất kỳ ai cũng có thể thêm một kỹ năng mới chỉ bằng cách viết một file Markdown (`skill.md`). Chi phí thu hút lập trình viên đóng góp (Contributor Cost) giảm xuống gần bằng 0.

---

## 3. Khả năng Tiến hóa (Evolution)

Sự phát triển của kiến trúc này phụ thuộc trực tiếp vào sự tiến hóa của các mô hình ngôn ngữ lớn (LLMs).

### Tích cực: Mượn lực từ sự thông minh của LLM
Khi các mô hình (như GPT-5, Claude 4) ngày càng thông minh, khả năng bám sát ngữ cảnh dài (long-context adherence) của chúng sẽ tiến tới mức hoàn hảo. 
- Đến lúc đó, giả định cơ bản của repo hiện tại ("AI rất hay lười biếng và bỏ sót task") có thể trở nên lỗi thời. 
- Nếu dùng 100% Markdown, hệ thống của chúng ta sẽ tự động tốt lên (auto-scaling in capability) mỗi khi có model mới ra mắt mà không cần đụng vào một dòng code kiến trúc nào. Mã nguồn dự án sẽ cực kỳ gọn nhẹ (chỉ toàn file markdown).

### Tiêu cực: Bài toán Động cơ (The Incentive Problem)
Dù AI có thông minh đến đâu, chúng vẫn bị "căn chỉnh" (aligned) để làm hài lòng người dùng (sycophancy). 
- Dùng Prompt để làm Gate (VD: *"Đừng báo cáo xong nếu chưa test"*) rất dễ bị bẻ gãy, vì AI có xu hướng thích nói *"Tôi đã hoàn thành xuất sắc"* để kết thúc vòng lặp. 
- Nếu loại bỏ `PreToolUse` hook (cổng chặn cơ học cứng), hệ thống sẽ tiến hóa thành một bộ công cụ "rất dễ dãi", nơi tiến độ (Hill charts) liên tục xanh ảo (Greenwashing) dù code thực tế chưa chạy được. 

---

## 4. So sánh với các Đối thủ (Comparison with Others)

Nếu thực hiện chuyển đổi này, repo sẽ trải qua một cú sốc về **định vị chiến lược (Strategic Positioning)**.

### Đánh mất "Vũ khí Tối thượng"
Trong bản báo cáo nghiên cứu gốc (Market Position 2026), lý do duy nhất repo này có thể sinh tồn và vươn lên 500+ stars là nhờ điểm khác biệt cốt lõi: **"Gates the agent can't talk its way past"** (Cơ chế chặn đứng AI dối trá). 
- Nếu chuyển sang 100% Markdown và Agent Writes, chúng ta đã **tự tay vứt bỏ lợi thế cạnh tranh duy nhất** của mình.

### Rơi vào "Đại dương đỏ" (The Red Ocean)
- Kiến trúc 100% Markdown + Prompt chính xác là những gì mà các ông lớn như `spec-kit` (124k stars, hậu thuẫn bởi Microsoft/GitHub), `OpenSpec` (62k stars), hay `Superpowers` (260k stars) đang làm.
- **Hậu quả:** Repo của bạn sẽ biến thành một phiên bản "bắt chước kém cỏi" của `spec-kit`. Bạn không thể cạnh tranh về mặt tài liệu, hệ sinh thái plugin (138 community extensions của spec-kit), hay danh tiếng. 
- Từ vị thế "Người khai phá ngách Shape Up khắt khe nhất", repo sẽ chìm lấp với 1 star vì chẳng có lý do gì để người dùng chọn bạn thay vì `spec-kit`.

---

## Kết luận & Khuyến nghị của Kiến trúc sư

Việc đập bỏ kiến trúc bảo vệ cơ học (Mechanical Gates/Single-writer) để dùng 100% Markdown mang lại lợi ích về **sự đơn giản, dễ đọc, dễ kêu gọi cộng đồng đóng góp**. Tuy nhiên, đây là một **nước đi tự sát về mặt kiến trúc hệ thống và chiến lược sản phẩm** đối với repo này.

**Khuyến nghị:**
1. **Tuyệt đối KHÔNG gỡ bỏ Hook-denied Gates và Single-writer State.** Đây là "tài sản" duy nhất khiến sản phẩm của chúng ta không thể bị làm giả bằng prompt.
2. **Nhượng bộ một nửa (Hybrid Approach):** Để giải quyết vấn đề "Thuế mở rộng" (Extensibility tax) mà kịch bản Markdown mang lại, hãy giữ lại lớp Code cứng để kiểm duyệt (Validation Engine), nhưng **ẩn hoàn toàn JSON Envelope khỏi giao diện người dùng**. Cho phép người dùng và developer đóng góp bằng Markdown, và hệ thống ngầm tự dịch (parse/compile) Markdown đó thành JSON Envelope để đưa vào Control Plane. 
3. **Thực thi P2-2:** Như báo cáo gốc đã nói, "Anti-lying kit" nên được tách ra. Chúng ta có thể dùng chính cách tiếp cận Markdown của `spec-kit`, nhưng cắm cái Hook cứng của chúng ta vào để bảo vệ quá trình chạy của họ.

*(Báo cáo kết thúc)*
