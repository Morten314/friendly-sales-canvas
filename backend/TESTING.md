# Backend testing conventions

Conventions and gotchas specific to writing/maintaining Python tests in `/backend/`. Read before adding tests that mock, patch, or stub internal symbols.

## Patch where the symbol is _used_, not where it is _defined_

`from module import symbol` creates a new binding in the importing module. `monkeypatch.setattr("module.symbol", …)` rebinds the name on `module`, but every caller that already did `from module import symbol` still holds the original reference — the patch is silently invisible and the test passes (or fails) for the wrong reason.

**Rule:** patch at the call site, not the definition site. If `app/main.py` has:

```python
from app.services.leads import _ensure_leads_indexes
```

then `monkeypatch.setattr("app.services.leads._ensure_leads_indexes", …)` will do nothing — `app.main` already captured the original. You must patch `app.main._ensure_leads_indexes`.

### Make code patchable from one site

When a symbol is called from many modules and you want a single patch to intercept all callers, import the **module**, not the symbol, and access through the attribute:

```python
# app/main.py
from app.services import leads
...
leads._ensure_leads_indexes()   # one patch on app.services.leads._ensure_leads_indexes
                                # intercepts every caller that uses this pattern
```

This is the preferred pattern for internal seams that tests will need to stub. Reserve `from X import Y` for stable, never-patched utilities.

### Diagnostic checklist

If a `monkeypatch.setattr` appears to have no effect:

1. Grep the call site's module for `from <module> import <symbol>`. If present, patch the importer's namespace instead.
2. Confirm the patch target string resolves: `python -c "import app.main; print(app.main._ensure_leads_indexes)"` should print the function — if it raises `AttributeError`, the path is wrong.
3. Add a `print(id(target))` inside the test and inside the production code path; mismatched ids mean the patch didn't reach the caller.
