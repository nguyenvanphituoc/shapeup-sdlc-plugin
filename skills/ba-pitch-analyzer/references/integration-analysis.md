# Integration Analysis — System Impact Reference

Reference for Phase 5. Read before writing `integration.md`.

---

## What to Analyze

For every pitch, systematically check these impact categories:

### 1. Internal Services (same monorepo)
- Which packages change their exported interface?
- Which packages add a new dependency?
- Which consumers break if package API changes?

```bash
# Find consumers of a package
grep -r "from '@yourapp/shared'" apps/ --include="*.ts" | cut -d: -f1
grep -r "from '@yourapp/api-client'" apps/ --include="*.ts" | cut -d: -f1
```

### 2. Domain Events (cross-context)
- What events does this feature **emit**? Who currently listens?
- What events does this feature **consume**? What emits them?
- Are there new event subscriptions needed in existing services?

### 3. External APIs
- New third-party integrations (VNPay, Goong, Zalo, etc.)
- Existing integrations that change payload shape
- Webhook endpoints that need to be registered

### 4. Database
- New tables or columns (migration required)
- Existing queries that may be affected by schema change
- Index changes that affect performance
- RLS policies (Supabase) that need updating

### 5. Authentication / Authorization
- New roles or permissions
- New protected routes
- Changes to existing permission checks

### 6. Background Jobs / Queues (Inngest, BullMQ, etc.)
- New jobs triggered by this feature
- Existing jobs whose payload or trigger changes

---

## Impact Severity Scale

Use in integration.md to prioritize:

| Severity | Meaning | Example |
|---|---|---|
| 🔴 Breaking | Existing functionality breaks without coordination | Removing a field from shared DTO |
| 🟡 Additive | New functionality, no breakage but consumers should know | New domain event emitted |
| 🟢 Isolated | Change is fully contained, no downstream effect | New table, no existing code touched |

---

## Integration Section Format

```markdown
## [ServiceName / PackageName]

**Severity:** 🔴 Breaking | 🟡 Additive | 🟢 Isolated
**Direction:** produces → / consumes ← / bidirectional ↔

### What Changes
[1-3 sentences describing the change]

### Data Flow
\`\`\`
[FeatureName] ──[event/call]──► [ServiceName]
              payload: { field1, field2 }
\`\`\`

### Risk
[What could go wrong silently]

### Mitigation
[How to prevent or detect the issue]

### Related Tasks
- [[tasks/TASK-NNN]] — implements this integration point
```

---

## Cross-Context Event Coordination Pattern

When a feature emits events consumed by other bounded contexts:

```markdown
## Event Coordination: OrderPlaced

**Producer:** ordering context (this feature)
**Consumers:**

| Consumer | Reacts To | Action | Owner |
|---|---|---|---|
| inventory ctx | OrderPlaced | Reserve stock | Backend team |
| notification ctx | OrderPlaced | Send order confirmation | Backend team |
| analytics ctx | OrderPlaced | Record conversion event | Data team |

**Coordination needed:** inventory context must deploy event handler BEFORE
this feature goes live, otherwise stock is not reserved on order creation.
Dependency: TASK-008 (this feature) blocks until inventory handler is deployed.
```

---

## Database Migration Impact Checklist

For every schema change, check:

- [ ] Are there existing queries using `SELECT *` that might break on new columns?
- [ ] Are there Drizzle relations that need updating in `schema/relations.ts`?
- [ ] Does the migration need to be run in a specific order with other pending migrations?
- [ ] Are there read replicas that need time to sync?
- [ ] Does existing seed data need to be updated?
- [ ] Are there Supabase RLS policies that reference the table?

---

## Third-Party Integration Entry Checklist

When a pitch introduces a new external service, document:

```markdown
## External: [ServiceName]

**Purpose:** [what we use it for]
**Auth method:** API key | OAuth | Webhook signature
**Sandbox available:** yes | no

### Environment Variables Required
- `[SERVICE]_API_KEY` — [description]
- `[SERVICE]_WEBHOOK_SECRET` — [description]

### Failure Mode
[What happens to the user if this service is down?]
[Is there a graceful degradation path?]

### Rate Limits
[Requests per second/minute/day if known]

### Related Rabbit Hole (from pitch)
[[_index#Rabbit-Holes]]
```
