---
schema: plan-execution-contract/v1
plan: docs/day2_tool_efficacy_review.md
plan_sha256: 55fc3b873d404a52269afa50c33ed59c5bc74094d4f2f3d279a1c49d3651e6f9
title: "Day 2's reduction is an artifact of how \"narrated\" is counted — and on Sonnet the failure it reduces does not happen"
fresh_state: head
commit_per_stage: true
attempt_budget: 3
no_progress_rounds: 2
execute_model: sonnet
diagnose_model: fable
verify_model: haiku
stages: [S0, S1, S2, S3, S4]
skipped_stages: []
---

# Execution contract — Day-2 tool-efficacy plan (rev 5)

The plan's §6 is five stages in one stated order — **withdraw → define → guard → probe → gate**.
That order is load-bearing and the plan says why: the withdrawal must land before anything measures,
and Stage 2's guards fail against a register that still claims a sampled reduction.

**Stage 3 is compiled `Optional: yes` and is not being run.** It is the only stage that spends money
(~$5.8) and the only one that writes outside this repository (a `product_writes` change committed to
`/Users/teo/workspace/sdd-harness-bench`). The operator held it. §7's last bullet is the plan's own
authority for this: *"Stage 3's $5.8 is optional, and Stages 0/1/2/4 remain worth doing because they
are what stop the next unsupported claim."* Nothing in S0/S1/S2/S4 depends on S3's result, so the
dependency chain skips it: **S4 depends on S2**.

**Compiled notes are marked as such.** Every `## Stage` body opens with the plan's own text,
verbatim. Where compilation had to settle something the plan left open, it appears under a
**Compiled note** heading and nowhere else, so a reader can always tell the plan's words from mine.

## Acceptance

`$CLONE` is a fresh `git clone --local` of the stage's commit; `$REPO` is the working repository.
Nothing here writes outward. Four rows deliberately mutate — they mutate the **disposable clone**,
never `$REPO`, and each one first asserts that its own mutation actually bit, because a mutation
that silently fails to apply turns a red-proving row into a row that proves nothing.

**Rows are evaluated at their own stage's commit.** One row asserts intermediate state that a later
stage changes on purpose — S1's `register byte-identical`, which S2 then edits. It is marked
`stage-local` in `note`.

