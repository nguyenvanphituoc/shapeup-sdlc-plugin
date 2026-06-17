# UX Behavior Patterns

Reference for Phase 3 of the BA Pitch Analyzer. Read before writing `ux-behavior.md`.

---

## Deriving Screens From Pitch

From the pitch breadboarding and fat marker sketches, identify:

1. **Entry points** — how does the user reach this feature?
2. **Core interaction** — the primary action the user takes
3. **Decision points** — where does the flow branch?
4. **Exit points** — success path, failure path, abandon path

Each decision point is typically a screen boundary.

---

## State Machine per Screen

Every screen must have a state table. States map to domain aggregate statuses from
`domain-model.md`. Use this as a checklist:

| State | Always Present? | Notes |
|-------|----------------|-------|
| `idle` / `default` | ✅ | Initial mount state |
| `loading` / `submitting` | ✅ | Any async operation |
| `error` | ✅ | Inline field errors vs. page-level errors |
| `empty` | ⚠️ | When list/data can be empty |
| `success` / `done` | ✅ for forms | Show confirmation, not just redirect |
| `disabled` | ⚠️ | When action is conditionally unavailable |

### State Table Format

```markdown
| State | Trigger | UI Behavior | CTA State |
|-------|---------|-------------|-----------|
| `idle` | screen mount | form editable | enabled |
| `validating` | user taps submit | form locked, spinner on CTA | loading |
| `field-error` | validation fails | inline error messages shown | enabled |
| `submitting` | all validation passes | full-screen loader | hidden |
| `success` | API response 200 | redirect or success toast | — |
| `error` | API response 4xx/5xx | error banner, form re-enabled | enabled |
```

---

## Behavior Rules Format

Document explicit rules that aren't obvious from the state machine:

```markdown
### Behavior Rules
- [RULE-01] CTA is disabled until all required fields pass validation
- [RULE-02] Phone number field auto-formats to `0XX XXX XXXX` on blur
- [RULE-03] If `totalAmount < 10,000 VND`, disable VNPay option with tooltip
- [RULE-04] Auto-save draft every 30 seconds when form is dirty
- [RULE-05] Back navigation shows confirmation dialog if form is dirty
```

Number rules so tasks can reference them: `implements [[ux-behavior#RULE-03]]`

---

## Error State Catalog

Every screen must have an explicit error catalog. Categorize:

| Category | Examples | UX Treatment |
|---|---|---|
| **Validation** | Required field, invalid format | Inline, under field, immediate |
| **Business rule** | Insufficient stock, limit exceeded | Inline banner, blocking |
| **Network** | Timeout, offline | Retry button, non-blocking toast |
| **Auth** | Session expired, unauthorized | Redirect to login |
| **Server** | 500, unexpected | Generic error page with support link |

```markdown
### Error Catalog: [ScreenName]

| Error Code | Condition | User Message | Action |
|---|---|---|---|
| `NETWORK_TIMEOUT` | No response in 30s | "Connection is slow, please try again" | [Retry] button |
| `ITEM_UNAVAILABLE` | Stock = 0 at checkout | "Product {name} is out of stock" | [View similar products] |
| `SESSION_EXPIRED` | Token expired | "Your session has expired" | [Log in again] → redirect |
| `PAYMENT_DECLINED` | VNPay returns fail | "Payment failed. Check your account." | [Try another method] |
```

---

## Screen Flow Diagrams

