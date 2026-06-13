---
artifact: fix+scout-signal-resilience-and-ask-context
artifact_type: impl
verdict: findings
reviewer_model: zai-coding-plan/glm-5.1
date: 2026-06-13
round: 1
base_ref: master
spec_loaded: false
plan_loaded: false
---

## Context

No spec/plan found for branch `fix+scout-signal-resilience-and-ask-context`. The
slug resolves to no matching file in `specs/` or `plans/`, and the
most-recently-modified spec/plan (`35-apollo-discovery-*`) is unrelated to this
branch's topic. Adherence checking skipped. Pass paths explicitly when invoking
to enable it.

The review is based on static analysis. The backend venv's base interpreter is
missing (created in a different environment), so the pytest suite
(`backend/tests/unit/test_signals.py`) could not be executed locally. Findings
about test correctness were validated by manual trace against the source and
fixtures, not by a green run.

Branch resolves to git ref `worktree-fix+scout-signal-resilience-and-ask-context`
(the worktree-prefixed form). 3 commits, 5 files, +382/-63.

## Findings

### [Low] A fully-failed batch returns HTTP 200 "success" with an empty data array, masking the outage

**Location:** `backend/app/services/signals/batch.py:236-240` (`_generate_signals_batch_impl` return)

The new skip-on-failure loop is a good resilience improvement over the old
"first failure → raise → 500" behavior, and it is well-justified in the inline
comments. However, because every signal is now independently skippable,
`_generate_signals_batch_impl` returns `{"status": "success", "message":
"Generated 0 signals", "data": []}` when **all** signals exhaust their retries.
A total LLM/Pinecone outage therefore produces an indistinguishable-from-success
200 with no failure signal for the caller or for logs (failures are only at
`logger.error`, not surfaced in the response body).

This is an acceptable tradeoff for an MVP with 0 users, but two small additions
would close the observability gap without abandoning the skip design:

1. Include a `failed` / `partial` indicator in the response (e.g. a
   `failed_count` or `skipped` field), so the caller can tell "0 generated, 0
   failed" apart from "0 generated, 4 failed".
2. Consider returning a non-`success` status (or at least a distinct message)
   when `generated_signals` is empty due to skips, so a total failure isn't
   swallowed as a normal empty result.

There is also no test for the all-signals-failed path: the two new batch tests
cover (a) one signal fails-all-retries while a sibling succeeds, and (b) a
transient failure recovered by retry. A test asserting the empty-but-success
response shape (or a future `failed_count`) on total failure would pin the
intended contract. Not blocking — the partial-success case is well covered.

### [Nit] `_SIGNAL_BATCH_MAX_RETRIES` is named as a retry count but used as a total-attempt count

**Location:** `backend/app/services/signals/batch.py:29`, used at `:67`

The constant is `_SIGNAL_BATCH_MAX_RETRIES = 2`, but the loop
`for attempt in range(1, _SIGNAL_BATCH_MAX_RETRIES + 1)` yields exactly 2 total
attempts (1 initial try + 1 retry), and the log format `attempt
{attempt}/{_SIGNAL_BATCH_MAX_RETRIES}` reinforces the "total attempts"
reading. A reader expecting "2 retries" would assume 3 total calls. This
matches the pre-existing imprecision in `run_signals_research`
(`backend/app/services/signals/search.py:249-251`, where `max_retries = 2` is
annotated "max 2 attempts"), so it is consistent with the codebase — but a name
like `_SIGNAL_BATCH_MAX_ATTEMPTS` would be unambiguous. No behavior change needed.

### [Nit] `_resolve_customer_profile` can return a stale `{"icps": []}`

**Location:** `backend/app/services/signals/ask.py:48-74`

When the org-scoped `Company_Profile` document exists but carries empty `icps`
**and** the user-scoped `ICP_config` fallback also yields no suggestions, the
function falls through to `return customer_profile`, i.e. `{"icps": []}`. That
truthy-but-empty dict then gets serialized into the prompt as
`CUSTOMER PROFILE (ICPs):\n{\n  "icps": []\n}`. The docstring contracts the
return as "`{"icps": [list]}` or None". It is harmless prompt noise, but
returning `None` in this branch (or guarding the serialization site) would keep
the contract honest and keep empty ICP brackets out of the prompt.

### [Nit] `_fetch_signal_ask_data_sources` wraps a callee that is documented to never raise

**Location:** `backend/app/services/signals/ask.py:82-88`

`_fetch_pinecone_supporting_context` (`backend/app/services/_retrieval.py:58`)
wraps its entire body in `try/except … return []` and is documented "Never
raises; returns [] on any issue." The new `_fetch_signal_ask_data_sources`
wrapper adds a second `try/except … return []` around it. The guard is
defensive and harmless (it also cheaply short-circuits an empty `question`
before spawning a thread, which the callee alone would not — an empty-string
query would otherwise be embedded). Just flagging the redundancy so it isn't
mistaken for a load-bearing catch.

### [Nit] `json.dumps(..., default=str)` is applied inconsistently — `company_profile` omitted

**Location:** `backend/app/services/signals/ask.py:130` and `:219` (no `default=str`), vs `:134`/`:138` and `:223`/`:227` (with `default=str`)

The customer-profile and data-source serializations (Mongo/Pinecone-sourced,
may carry `ObjectId`/`datetime`) correctly added `default=str`. The
company-profile serialization (Neo4j-sourced, typically plain JSON types) was
left without it. The asymmetry is data-source-justified and the company-profile
lines are pre-existing/untouched, so this is not a regression — but if
`fetch_company_profile` ever returns a richer structure, the missing
`default=str` would be the line that throws. Worth aligning for consistency when
convenient.