| stage | cmd | cwd | expect_exit | expect_match | expect_absent | note | review |
|---|---|---|---|---|---|---|---|
| S0 | npm test | $CLONE | 0 | structural tests passed \(11[0-9][0-9] checks\) | ❌ | the count range is the anti-shrinkage guard: exit 0 alone also passes a suite that silently ran a fraction of its checks. Baseline at c9e6620 is 1130 |  |
| S0 | node -e "const c=require('./evals/failure-classes.json').classes.find(x=>x.id==='FC-01');const e=[];if(c.reduces!==null)e.push('reduces is '+JSON.stringify(c.reduces));if(c.reduction_basis!==null)e.push('reduction_basis is '+JSON.stringify(c.reduction_basis));if(JSON.stringify(c.co_attributed_to)!==JSON.stringify(['FC-02']))e.push('co_attributed_to is '+JSON.stringify(c.co_attributed_to)+' — Arm B is unaffected and this is where that finding lives');if(e.length){console.error(e.join('; '));process.exit(1)}console.log('FC-01 claims nothing and keeps its co-attribution')" | $CLONE | 0 | FC-01 claims nothing and keeps its co-attribution |  | §6 Stage 0 bullet 2, both clauses |  |
| S0 | node -e "const c=require('./evals/failure-classes.json').classes.find(x=>x.id==='FC-01');const s=c.superseded\|\|[];if(s.length!==2){console.error('FC-01 carries '+s.length+' retired record(s); plan Exit says two');process.exit(1)}const ic=s.filter(x=>x.cause==='instrument-change');if(ic.length!==1){console.error(ic.length+' records retired with cause instrument-change, expected exactly 1 — the v1.6.3 Haiku rate must be RETIRED, not overwritten');process.exit(1)}const k=ic[0];if(k.value!==0\|\|k.n!==3){console.error('the instrument-change record is not the v1.6.3 rate (expected value 0, n 3; got '+k.value+', '+k.n+')');process.exit(1)}const m=k.method\|\|'';const need={'the predicate it counted':/narrated/,'writes===0':/writes\s*===?\s*0/,'the intake write that forecloses it':/intake/i};const miss=Object.entries(need).filter(([,re])=>!re.test(m)).map(([x])=>x);if(miss.length){console.error('the retired record does not record WHY — omits: '+miss.join(', '));process.exit(1)}console.log('two retired records; the v1.6.3 rate is withdrawn carrying its reason')" | $CLONE | 0 | withdrawn carrying its reason |  | §6 Stage 0 bullet 1 — `method` must record *why*, not merely that it happened |  |
| S0 | node -e "const u=require('./evals/failure-classes.json').classes.find(x=>x.id==='FC-01').current;const e=[];if(u.status!=='measured')e.push('current.status is '+u.status);if(u.n!==3)e.push('current.n is '+u.n);if(typeof u.value!=='number'\|\|Math.abs(u.value-1/3)>0.005)e.push('current.value is '+JSON.stringify(u.value)+', plan says 1/3 shipped-nothing');if(u.model!=='claude-haiku-4-5-20251001')e.push('current.model is '+JSON.stringify(u.model)+' — the corrected rate is a HAIKU measurement and must keep saying so');const m=u.method\|\|'';const need={'the Fisher p=0.1071':/0\.107/,'rep 1 zero product writes':/product.write/i};const miss=Object.entries(need).filter(([,re])=>!re.test(m)).map(([x])=>x);if(miss.length)e.push('current.method omits '+miss.join(' and '));if(e.length){console.error(e.join('; '));process.exit(1)}console.log('FC-01.current is the corrected Haiku 1/3 rate, evidenced')" | $CLONE | 0 | corrected Haiku 1/3 rate, evidenced |  | §6 Stage 0 bullet 3 enumerates exactly these: 1/3, measured, Fisher p, rep 1's 0-product-writes |  |
| S0 | node -e "const r=require('./evals/failure-classes.json');const t=r.classes.filter(c=>c.reduces===true);if(t.length!==2){console.error('the exit criterion is met by '+t.length+' class(es) ('+t.map(c=>c.id).join(', ')+'); plan Exit says 2 of 8');process.exit(1)}const ns=t.filter(c=>c.reduction_basis!=='structural');if(ns.length){console.error('claims a non-structural basis: '+ns.map(c=>c.id+':'+JSON.stringify(c.reduction_basis)).join(', ')+' — plan Exit says both structural');process.exit(1)}console.log('2 of '+r.classes.length+' at the exit criterion, both structural')" | $CLONE | 0 | 2 of 8 at the exit criterion, both structural |  | plan Exit, clause 2 — the headline number the whole revision turns on |  |
| S0 | node -e "const n=require('./evals/failure-classes.json').note\|\|'';const need={'the predicate':/predicate/i,'the model it was counted on':/model/i};const miss=Object.entries(need).filter(([,re])=>!re.test(n)).map(([x])=>x);if(miss.length){console.error('the register note omits '+miss.join(' and '));process.exit(1)}console.log('the register note states what a claim is only as good as')" | $CLONE | 0 | what a claim is only as good as |  | §6 Stage 0 bullet 4 |  |
| S0 | node -e "const b=require('./evals/failure-classes.json').classes.find(x=>x.id==='FC-01').baseline;const e=[];if(b.value!==1)e.push('value is '+b.value);if(b.n!==5)e.push('n is '+b.n);if(b.model!=='claude-haiku-4-5-20251001')e.push('model is '+JSON.stringify(b.model));if(b.harness_build!=='a280e86')e.push('harness_build is '+JSON.stringify(b.harness_build));if(b.status!=='measured')e.push('status is '+b.status);if(e.length){console.error('the Haiku baseline was altered — '+e.join('; ')+'. §5: it is valid evidence ABOUT HAIKU and is neither deleted nor re-labelled');process.exit(1)}console.log('the Haiku baseline is untouched')" | $CLONE | 0 | the Haiku baseline is untouched |  | §5 bullet 6 — the withdrawal must not take the baseline with it |  |
| S0 | node -e "const c=require('./evals/failure-classes.json').classes.find(x=>x.id==='FC-02');if(c.reduces!==true\|\|c.reduction_basis!=='structural'){console.error('FC-02 changed: reduces='+JSON.stringify(c.reduces)+' basis='+JSON.stringify(c.reduction_basis));process.exit(1)}console.log('FC-02 untouched — one experiment, one clearance')" | $CLONE | 0 | FC-02 untouched |  | §5 bullet 7: "Do not touch FC-02's `reduces`" |  |
| S0 | git merge-base --is-ancestor 1bb0d73 HEAD | $CLONE | 0 |  |  | S0 landed as `1bb0d73`. S1's unchanged-check diffs the register against that commit, so the commit must be reachable — this replaced a row that hashed the register into a gitignored, machine-specific file, which could not survive the branch moving to another machine |  |
| S1 | npm test | $CLONE | 0 | structural tests passed \(11[0-9][0-9] checks\) | ❌ | plan Exit clause 3 |  |
| S1 | node -e "const s=require('./evals/schemas/day2-failure-class.schema.json');const F=s.\$defs.FailureClass.properties;const ep=F.error_predicate;if(!ep){console.error('FailureClass.error_predicate does not exist');process.exit(1)}const p=(ep.properties)\|\|((ep.items\|\|{}).properties)\|\|{};const miss=['expression','source','counts'].filter(f=>!p[f]);if(miss.length){console.error('error_predicate has no '+miss.join('/')+' sub-field — the plan names all three');process.exit(1)}if(!F.predicate_independence){console.error('FailureClass.predicate_independence does not exist');process.exit(1)}console.log('error_predicate carries expression, source and counts; predicate_independence exists')" | $CLONE | 0 | expression, source and counts; predicate_independence exists |  | §6 Stage 1 items 1 and 2 |  |
| S1 | node -e "const s=require('./evals/schemas/day2-failure-class.schema.json');const R=s.\$defs.Rate.properties;if(!R.model_scope){console.error('Rate.model_scope does not exist — a rate measured on one model is not evidence about another');process.exit(1)}const d=R.model_scope.description\|\|'';if(d.length<40){console.error('Rate.model_scope has no usable description ('+d.length+' chars) — this field exists to be read by a person, not just matched by a check');process.exit(1)}console.log('Rate.model_scope exists and says what it is for')" | $CLONE | 0 | Rate.model_scope exists and says what it is for |  | §6 Stage 1 item 3 |  |
| S1 | node -e "const s=require('./evals/schemas/day2-failure-class.schema.json');const src=[s.\$defs.FailureClass.properties.error_predicate,s.\$defs.FailureClass.properties.predicate_independence].map(x=>JSON.stringify(x)).join(' ');if(!/independen/i.test(src)){console.error('nothing in the two new FailureClass fields explains INDEPENDENCE — item 2 is \"why the registered tool cannot satisfy the predicate with its own output\", which is the question rev 3 never asked');process.exit(1)}console.log('the independence question is written where a reader cannot miss it')" | $CLONE | 0 | the independence question is written where a reader cannot miss it |  | §6 Stage 1 item 2, second sentence |  |
| S1 | git diff --quiet 1bb0d73 HEAD -- evals/failure-classes.json | $CLONE | 0 |  |  | **stage-local** — S2 edits the register on purpose. Diffing against S0's own commit is exact, needs no side-channel file, and travels between machines; the sha-file version it replaced did none of those |  |
| S2 | git checkout -- evals/failure-classes.json && npm test | $CLONE | 0 | structural tests passed \(11[0-9][0-9] checks\) | ❌ | the register must satisfy the new rules, not merely survive them. **Every S2 row restores the register first** — the mutating rows share one clone, and a row that inherits the previous row's mutation proves something nobody wrote down |  |
| S2 | git checkout -- evals/failure-classes.json && node -e "const r=require('./evals/failure-classes.json');const t=r.classes.filter(c=>c.reduces===true);if(t.length!==2\|\|t.some(c=>c.reduction_basis!=='structural')){console.error('S2 disturbed the headline: '+t.map(c=>c.id+':'+JSON.stringify(c.reduction_basis)).join(', ')+' — S0 left 2 of 8, both structural, and populating predicates must not change that');process.exit(1)}console.log('still 2 of 8 at the exit criterion, both structural')" | $CLONE | 0 | still 2 of 8 at the exit criterion, both structural |  | S2 edits the register, so S0's headline is re-asserted at the commit that edits it |  |
| S2 | git checkout -- evals/failure-classes.json && node -e "const fs=require('fs');const f='evals/failure-classes.json';const r=JSON.parse(fs.readFileSync(f,'utf8'));const c=r.classes.find(x=>x.id==='FC-02');if(!c.error_predicate){console.error('the mutation is inert — FC-02 has no error_predicate to strip, so this row would prove nothing');process.exit(1)}delete c.error_predicate;fs.writeFileSync(f,JSON.stringify(r,null,2))" && ! npm test | $CLONE | 0 |  |  | rule 1, red direction. Mutates the DISPOSABLE clone. The inertness pre-check is the lesson of rev 3's false-FAIL rows |  |
| S2 | git checkout -- evals/failure-classes.json && node -e "const fs=require('fs');const f='evals/failure-classes.json';const r=JSON.parse(fs.readFileSync(f,'utf8'));const c=r.classes.find(x=>x.id==='FC-02');if(!c.error_predicate){console.error('inert: FC-02 has no error_predicate, so a red here would be rule 1 firing, not rule 2');process.exit(1)}c.reduction_basis='sampled';c.baseline.n=c.baseline.n\|\|3;c.current.n=c.current.n\|\|3;c.baseline.harness_build=c.baseline.harness_build\|\|'a280e86';c.current.harness_build=c.current.harness_build\|\|'a280e86';c.baseline.model_scope='claude-haiku-4-5-20251001';c.current.model_scope='claude-haiku-4-5-20251001';delete c.predicate_independence;fs.writeFileSync(f,JSON.stringify(r,null,2))" && ! npm test | $CLONE | 0 |  |  | rule 2, red direction: a `sampled` claim with no `predicate_independence`. n/harness_build/model_scope are supplied so the row fails for rule 2 and not for rules 3–5 |  |
| S2 | git checkout -- evals/failure-classes.json && node -e "const fs=require('fs');const f='evals/failure-classes.json';const r=JSON.parse(fs.readFileSync(f,'utf8'));const c=r.classes.find(x=>x.id==='FC-02');if(!c.error_predicate){console.error('inert: FC-02 has no error_predicate, so a red here would be rule 1 firing, not rule 3');process.exit(1)}c.reduction_basis='sampled';c.predicate_independence=c.predicate_independence\|\|'supplied so this row tests the model-scope rule alone';c.baseline.n=c.baseline.n\|\|3;c.current.n=c.current.n\|\|3;c.baseline.harness_build=c.baseline.harness_build\|\|'a280e86';c.current.harness_build=c.current.harness_build\|\|'a280e86';c.baseline.model_scope='claude-haiku-4-5-20251001';c.current.model_scope='claude-sonnet-5';fs.writeFileSync(f,JSON.stringify(r,null,2))" && ! npm test | $CLONE | 0 |  |  | rule 3, red direction — **the row that would have caught this model switch**. A Haiku baseline against a Sonnet current, everything else supplied |  |
| S2 | git checkout -- evals/failure-classes.json && node -e "const fs=require('fs');const f='evals/failure-classes.json';const r=JSON.parse(fs.readFileSync(f,'utf8'));r.note=(r.note\|\|'')+' ';fs.writeFileSync(f,JSON.stringify(r,null,2))" && npm test | $CLONE | 0 | structural tests passed | ❌ | the green direction: a semantically-null edit must leave the suite green. Without this the three red rows are also passed by a rule that fails everything |  |
| S2 | git checkout -- evals/failure-classes.json && node -e "const r=require('./evals/failure-classes.json');const e=[];for(const c of r.classes.filter(x=>x.reduces!==null&&x.reduces!==undefined)){const p=c.error_predicate;if(!p){e.push(c.id+' claims reduces='+c.reduces+' with no error_predicate');continue}if(!p.expression\|\|!p.source\|\|!p.counts){e.push(c.id+'.error_predicate is missing expression/source/counts');continue}const m=String(p.source).match(/^(.+):([0-9]+)$/);if(!m){e.push(c.id+'.error_predicate.source '+JSON.stringify(p.source)+' is not file:line');continue}if(!require('fs').existsSync(m[1])){e.push(c.id+'.error_predicate.source names '+m[1]+', which does not exist');continue}const n=require('fs').readFileSync(m[1],'utf8').split('\n').length;if(+m[2]<1\|\|+m[2]>n)e.push(c.id+'.error_predicate.source points at line '+m[2]+' of a '+n+'-line file')}if(e.length){console.error(e.join('\n'));process.exit(1)}console.log('every claiming class names a predicate whose source resolves to a real file:line')" | $CLONE | 0 | resolves to a real file:line |  | rule 1, green direction, checked independently of the suite so a rule that never runs cannot pass this |  |
| S2 | git checkout -- evals/failure-classes.json && node -e "const c=require('./evals/failure-classes.json').classes.find(x=>x.id==='FC-01');const e=['baseline','current'].filter(w=>!c[w].model_scope);if(e.length){console.error('FC-01 '+e.join(' and ')+' carries no model_scope — §5: the Haiku baseline \"becomes wrong only when read as evidence about Sonnet, which is what the new model_scope field in Stage 1 exists to prevent\"');process.exit(1)}if(!/haiku/i.test(c.baseline.model_scope)){console.error('FC-01.baseline.model_scope is '+JSON.stringify(c.baseline.model_scope)+' — the baseline is a Haiku measurement');process.exit(1)}console.log('FC-01 is model-scoped on both rates: '+c.baseline.model_scope+' → '+c.current.model_scope)" | $CLONE | 0 | FC-01 is model-scoped on both rates |  | the field has to be *used* on the class the plan is about, or Stage 1 shipped decoration |  |
| S3 | BENCH="${BENCH_DIR:-/Users/teo/workspace/sdd-harness-bench}"; test -d "$BENCH/.git" \|\| { echo "benchmark checkout absent at $BENCH — S3's prerequisite is a change committed OUTSIDE this repo; set BENCH_DIR"; exit 1; }; git -C "$BENCH" diff --quiet -- runner/lib/transcript-metrics.mjs runner/metrics.test.mjs \|\| { echo "the benchmark metric change is UNCOMMITTED — S3 says the change is committed there"; exit 1; }; grep -q "product_writes" "$BENCH/runner/lib/transcript-metrics.mjs" && grep -q "shipped_nothing" "$BENCH/runner/lib/transcript-metrics.mjs" && echo "benchmark carries product_writes and shipped_nothing, committed" | $REPO | 0 | committed |  | §6 Stage 3 ¶1: the benchmark change is the stage's **prerequisite** and is committed THERE. This is the one row in the contract that reads outside this repository, which is why it names that fact instead of hiding it, and why it fails loudly rather than skipping when the checkout is absent |  |
| S3 | BENCH="${BENCH_DIR:-/Users/teo/workspace/sdd-harness-bench}"; cd "$BENCH" && node runner/metrics.test.mjs | $REPO | 0 | metrics self-test passed \([7-9][0-9] checks\) | ✗ | the benchmark's own suite, with the same anti-shrinkage guard this contract uses everywhere else — it stood at 48 checks before this stage, so a two-digit count starting at 7 cannot be reached by deleting cases |  |
| S3 | BENCH="${BENCH_DIR:-/Users/teo/workspace/sdd-harness-bench}"; cd "$BENCH" && node -e "import('./runner/lib/transcript-metrics.mjs').then(({transcriptMetrics,failureMode})=>{const W='/tmp/bench-shapeup-sdlc-f2-budgets-r1-zz';const ev=(p)=>JSON.stringify({type:'assistant',message:{content:[{type:'tool_use',name:'Write',input:{file_path:W+'/'+p}}]}});const intake=transcriptMetrics(ev('intake.md'));const code=transcriptMetrics(ev('lib/store.mjs'));const e=[];if(intake.product_writes!==0)e.push('an intake-only run has product_writes '+intake.product_writes+', expected 0');if(code.product_writes!==1)e.push('a code write has product_writes '+code.product_writes+', expected 1');if(failureMode({status:'ok',first_pass_acceptance:0.2857,metrics:intake})!=='shipped_nothing')e.push('an intake-only run is NOT classified shipped_nothing — the corrected predicate does not fire');if(failureMode({status:'ok',first_pass_acceptance:0.2857,metrics:code})==='shipped_nothing')e.push('a run that wrote product code IS classified shipped_nothing — the predicate does not discriminate');if(failureMode({status:'cut',first_pass_acceptance:0.2857,metrics:intake})==='shipped_nothing')e.push('a run CUT from outside is classified shipped_nothing — it was never allowed to reach the point where shipping happens');if(e.length){console.error(e.join('; '));process.exit(1)}console.log('product_writes discriminates in both directions, and a run stopped from outside is not counted')})" | $REPO | 0 | discriminates in both directions |  | the suite above is the benchmark's own; this asserts the behaviour directly, so a suite that silently stopped running these cases cannot carry the row. The third clause is the one the record forced: 87 `cut` rows are the handoff protocol's deliberate mid-run cut and every one of them has written nothing yet |  |
| S3 | node -e "const c=require('./evals/failure-classes.json').classes.find(x=>x.id==='FC-01');const m=JSON.stringify(c);const need={'the corrected predicate (product_writes)':/product[_ ]writes/i,'the model the class was probed on':/sonnet/i,'a stated n for that probe':/n\s*=\s*[0-9]/i};const miss=Object.entries(need).filter(([,re])=>!re.test(m)).map(([x])=>x);if(miss.length){console.error('FC-01 does not record S3s outcome — omits: '+miss.join(', '));process.exit(1)}console.log('FC-01 records the Sonnet outcome, the predicate that decided it, and the n behind it')" | $CLONE | 0 | the predicate that decided it, and the n behind it |  | plan Exit, branch 2: *"a recorded, evidenced statement that FC-01's class does not occur on Sonnet, which is an equally successful stage"*. **Recorded** means in the register, not in a document; **evidenced** means it carries its predicate and its n |  |
| S3 | node -e "const c=require('./evals/failure-classes.json').classes.find(x=>x.id==='FC-01');const rates=[['baseline',c.baseline],['current',c.current]].concat((c.superseded\|\|[]).map((r,i)=>['superseded['+i+']',r]));const son=rates.filter(([,r])=>/sonnet/i.test(r.model\|\|'')\|\|/sonnet/i.test(r.model_scope\|\|''));if(son.length){console.error('FC-01 carries '+son.length+' Sonnet-scoped rate(s) ('+son.map(([k])=>k).join(', ')+') — no Sonnet arm was bought, so a Sonnet RATE here was not measured');process.exit(1)}console.log('no Sonnet rate on FC-01: the after-arm was not bought and no Sonnet number was fabricated')" | $CLONE | 0 | no Sonnet number was fabricated |  | the anti-fabrication row. §5: *"Do not buy a Sonnet after-arm before establishing the Sonnet baseline"* — and a stage that records a rate it did not pay for is the failure this whole plan is about. This row can fail |  |
| S3 | node -e "const r=require('./evals/failure-classes.json');const s=r.classes.filter(c=>c.reduction_basis==='sampled');if(s.length){console.error(s.length+' class(es) claim a sampled basis ('+s.map(c=>c.id).join(', ')+') — S3 bought no arm, so none can have been established by it');process.exit(1)}console.log('no class claims a sampled reduction: Day 2 stays unclaimed on that basis')" | $CLONE | 0 | stays unclaimed on that basis |  | the disposition table, row 1: *"Day 2's sampled claim must come from another class or stay unclaimed"* |  |
| S3 | node -e "const r=require('./evals/failure-classes.json');const t=r.classes.filter(c=>c.reduces===true);if(t.length!==2){console.error('the exit criterion is met by '+t.length+' class(es) ('+t.map(c=>c.id).join(', ')+'); S3 changes no verdict, so it must still be 2');process.exit(1)}const ns=t.filter(c=>c.reduction_basis!=='structural');if(ns.length){console.error('claims a non-structural basis: '+ns.map(c=>c.id).join(', '));process.exit(1)}console.log('still 2 of '+r.classes.length+' at the exit criterion, both structural')" | $CLONE | 0 | still 2 of 8 at the exit criterion, both structural |  | S3 records a finding; it moves no headline. The row exists so that recording one cannot quietly move it |  |
| S3 | npm test | $CLONE | 0 | structural tests passed \(11[0-9][0-9] checks\) | ❌ | the register edit must not cost the suite |  |
| S4 | npm test | $CLONE | 0 | structural tests passed \(11[0-9][0-9] checks\) | ❌ | the gate must not cost the suite |  |
| S4 | test -f .claude/skills/plan-executor/scripts/parse-contract.mjs | $CLONE | 0 |  |  | it must survive a clone, or the next run has no parser |  |
| S4 | node .claude/skills/plan-executor/scripts/parse-contract.mjs --selftest | $CLONE | 0 | escaped pipe | FAIL | one parser, and its selftest must cover the `\\\|` case that produced the comment-written-to-satisfy-a-grep |  |
| S4 | git checkout -- .claude/skills/plan-executor/workflows/execute-plan.js && node -e "const s=require('fs').readFileSync('.claude/skills/plan-executor/workflows/execute-plan.js','utf8');const n=(s.match(/parse-contract\.mjs/g)\|\|[]).length;if(n<2){console.error('parse-contract.mjs is referenced '+n+' time(s) in the workflow — BOTH readers (the acceptance verifier and the stage executor) must go through the one parser');process.exit(1)}console.log('both readers go through one parser ('+n+' references)')" | $CLONE | 0 | both readers go through one parser |  | §6 Stage 4 item 3: "Ship one parse-contract.mjs **both readers** import" |  |
| S4 | git checkout -- .claude/skills/plan-executor/workflows/execute-plan.js && node .claude/skills/plan-executor/tests/execute-plan.gate.mjs --selftest | $CLONE | 0 | zero-work gate | FAIL | §6 Stage 4 items 1–2: absent args exits non-zero, and a stage list of `[]` cannot report `complete` |  |
| S4 | git checkout -- .claude/skills/plan-executor/workflows/execute-plan.js && node .claude/skills/plan-executor/tests/execute-plan.gate.mjs --selftest > /dev/null && node -e "const fs=require('fs');const f='.claude/skills/plan-executor/workflows/execute-plan.js';const s=fs.readFileSync(f,'utf8');const out=s.split('\n').filter(l=>!/execute-plan:/.test(l)).join('\n');if(out===s){console.error('no execute-plan: guard message found to remove — the mutation is inert and this row proves nothing');process.exit(1)}fs.writeFileSync(f,out)" && ! node .claude/skills/plan-executor/tests/execute-plan.gate.mjs --selftest | $CLONE | 0 |  |  | the gate is load-bearing: **green before the mutation, red after**. Without the leading run this row is satisfied by the gate test being ABSENT — which is how a missing check reads as a passing one |  |

