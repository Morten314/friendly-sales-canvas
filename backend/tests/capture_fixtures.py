"""Capture deterministic LLM fixtures for backend tests.

Invokes service helpers in-process with real API keys, captures their
outputs, and writes them to tests/fixtures/captured/*.json. The captured
JSONs become the deterministic mock return values for unit + integration
tests.

Usage (run from backend/):
    python tests/capture_fixtures.py
    python tests/capture_fixtures.py --llm-backend claude
    python tests/capture_fixtures.py --components market_size,icp_summary
    python tests/capture_fixtures.py --components signals_scout --llm-backend qwen

Required env vars (script aborts if missing):
    ANTHROPIC_API_KEY  — Claude path
    TOGETHER_API_KEY   — Qwen path (Together.ai-hosted Qwen via agent_chain)
    TAVILY_API_KEY     — Claude path web context

Re-run intentionally when:
    - A `_SCOUT_PROMPT_TEMPLATE` / `_PROFILER_PROMPT_TEMPLATE` / `Research_Market_N`
      template is edited
    - `claude_sonnet_model` or `together_model` in `app/core/config.py` is bumped
    - `app/models/<domain>.py` shape changes break the captured response
    - A "fixtures lied" incident — production diverged from what tests asserted
"""
import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List

# ---------------------------------------------------------------------------
# sys.path bootstrap so we can run `python tests/capture_fixtures.py` from backend/
# ---------------------------------------------------------------------------
_BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND_DIR))
sys.path.insert(0, str(_BACKEND_DIR.parent))

REQUIRED_KEYS = ("ANTHROPIC_API_KEY", "TOGETHER_API_KEY", "TAVILY_API_KEY")

FIXTURES_DIR = _BACKEND_DIR / "tests" / "fixtures"
SEED_DIR = FIXTURES_DIR / "seed"
CAPTURED_DIR = FIXTURES_DIR / "captured"

# component-name → service-call slug used in output filename
MARKET_COMPONENTS = {
    "market_size": "market size & opportunity",
    "industry_trends": "industry trends report",
    "competitor_landscape": "competitor landscape",
    "regulatory_compliance": "regulatory & compliance highlights",
    "market_entry": "market entry & growth strategy",
}
ICP_COMPONENTS = {
    "icp_summary": "icp summary & market opportunity",
    "icp_buyer_map": "buyer map & roles, pain points, triggers",
    "icp_competitive": "competitive overlap & buying signals",
    "icp_regulatory": "regulatory, compliance & recommended icp",
}
SIGNAL_COMPONENTS = ("signals_scout", "signals_profiler")
SIGNAL_ASK_COMPONENTS = ("signal_ask",)

ALL_COMPONENT_SLUGS = (
    set(MARKET_COMPONENTS) | set(ICP_COMPONENTS)
    | set(SIGNAL_COMPONENTS) | set(SIGNAL_ASK_COMPONENTS)
)


def _check_env() -> None:
    missing = [k for k in REQUIRED_KEYS if not os.environ.get(k)]
    if missing:
        sys.exit(f"ERROR: missing required env vars: {', '.join(missing)}")


def _load_seed(name: str) -> Dict[str, Any]:
    return json.loads((SEED_DIR / f"{name}.json").read_text(encoding="utf-8"))


def _write_capture(stem: str, payload: Any) -> None:
    out = CAPTURED_DIR / f"{stem}.json"
    out.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
    print(f"  wrote {out.relative_to(_BACKEND_DIR)}")


def capture_market_research(components: List[str], backends: List[str]) -> None:
    from app.services.market_research import _run_research_component
    slug_to_n = {
        "market_size": 1,
        "industry_trends": 2,
        "competitor_landscape": 3,
        "regulatory_compliance": 4,
        "market_entry": 5,
    }
    company = _load_seed("company_profile")
    pre_data = json.dumps(company)
    for slug in components:
        component_n = slug_to_n[slug]
        for backend in backends:
            print(f"Capturing market_research/{slug} ({backend})...")
            if backend == "qwen":
                result = _run_research_component(component_n, pre_data)
            else:
                result = _run_research_component(component_n, pre_data, "claude")
            _write_capture(f"market_research_{slug}_{backend}", result)


