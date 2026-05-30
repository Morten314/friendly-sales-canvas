"""Router wiring for /connectors/apollo/* via TestClient + dependency overrides."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.dependencies import get_mongo, get_neo4j_driver
from app.services import connectors as connectors_service
from tests.identities import TEST_ORG_ID, TEST_USER_ID, TEST_LEAD_ID_1


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def _override_clients():
    app.dependency_overrides[get_neo4j_driver] = lambda: object()
    app.dependency_overrides[get_mongo] = lambda: object()
    yield
    app.dependency_overrides.pop(get_neo4j_driver, None)
    app.dependency_overrides.pop(get_mongo, None)


def test_connect_calls_service(client, monkeypatch):
    monkeypatch.setattr(connectors_service, "connect_apollo",
                        lambda mongo, req: {"connected": True, "status": "connected"})
    r = client.post("/connectors/apollo/connect",
                    json={"org_id": TEST_ORG_ID, "user_id": TEST_USER_ID, "api_key": "k"})
    assert r.status_code == 200
    assert r.json() == {"connected": True, "status": "connected"}


def test_status(client, monkeypatch):
    monkeypatch.setattr(connectors_service, "get_apollo_status",
                        lambda mongo, org_id: {"connected": False, "status": "disconnected", "connected_at": None})
    r = client.get(f"/connectors/apollo/status?org_id={TEST_ORG_ID}")
    assert r.status_code == 200
    assert r.json()["connected"] is False


def test_disconnect(client, monkeypatch):
    monkeypatch.setattr(connectors_service, "disconnect_apollo",
                        lambda mongo, org_id: {"status": "disconnected", "message": "Apollo disconnected."})
    r = client.request("DELETE", f"/connectors/apollo/connect?org_id={TEST_ORG_ID}")
    assert r.status_code == 200
    assert r.json()["status"] == "disconnected"


def test_lists(client, monkeypatch):
    monkeypatch.setattr(connectors_service, "list_apollo_lists",
                        lambda mongo, org_id: {"lists": [{"id": "L1", "name": "One"}]})
    r = client.get(f"/connectors/apollo/lists?org_id={TEST_ORG_ID}")
    assert r.status_code == 200
    assert r.json()["lists"][0]["id"] == "L1"


def test_import_returns_file_id(client, monkeypatch):
    monkeypatch.setattr(connectors_service, "start_apollo_import",
                        lambda driver, mongo, req, bt: {"file_id": "f1", "status": "queued"})
    r = client.post("/connectors/apollo/import",
                    json={"org_id": TEST_ORG_ID, "user_id": TEST_USER_ID, "label": "Batch"})
    assert r.status_code == 200
    assert r.json() == {"file_id": "f1", "status": "queued"}


def test_enrich_returns_run_id(client, monkeypatch):
    monkeypatch.setattr(connectors_service, "start_apollo_enrich",
                        lambda driver, mongo, req, bt: {"run_id": "r1", "status": "queued"})
    r = client.post("/connectors/apollo/enrich",
                    json={"org_id": TEST_ORG_ID, "user_id": TEST_USER_ID, "lead_ids": [TEST_LEAD_ID_1]})
    assert r.status_code == 200
    assert r.json() == {"run_id": "r1", "status": "queued"}


def test_enrich_status(client, monkeypatch):
    monkeypatch.setattr(connectors_service, "get_apollo_enrich_status",
                        lambda mongo, org_id, run_id: {
                            "run_id": "r1", "org_id": TEST_ORG_ID, "status": "completed",
                            "total": 1, "processed": 1, "updated": 1, "unmatched": 0, "failed": 0,
                            "progress_percent": 100.0, "errors": [], "started_at": None, "finished_at": None,
                        })
    r = client.get(f"/connectors/apollo/enrich/status?org_id={TEST_ORG_ID}&run_id=r1")
    assert r.status_code == 200
    assert r.json()["progress_percent"] == 100.0


def test_connect_validation_error_maps_to_400(client, monkeypatch):
    from app.core.exceptions import ConnectorCredentialsInvalidError

    def _raise(mongo, req):
        raise ConnectorCredentialsInvalidError("bad key")

    monkeypatch.setattr(connectors_service, "connect_apollo", _raise)
    r = client.post("/connectors/apollo/connect",
                    json={"org_id": TEST_ORG_ID, "user_id": TEST_USER_ID, "api_key": "bad"})
    assert r.status_code == 400


def test_status_not_connected_maps_to_404(client, monkeypatch):
    from app.core.exceptions import ConnectorNotConnectedError

    def _raise(mongo, org_id):
        raise ConnectorNotConnectedError("no credentials")

    monkeypatch.setattr(connectors_service, "get_apollo_status", _raise)
    r = client.get(f"/connectors/apollo/status?org_id={TEST_ORG_ID}")
    assert r.status_code == 404