## Guardrails

The plan's §5, verbatim. These bind every agent in this run as hard as the stage instructions do.

- **Do not buy a Sonnet after-arm before establishing the Sonnet baseline.** At $6.70/rep it is
  $26.8 for n=4, and §2(e) says the thing it would measure may not exist. The baseline probe is
  $5.8 and answers whether the rest is worth buying.
- **Do not compare a Sonnet current against the Haiku baseline.** Different model, different
  instrument. This is the pooling rule, and switching the floor model is exactly the moment it gets
  broken by accident.
- **Do not buy more reps against the current metric.** 0/6 at p = 0.0022 would be a more confident
  measurement of the wrong thing.
- **Do not patch 0/3 to 1/3 and keep `reduces: true`.** p = 0.107 does not meet the criterion.
- **Do not delete the v1.6.3 Haiku rate.** It is a real measurement of a real cell; it retires with
  `cause: "instrument-change"` and stays addressable.
- **Do not delete or re-label the Haiku baseline either.** It is valid evidence *about Haiku*. It
  becomes wrong only when read as evidence about Sonnet, which is what the new `model_scope` field
  in Stage 1 exists to prevent.
- **Do not touch FC-02's `reduces`.** One experiment, one clearance.
- **Do not redefine `failureMode()` in this repo.** It belongs to the benchmark; this repo records
  which predicate it relied on.