def capture_icp_research(components: List[str], backends: List[str]) -> None:
    from app.services.icp import (
        icp_research_1, icp_research_2, icp_research_3, icp_research_4,
    )
    fn_map = {
        "icp_summary": icp_research_1,
        "icp_buyer_map": icp_research_2,
        "icp_competitive": icp_research_3,
        "icp_regulatory": icp_research_4,
    }
    company = _load_seed("company_profile")
    icp_card = _load_seed("icp_card")
    pre_data = json.dumps({"company_profile": company, "icp_card": icp_card})
    for slug in components:
        fn = fn_map[slug]
        for backend in backends:
            print(f"Capturing icp_research/{slug} ({backend})...")
            llm_backend = "claude" if backend == "claude" else "qwen"
            result = fn(pre_data, llm_backend)
            _write_capture(f"icp_research_{slug}_{backend}", result)


def capture_search_signals(components: List[str], backends: List[str]) -> None:
    from app.services.signals import search_signals
    company = _load_seed("company_profile")
    leads = _load_seed("leads_sample")
    pre_data = json.dumps({"company_profile": company, "leads": leads["leads"]})
    for slug in components:
        persona = "scout" if slug == "signals_scout" else "profiler"
        for backend in backends:
            print(f"Capturing search_signals/{persona} ({backend})...")
            llm_backend = "claude" if backend == "claude" else "qwen"
            result = search_signals(pre_data, persona=persona, llm_backend=llm_backend)
            _write_capture(f"search_signals_{persona}_{backend}", result)


def capture_signal_ask(backends: List[str]) -> None:
    from app.core import llm_config
    from app.services._llm_helpers import _claude_messages_text

    prompt = (
        "Summarize the following signal in 2 sentences: "
        "Spedition Müller GmbH announced a €12M Series A to expand fleet electrification. "
        "Mention the buying trigger and the most likely decision maker."
    )
    for backend in backends:
        print(f"Capturing signal_ask ({backend})...")
        if backend == "qwen":
            result = llm_config.agent_chain.invoke({"input": prompt})
        else:
            result = {"output": _claude_messages_text(prompt)}
        _write_capture(f"signal_ask_{backend}", result)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--llm-backend", choices=("qwen", "claude", "both"), default="both"
    )
    parser.add_argument(
        "--components",
        default="all",
        help="Comma-separated list. Default 'all'. "
             f"Valid: {sorted(ALL_COMPONENT_SLUGS) + ['all']}",
    )
    parser.add_argument(
        "--output-dir", default=str(CAPTURED_DIR),
        help="Directory to write JSON captures into",
    )
    parser.add_argument(
        "--seed-dir", default=str(SEED_DIR),
        help="Directory to read seed payloads from",
    )
    args = parser.parse_args()

    _check_env()

    backends = (
        ["qwen", "claude"] if args.llm_backend == "both" else [args.llm_backend]
    )

    if args.components == "all":
        requested = ALL_COMPONENT_SLUGS
    else:
        requested = {c.strip() for c in args.components.split(",")}
        unknown = requested - ALL_COMPONENT_SLUGS
        if unknown:
            sys.exit(f"ERROR: unknown components: {sorted(unknown)}")

    Path(args.output_dir).mkdir(parents=True, exist_ok=True)

    market = sorted(requested & set(MARKET_COMPONENTS))
    icp = sorted(requested & set(ICP_COMPONENTS))
    sig = sorted(requested & set(SIGNAL_COMPONENTS))
    ask = sorted(requested & set(SIGNAL_ASK_COMPONENTS))

    if market:
        capture_market_research(market, backends)
    if icp:
        capture_icp_research(icp, backends)
    if sig:
        capture_search_signals(sig, backends)
    if ask:
        capture_signal_ask(backends)

    total = (
        len(market) * len(backends) + len(icp) * len(backends)
        + len(sig) * len(backends) + len(ask) * len(backends)
    )
    print(f"\nDone. {total} captures written to {args.output_dir}.")


if __name__ == "__main__":
    main()
