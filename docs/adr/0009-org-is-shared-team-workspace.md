# ADR-0009 — Org is a shared team workspace (relax bijective 1:1 to one-org-per-user)

**Status:** Accepted

## Context
Spec 46 (WS4) enforced a bijective 1:1 org model in `connect_user_to_org`: a user has exactly one org, **and** an org has exactly one user (reverse-uniqueness). The post-merge prod reconciliation (spec 46 WS3) revealed that the internal Brewra team legitimately shares a single org, and their scattered data was consolidated back onto it. This is not a data defect: the leads read path (`app/services/leads/persistence.py` `get_leads_for_org`) filters by `org_id` only — no `user_id` — so an org is already a shared workspace by design. The "an org has one user" half therefore contradicts real usage, and, now that WS4 is live, would `409`-reject connecting any additional team member to a shared org.

## Decision
Relax `connect_user_to_org` to a **one-org-per-user** model, dropping reverse-uniqueness. Retained guards: `org_id` must be a UUID present in `orgs.org_list`; no silent re-key of a user already mapped to a different org (behind the service-only `migrate=True`, not exposed on `POST /connect_org`). Multiple users may now map to the same org — a shared team workspace. This supersedes the bijective-1:1 framing in spec 46 WS4 (the spec stays a frozen record of its original intent).

## Consequences
Team members can share an org and its org-scoped lead pool with no per-user partition — the intended workspace behaviour. There is no per-user data isolation *within* a shared org; if private per-user workspaces are later required, assign a distinct org UUID per user and repoint their `user_id`-tagged data (the WS3 reconciliation machinery already does per-user repoints). `POST /connect_org` no longer returns `409` for a shared org; it still returns `400` for a non-UUID / unregistered org. Adding a future member to a shared org is now a supported admin action.