- **Do not treat "product writes" as obviously correct.** It is better, not proven, and Stage 1's
  `predicate_independence` exists so the next revision can attack it as this one attacked `narrated`.
- **Do not fix the plan-executor by asking agents to be careful.** Its failure — a run that executed
  zero stages and returned `"outcome":"complete"` — is FC-01's class. It needs a gate.

**Compiled guardrails** — not the plan's words, but binding here:

- **Stage 3 is not being run.** Do not run the benchmark, do not spend money, do not write anything
  into `/Users/teo/workspace/sdd-harness-bench`. If a stage seems to need a Sonnet number, that is a
  reason to stop and say so, not to go and measure one.
- **Never mutate `$REPO` from an acceptance row.** The four mutating rows operate on `$CLONE`, which
  is thrown away.
- **Commit to this branch only.** No push, no tag, no pull request.

## Stage S0 — Withdraw the unsupported claim

**Depends on:** —
**Optional:** no
**Exit criterion:** `npm test` green; **2 of 8** at the exit criterion, both `structural`; FC-01 carries two retired records and no claim.
**Estimate:** ~30 min · $0

- `FC-01.current` (the v1.6.3 Haiku rate, 0.0 n=3) → `superseded[]`, `cause: "instrument-change"`,
  with `method` recording *why*: the rate counted `failureMode() === "narrated"`, whose predicate is
  `writes === 0`, which this harness's own intake write forecloses.
