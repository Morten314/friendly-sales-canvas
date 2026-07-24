"""CORS allow-list is env-driven (spec 42): only configured origins are echoed.

conftest sets CORS_ALLOWED_ORIGINS="http://localhost:3000,https://test.example".
Starlette's CORSMiddleware echoes the request Origin in
access-control-allow-origin only when it is in the allow-list; an unlisted
origin gets no such header.
"""


def test_cors_allows_configured_origin(client):
    resp = client.get("/openapi.json", headers={"Origin": "http://localhost:3000"})
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_cors_rejects_unlisted_origin(client):
    resp = client.get("/openapi.json", headers={"Origin": "https://evil.example"})
    assert resp.headers.get("access-control-allow-origin") is None