Use ASCII for flows — no Mermaid (Claude Code terminals can't render it):

```
[CartScreen]
    │
    ├─ empty cart ──► [EmptyCartScreen]
    │
    └─ confirm ──► [CheckoutScreen]
                         │
                ┌────────┴────────┐
                │                 │
           address ok         address error
                │                 │
         [PaymentScreen]    [AddressFormScreen]
                │
        ┌───────┼───────┐
        │       │       │
      vnpay   momo    cod
        │       │       │
        └───────┴───┐   │
                    │   └──► [ConfirmationScreen] (cod)
              [VNPayRedirect]
                    │
            ┌───────┴───────┐
            │               │
          success          failed
            │               │
    [ConfirmationScreen]  [PaymentFailedScreen]
```

---

## Mobile vs Web Considerations

Document when behavior differs by platform:

```markdown
### Platform Differences: [ScreenName]

| Behavior | Mobile | Web |
|---|---|---|
| Payment redirect | Deep link back to app | Popup or same tab |
| Address input | Native maps picker | Text autocomplete (Goong) |
| Photo upload | Camera or gallery sheet | File picker |
| Session expired | Toast + slide to login | Modal |
```

---

## Vietnam-Specific UX Patterns

Flag these when relevant to the pitch:

- **VNPay redirect:** User leaves app → payment gateway → returns via deep link or webhook
- **Zalo ZNS:** Transactional messages (not push) — user must be Zalo friend of OA
- **MoMo deep link:** `momo://...` schema, must handle fallback to web
- **Phone as primary identifier:** Format `0XX XXX XXXX`, normalize to `+84` for storage
- **Vietnamese address:** Province → District → Ward → Street — hierarchical dropdown

---

## LITE Lens — ux-behavior.md is the Primary Spec

When `lens: lite`, `ux-behavior.md` is the **most authoritative document** in the spec tree.
It must be more exhaustive than in STANDARD mode. Apply these additional requirements:

### Required additions for LITE

**1. Navigation Stack**

Document the full navigation hierarchy — not just screen flow:

```
Stack Navigator: AppStack
  ├── Tab: HomeTab → HomeScreen
  ├── Tab: OrderTab → OrderListScreen
  │       └── push → OrderDetailScreen
  │               └── push → CheckoutScreen   ← this feature
  │                       └── modal → PaymentWebViewScreen
  └── Tab: ProfileTab → ProfileScreen
```

**2. Offline Behavior Rules**

For every screen that reads or writes data, document offline behavior explicitly:

| Action | Online | Offline | Sync Strategy |
|--------|--------|---------|--------------|
| Load order list | fetch API | show cached data | stale-while-revalidate |
| Submit order | POST /orders | queue locally | sync on reconnect |
| Upload photo | PUT /photos | queue locally | retry × 3 on reconnect |

**3. Gesture and Interaction Specs**

Document non-obvious interactions explicitly — these are not derivable from API contracts:

```
- Pull-to-refresh: triggers full reload, resets pagination
- Long press on order card: show context menu (copy ID, share)
- Swipe left on list item: reveal delete action (iOS) / show checkbox (Android)
- Back gesture during payment: confirm dialog — "Leave payment? Your cart is saved."
```

**4. Platform Differences (mandatory, not optional)**

Every screen must have a Platform Differences sub-section when behavior diverges:

```markdown
### Platform Differences: CheckoutScreen

| Behavior | iOS | Android |
|----------|-----|---------|
| Address picker | Apple Maps sheet | Google Maps bottom sheet |
| Payment deeplink return | Universal Link | Intent filter |
| Keyboard avoidance | KeyboardAvoidingView behavior="padding" | behavior="height" |
| haptic feedback | UIImpactFeedbackGenerator | Vibrator.vibrate(50) |
```

**5. API Stub Contracts (LITE only)**

In LITE mode, tasks use typed fetch wrappers without formal contracts.
Document the assumed API shape inline in ux-behavior.md as a stub:

```typescript
// Assumed API stub — will be replaced by contracts/ in STANDARD upgrade
interface CheckoutAPI {
  submitOrder(payload: SubmitOrderPayload): Promise<{ orderId: string }>
  getPaymentUrl(orderId: string): Promise<{ url: string }>
}
// Source: [[usecases/UC-SubmitOrder#Steps]]
```

This stub is the handoff artifact to the API team if/when STANDARD upgrade happens.

---

## Visual Design Contracts & Figma Integration (Co-authored by Product Designer)

To prevent discrepancies between Figma designs and final UI implementation, the Product Designer and BA co-author the visual section of each screen specification.

### 1. Figma Reference Mapping
For every screen, specify the exact Figma Frame link in the header:
```markdown
Figma Frame: https://www.figma.com/file/XYZ/AppName?node-id=123-456
```

### 2. Visual & Layout Spec Table
Define the layout model, alignment, spacing, and responsive behavior:
```markdown
| Layout Property | Mobile View | Desktop View | Styling Implementation Details |
|---|---|---|---|
| **Structure** | Vertical block (`flex-col`) | Horizontal side-by-side (`flex-row`) | Flexbox with gap size 16px (`gap-4`) |
| **Grid / Columns** | 1 Column | 2 Columns (sidebar/main) | Sidebar: 300px width fixed, Main: flexible |
| **Spacing** | Padding 16px (`p-4`) | Padding 24px (`p-6`) | Keep alignment strictly centered |
| **Typography** | Body: 14px (`text-sm`) | Body: 16px (`text-base`) | Use Outfit font family |
```

### 3. Design Tokens Checklist
Every component must map to the project's standard CSS variables or Tailwind utility classes. Do not use ad-hoc hex codes or absolute layout offsets:
```markdown
| Element | Visual Style / Token | Class/Property | Figma Source |
|---|---|---|---|
| Card Container | Rounded border, light shadow | `bg-card rounded-2xl shadow-sm` | Card Component |
| CTA Button | Brand primary background, bold text | `bg-primary text-white font-bold h-12` | Primary Button |
| Error Message | Brand red text, small font | `text-danger text-xs font-semibold` | Input/Alert Error |
| Border | Divider line | `border-gray-200` | Border line |
```

### 4. Interactive & State Design
Specify the visual styling changes for all active, hover, focused, disabled, and loading states:
```markdown
- **Button Hover**: Darkens background by 10% (`hover:bg-primary-dark`)
- **Input Focus**: Border changes to brand color with subtle outline ring (`focus:border-primary focus:ring-1 focus:ring-primary`)
- **Disabled State**: Button opacity is reduced to 50% (`disabled:opacity-50 disabled:cursor-not-allowed`)
- **Loading Overlay**: Full-screen semi-transparent backdrop (`bg-black/40`) with center spinner
```