- `FC-01.reduces` → `null`; `reduction_basis` → `null`. `co_attributed_to` **stays** `["FC-02"]` —
  Arm B is unaffected and this is where that finding lives.
- `FC-01.current` becomes the corrected Haiku rate: **1/3 shipped-nothing**, `measured`, carrying
  Fisher p = 0.1071 and rep 1's 0-product-writes evidence in `method`.
- The register `note` gains: **a claim is only as good as the predicate its rate counted, and both
  the predicate and the model it was counted on must be recorded.**

### Supporting evidence from the plan

§0: *"Arm A rep 1 wrote one file (`intake.md`), shipped **zero product code**, scored the baseline's
own 0.2857 with 10 escaped defects, and was recorded as *not* narrated; counted honestly the arm is
**1/3**, Fisher **p = 0.107**, not 0.018."*

§3: *"The claim must be withdrawn, not patched. Day 1's precedent is HD-004: withdraw an
apparatus-fault measurement rather than repair it. The register already has the vocabulary —
`superseded[].cause = "instrument-change"`. Patching 0/3 to 1/3 in place would leave a `sampled`
basis at p = 0.107 claiming an exit criterion it does not meet."*

### Compiled note

The register already carries one retired record on FC-01 (`cause: "re-measure"`, the v1.5 rate).
"FC-01 carries two retired records" therefore means: keep that one, and add the v1.6.3 rate as a
second with `cause: "instrument-change"`. Do not merge, re-label or drop the existing one.

**Superseded, kept for the record.** This note used to ask for the register's sha to be written to
`.plan-runs/day2-rev5/s0-register.sha256`, and S0's and S1's checks read it back by absolute path.
That could not survive the branch moving to another machine, and it hashed a value nobody had
committed. Both rows are now git-based and need no side-channel file: S0 asserts
`git merge-base --is-ancestor 1bb0d73 HEAD`, and S1 diffs the register against that same commit.
**Do not create `s0-register.sha256`.** Nothing reads it.

## Stage S1 — Make the predicate and the model scope into fields

**Depends on:** S0
**Optional:** no
**Exit criterion:** schema round-trips; register unchanged; `npm test` green.
**Estimate:** ~60 min · $0

Add to `day2-failure-class.schema.json`:

1. **`error_predicate`** on `FailureClass`, required whenever `reduces` is non-null:
   `{ expression, source, counts }` — the mechanical rule deciding membership, the `file:line`
   implementing it, and what it counts. FC-01's would read
   `failureMode()==="narrated" ⇔ writes===0 && ended_on_promise` @ `transcript-metrics.mjs:208`.
2. **`predicate_independence`**, required alongside it: why the registered tool cannot satisfy the
   predicate with its own output, and the check establishing it. The question rev 3 never asked, in
   the one place a reader cannot miss it.
3. **`model_scope`** on `Rate` — required when `status: "measured"`. A rate measured on one model is
   not evidence about another, and with Sonnet now the floor this stops being hypothetical.

### Compiled note — where "required" is enforced

The plan gives this stage two obligations that cannot both be met by a JSON-Schema `required`
keyword: *"required whenever `reduces` is non-null"* / *"required when `status: "measured"`"*, and
*"register unchanged; `npm test` green"*. Today's register has three classes with measured rates and
no `model_scope`, and two classes claiming `reduces` with no `error_predicate`. A hard `required` at
this stage makes the register schema-invalid, §48(f) fails, and the suite goes red — so the stage
would fail its own Exit line.

So the obligation is **declared here and enforced in Stage 2**, which is where the plan puts the
mechanical rules and where its Exit line is explicitly *"not a green suite"*:

- Declare all three fields with their sub-shapes and descriptions. `error_predicate` carries
  `expression`, `source`, `counts`; `predicate_independence` states the independence question in
  prose a reader meets at the field; `model_scope` says what it is for.
- Write the obligation into each field's `description` — the same way `Rate.harness_build` documents
  its three states — but do **not** add a `required`/`if-then` that today's register violates.
- Change nothing in `evals/failure-classes.json`. Stage 1's acceptance re-hashes it.

Stage 2 then adds the rules that make the obligation bite, and populates the register to satisfy
them. If you disagree with this split, say so in `blocked_reason` rather than making the register
change here — the stage boundary is the reviewable unit.

## Stage S2 — Guard all three

**Depends on:** S1
**Optional:** no
**Exit criterion:** **not a green suite** — stripping any of the three from a claiming class must turn the suite **red**; a semantically-null edit must leave it green.
**Estimate:** ~60 min · $0

Three rules in `48-day1-day2.mjs`, each **mutation-verified in both directions**:

1. `reduces !== null` requires a non-empty `error_predicate` whose `source` resolves to a real
   `file:line`.
2. `reduction_basis: "sampled"` requires `predicate_independence` present and non-empty.
3. **`reduction_basis: "sampled"` requires `baseline.model_scope === current.model_scope`** — the
   mechanical form of §5's pooling rule, and the one that would have caught this model switch
   silently invalidating FC-01.

### Compiled note — the register work this stage implies

Rule 1 applies to every class with `reduces !== null`. After Stage 0 that is FC-02 and FC-04, and
neither carries an `error_predicate`. Rule 1 is therefore red on arrival unless this stage also
populates them. That is the plan's intent, stated in its own Appendix: *"whether the other seven
classes' implied predicates are tool-independent, [is] which Stage 1 would force each to answer."*

So this stage does three things, in this order:

1. Populate `error_predicate` on **FC-02** and **FC-04** — the two structural claimants. Each needs
   `expression` (the mechanical rule), `source` (a real `file:line` in this repo — §48's rules
   resolve it and will fail on a dangling one), and `counts` (what the number counts). FC-02's
   predicate is the inert-enforcement scan; FC-04's is the fabricated-baseline invariant. Their
   existing `current.method` prose already describes both — turn that into the field.
2. Populate `model_scope` on **FC-01**'s `baseline` and `current`. Both are Haiku measurements and
   §5 says so explicitly. Other classes' rates may be filled in too where the model is known
   (`model: null` classes are structural counts, where a model scope may honestly be absent or
   `"model-independent"` — say which, do not invent one).
3. Add the three rules. Rules 2 and 3 are vacuous against today's register — nothing claims
   `sampled` any more — which is why their acceptance rows *construct* a sampled claim in the
   disposable clone and assert the suite goes red.

Do not add a fourth rule. The plan names three, and a diff bigger than the stage is a diff nobody
can review against it.

## Stage S3 — Probe the Sonnet baseline before buying anything

**Depends on:** S2
**Optional:** no — the hold was lifted by the operator on 2026-08-07
**Exit criterion:** a Sonnet baseline rate carrying `model_scope`, `harness_build` and an `error_predicate` naming `product_writes === 0` — **or** a recorded, evidenced statement that FC-01's class does not occur on Sonnet, which is an equally successful stage.
**Estimate:** ~35 min · **$5.8**

Add `product_writes` to the benchmark — writes excluding the harness's own state roots (`.shapeup/`,
`.shapeup-sdlc/`, `shapeup/`) and its intake/pitch documents — plus a `shipped_nothing` mode meaning
`product_writes === 0`. Benchmark change, committed there, **prerequisite** of this stage.

Then run **the baseline, not the after-arm**: `f2-budgets` / **`claude-sonnet-5`** /
`shapeup-sdlc` at the **pre-fix build `a280e86`**, n = 3, ~$1.92/rep ≈ **$5.8**. This is the cheapest
question that decides everything downstream, and §2(e)'s n=1 says the likely answer is *no collapse*.

**Known risk, stated:** today's adapter passes `--gate-answers ci` and `--wall-clock-budget`, whose
implementing scripts do not exist at `a280e86`. If the reps fail for adapter reasons that is an
**instrument fault — discard the arm, change nothing** (rev 3's Arm C disposition table).

| Probe outcome | Disposition |
|---|---|
| 0/3 shipped-nothing (the class does not occur on Sonnet) | **Stop.** FC-01 is recorded as a Haiku-scoped finding via `model_scope`; no Sonnet after-arm is bought; Day 2's sampled claim must come from another class or stay unclaimed. |
| 1–2 of 3 | The class occurs but is not zero-variance. Record the baseline and decide the after-arm on its own merits. |
| 3/3 | The collapse reproduces on Sonnet. **Then** buy the after-arm: n = 4 at v1.6.3, ~$6.70/rep ≈ **$26.8** — n=4 because 0/4 vs a 3/3 baseline clears p<0.05 with room where 0/3 barely does. |
| Fails for adapter reasons | Instrument fault. Discard, change nothing, and say so. |

### Compiled note

**The hold was lifted and this stage now carries eight acceptance rows.** Two things about them
that a reader is entitled to know before trusting them:

**1. They were compiled AFTER the prerequisite was built, not before.** Every other stage in this
contract had its rows written before any work; S3's were written once the benchmark change existed
and the transcripts had been re-scored. That is a weaker guarantee and it is stated rather than
hidden. What limits the damage is that the rows are derived from the plan's own `Exit:` line and
its disposition table — quoted in each row's `note` — and that two of them (`no Sonnet number was
fabricated`, `still 2 of 8`) are written to catch this stage overreaching rather than to confirm
it succeeded.

**2. The paid arm was NOT bought, and the rows do not pretend otherwise.** §6 Stage 3 asks for n=3
Sonnet reps at the pre-fix build `a280e86`. That arm is **not purchasable with today's adapter**,
and the reason is mechanical rather than a matter of judgement:

- The adapter requires run evidence — `requireEvidence: [".shapeup/*/receipt.json",
  ".shapeup-sdlc/*/receipt.json"]` (`harnesses/shapeup-sdlc/adapter.mjs`).
- That receipt is written by `skills/tech-lead/scripts/init-run.mjs`, which **first exists at
  `36521ba` (v1.4.0)**. At `a280e86` the string `receipt.json` does not appear anywhere in the
  tree (`git grep receipt.json a280e86` → empty).
- So every rep at `a280e86` is scored `harness_unreachable`, `scored: false`, and excluded by
  PROTOCOL §8. **The record already contains 14 such rows**, five of them this exact cell.

`a280e86` is the *pre-fix* build precisely because it predates `init-run.mjs`; the adapter demands
the artifact whose absence defines the build. The two are mutually exclusive **by construction** —
the same shape of defect as the one this whole plan is about, one level up in the instrument. This
is the plan's own §7 falsifier (*"if the pre-fix build cannot be driven by today's adapter"*) and
its disposition-table row 4 (*"instrument fault — discard, change nothing, and say so"*), reached
for **$0** instead of $5.8.

The question the arm was to answer was then answered from transcripts already paid for, which is
what these rows verify. See `REPORT.md` for the numbers.
---

## S3 on the other machine — blocked, 2026-08-08 (historical; superseded here)

Everything below records a second session on a machine that **did not have** the benchmark. It is
kept rather than dropped for two reasons: its exhausted-search list is what stops a future session
repeating eight dead ends, and deleting a determination that was correct where it was made — merely
because a later one disagrees — is how a record turns into a story. Its verdict held **there**. This
machine is the one its own runbook points at, and here S3 ran and went green.

### Feasibility determination — attempted 2026-08-08, blocked, not run

A later session was asked to execute S3 and was authorised to do whatever setup this machine
needed. **It cannot be set up here.** The determination is derived, not asserted — re-run it:

```bash
node .plan-runs/day2-rev5/s3-feasibility.mjs   # exit 0 runnable · exit 3 blocked
```

| # | question | answer |
|---|---|---|
| C1 | benchmark at its recorded path `/Users/teo/workspace/sdd-harness-bench` | **no** — `/Users/teo` does not exist on this machine |
| C2 | benchmark reachable anywhere on this machine | **no** — nothing matching `*harness-bench*` under `/Users` or `/Volumes`; the plan records it as author-owned **with no git remote**, and no such repository exists under the authenticated GitHub account, so it cannot be cloned either |
| C3 | adapter prerequisites present at pre-fix build `a280e86` | **no** — `gate-answers.mjs` and `budget-check.mjs` are absent under *any* path at that commit (both present at HEAD) |

Asked and answered before concluding: **is the other machine reachable from here?** No —
`~/.ssh/config` holds only git forges (gitlab, github, unfuddle), there are no SMB/AFP/NFS mounts,
and `tmutil` reports no backup destination. There is no route to fetch the benchmark over.

**The search was exhausted across eight axes** — recorded path; name anywhere under `/Users` and
`/Volumes`; content signature (`transcript-metrics.mjs`, `runs.jsonl`, `FINDINGS.md`,
`*f2-budgets*`); adapter directory names (`spec-kit`, `cc-sdd`, `openspec`); recent archives;
cloud-storage mounts; **the npm registry** (`sdd-harness-bench` → 404, unpublished); and **a global
GitHub search** (0 results, not merely absent from the authenticated account). Do not repeat these.
The `cc-sdd` package that *does* exist on npm is one of the benchmark's comparison harnesses, not
the benchmark. The second checkout at `/Users/liberty/workspace/proj-harness-plugin` is this same
plugin at `b33579d`.

**Why C1/C2 are decisive on their own.** S3 needs the benchmark for *both* halves: the
`product_writes` change is committed **there** (the plan calls it a prerequisite), and the n=3 reps
run through its runner, adapters and hidden scorer — none of which this repository contains.
Reconstructing a lookalike benchmark would produce a **different instrument**, which is precisely
the pooling error this plan exists to refuse (§5: *"a different fingerprint is a DIFFERENT
instrument and must not be pooled"*). So the arm was not simulated, approximated, or bought.

**What C3 adds, and what it does not.** It settles the repository-side half of the plan's own
"Known risk" from primary evidence rather than from the plan's assertion. It does **not** establish
that the reps would fail — the adapter itself lives in the unreachable benchmark, and only running
it could show that. Recorded as corroboration, not as a result.

**No claim was moved.** Per §7 — *"If the pre-fix build cannot be driven by today's adapter … FC-01
cannot be re-based on Sonnet at all, and the honest terminal state is FC-01 permanently
Haiku-scoped with `reduces: null`"* — the register is **already in that state** (C4 in the probe:
`reduces: null`, `reduction_basis: null`, both rates `model_scope: claude-haiku-4-5-20251001`),
left there by S0–S2. Nothing was edited to make that true and nothing needs to be.

### Operator disposition — 2026-08-08: blocked determination accepted, S3 closed here

The blocker was put to the operator with four options: transfer the benchmark to this machine and
run S3 for real; accept the blocked determination; draft the `product_writes` patch blind; or
reconstruct a benchmark locally. **The operator chose to accept the blocked determination.**

So S3 is **closed on this machine as blocked** — not abandoned, and not green. It carries no rate,
claims nothing, and leaves the register exactly as S0–S2 left it. It reopens on the machine that
holds the benchmark, via the runbook below. The two paths deliberately declined are worth naming so
nobody re-proposes them without meeting the objection: a **blind patch** would be written against a
`transcript-metrics.mjs` nobody here has read, and a **local reconstruction** would be a different
instrument whose numbers cannot be compared to the Haiku baseline — §5's pooling rule.

### Compiled acceptance — superseded by the eight live rows

**These four were held out of the live table** so that a stage nobody had attempted could not report
`S3=RED` — a red meaning "not done" being indistinguishable from one meaning "done wrong". They were
superseded on 2026-08-07 by the **eight** rows now live in `## Acceptance`, which put the same
questions and add four more: the benchmark's own suite, its anti-shrinkage guard, the
`product_writes` behaviour asserted directly, and the headline-immobility row. Kept for comparison,
**not for promotion** — promoting them now would duplicate live coverage.

Row 2 accepts **either** branch of the plan's `or` exit criterion and names which one it found.

| stage | cmd | cwd | expect_exit | expect_match | expect_absent | note | review |
|---|---|---|---|---|---|---|---|
| S3 | npm test | $CLONE | 0 | structural tests passed \(11[0-9][0-9] checks\) | ❌ | recording the probe's outcome must not cost the suite |  |
| S3 | node -e "const c=require('./evals/failure-classes.json').classes.find(x=>x.id==='FC-01');const rates=[c.baseline,c.current].concat(c.superseded\|\|[]).filter(Boolean);const A=rates.find(r=>/sonnet/i.test(String(r.model_scope\|\|''))&&r.harness_build&&/product_writes/.test(JSON.stringify(c.error_predicate\|\|null)));if(A){console.log('S3 branch A: Sonnet-scoped rate recorded at build '+A.harness_build);process.exit(0)}const t=JSON.stringify(c);const B=/sonnet/i.test(t)&&/does not occur\|no collapse\|did not reproduce\|instrument fault/i.test(t);if(B){console.log('S3 branch B: an evidenced Sonnet statement is recorded');process.exit(0)}console.error('FC-01 records neither a Sonnet-scoped rate (branch A) nor an evidenced not-on-Sonnet statement (branch B) — the exit criterion names both and requires one');process.exit(1)" | $CLONE | 0 | S3 branch |  | the plan's Exit is an `or`; this row is satisfied by either disposition and by neither absence |  |
| S3 | node -e "const b=require('./evals/failure-classes.json').classes.find(x=>x.id==='FC-01').baseline;const e=[];if(b.value!==1)e.push('value is '+b.value);if(b.n!==5)e.push('n is '+b.n);if(!/haiku/i.test(String(b.model_scope\|\|'')))e.push('model_scope is '+JSON.stringify(b.model_scope));if(b.harness_build!=='a280e86')e.push('harness_build is '+JSON.stringify(b.harness_build));if(e.length){console.error('S3 altered the Haiku baseline — '+e.join('; ')+'. §5: it is valid evidence ABOUT HAIKU and is neither deleted nor re-labelled');process.exit(1)}console.log('the Haiku baseline survived the Sonnet probe')" | $CLONE | 0 | the Haiku baseline survived the Sonnet probe |  | §5 bullet 5 and 6 — buying a Sonnet rate must not consume the Haiku one |  |
| S3 | node -e "const c=require('./evals/failure-classes.json').classes.find(x=>x.id==='FC-01');if(c.reduction_basis!=='sampled'){console.log('FC-01 claims no sampled reduction — the pooling rule is not engaged');process.exit(0)}const b=String(c.baseline.model_scope\|\|''),u=String(c.current.model_scope\|\|'');if(b!==u){console.error('FC-01 claims a SAMPLED reduction across model scopes: baseline '+JSON.stringify(b)+' vs current '+JSON.stringify(u)+' — §5: a different model is a different instrument and must not be pooled');process.exit(1)}console.log('sampled claim is within one model scope: '+b)" | $CLONE | 0 | FC-01 claims no sampled reduction\|within one model scope |  | the pooling rule at the exact moment S3 could break it — a Sonnet current against the Haiku baseline |  |

### Runbook — what to do on the machine that holds the benchmark *(executed here, 2026-08-07)*

1. `node .plan-runs/day2-rev5/s3-feasibility.mjs` — must exit **0** there. If C3 still fails, the
   pre-fix build cannot be driven and the plan's *"Fails for adapter reasons → instrument fault,
   discard, change nothing, and say so"* disposition applies before any money is spent.
2. In the benchmark: add `product_writes` (writes excluding `.shapeup/`, `.shapeup-sdlc/`,
   `shapeup/` and intake/pitch documents) and a `shipped_nothing` mode meaning
   `product_writes === 0`. **Commit it there** — it is that repository's change, not this one's.
3. Run `f2-budgets` / `claude-sonnet-5` / `shapeup-sdlc` at `a280e86`, **n = 3**, ≈ **$5.8**.
4. Apply §6's disposition table by outcome, record it in the register, promote the four rows above
   into `## Acceptance`, and re-run `preflight.mjs`.

**What actually happened when it was followed, step by step:**

1. **Step 1 did not gate as designed.** `s3-feasibility.mjs` still exits 3 here — but its C2 check
   contradicts its own C1: C1 finds the benchmark at its recorded path, C2 then reports nothing
   matching `*harness-bench*` under `/Users`. The blocker is in the probe, not the machine. The
   stage proceeded on the strength of C1 plus a working benchmark suite; the probe is open item 6
   in `REPORT.md` and is deliberately left unpatched rather than fixed mid-merge.
2. **Step 2 was done and committed there** — `sdd-harness-bench @ d3787fa`, `product_writes` plus a
   `shipped_nothing` mode, self-tests 48 → 76.
3. **Step 3 was not bought, and could not be.** C3's shape turned out to be decisive after all: the
   adapter requires `.shapeup/*/receipt.json`, `init-run.mjs` first writes it at v1.4.0, and
   `a280e86` is the pre-fix build *because* it predates that. Instrument fault → disposition row 4,
   reached for $0 rather than $5.8. The question was answered instead from transcripts already paid
   for: **0 of 8 scored Sonnet `shapeup-sdlc` rows ship nothing, against 7 of 16 on Haiku** — n=8,
   not the n=3 the arm would have bought.
4. **Step 4 was applied**: disposition table row 1 (the class does not occur on Sonnet) → FC-01
   recorded as Haiku-scoped, no after-arm, eight rows live in `## Acceptance`, `preflight.mjs S3`
   green 8/8 at `f0b33d7`.

## Stage S4 — Gate the plan-executor

**Depends on:** S2
**Optional:** no
**Exit criterion:** an invocation with absent args exits non-zero; a stage list of `[]` cannot report `complete`; one parser, one test proving both readers agree on an escaped pipe.
**Estimate:** ~45 min · $0

Rev 3's executor returned `"outcome":"complete"` having executed **zero** stages, because `args`
never reached the script and every field read `undefined`. It spent 97k tokens reading like a clean
run. That is FC-01's error class inside the tool executing the plan about FC-01's error class.

1. **Validate the payload before any model call** — missing `repo`/`workdir`/a non-empty `stages`
   array throws rather than iterating an empty list.
2. **Zero-work gate** — a run with an empty stage list, or which produced no commit and no freeze
   directory, exits non-zero and may not report `complete`. Modelled on `hooks/gate-zerowork.mjs`,
   which exists in this repo for exactly this failure.
3. **One contract parser.** The `\|` escaping in the acceptance table was unescaped by one verifier
   and read as a literal pipe by another, which produced a comment written to satisfy a grep. Ship
   one `parse-contract.mjs` both readers import. *(This is the plan-executor's own contract, not
   `skills/tech-lead/scripts/lib/contract-md.mjs`, which parses scope contracts and is unrelated —
   the external review conflated the two.)*

### Compiled note — what is already done, and the two artifact names

**Item 1 already landed.** `.claude/skills/plan-executor/workflows/execute-plan.js:21-26` already
parses a string-encoded `args` and throws when `repo`, `workdir` or a non-empty `stages` is missing.
Do not re-implement it. Confirm it, and make sure the gate test covers it.

**Item 2 is the open one.** The report path still computes
`outcome = !unfinished.length ? 'complete' : …` (`:525`), so a run whose `selected` list came out
empty produces `rows = []`, `unfinished = []`, and reports `complete` — the exact defect. The gate
must refuse: a run that ends with no green stage, no commit and no freeze directory may not report
`complete`, and must fail loudly.

**The two readers of the acceptance table** are `RUN_ACCEPTANCE` (`:145`, used by both the preflight
and the per-stage verifier) and `executePrompt` (`:195`, which tells the executing agent to read
"the Acceptance rows for `<id>` for what will judge it"). Both read the markdown table by eye today;
that is the divergence item 3 names. Both must go through the parser.

**Names, compiled — the plan names only `parse-contract.mjs`:**

- `.claude/skills/plan-executor/scripts/parse-contract.mjs` — the one parser. Supports `--selftest`,
  which must exercise the escaped-pipe case (`\|` inside a `cmd` cell unescaping to a literal `|`)
  and print the words `escaped pipe`. Exit non-zero and print `FAIL` if any case fails.
- `.claude/skills/plan-executor/tests/execute-plan.gate.mjs` — the gate test. Supports `--selftest`,
  prints the words `zero-work gate`, exits non-zero and prints `FAIL` on any failure. It must cover
  at least: absent/undefined args refuses; `stages: []` refuses; and a completed run with no green
  stage, no commit and no freeze directory cannot report `complete`.

**Both refusals must carry the string `execute-plan:` in their message.** An acceptance row strips
every line containing `execute-plan:` from the workflow in a disposable clone and requires the gate
test to go red — that is what proves the gate is load-bearing rather than merely present.

`execute-plan.js` uses workflow-runtime globals (`args`, `agent`, `parallel`, `phase`, `log`,
`budget`) and top-level `await`, so it cannot simply be `import`ed. Evaluating its source in a
`node:vm` context with those globals stubbed is the straightforward way to test it; any approach
that exercises the real refusal paths is acceptable, but asserting on the source text alone is not —
a grep is what item 3 exists to stop.

**Commit note.** `.claude/skills/plan-executor/` is tracked as of `77f014c`. Commit the new script
and test with it; do not commit `.claude/workflows/` or `.claude/worktrees/`.
