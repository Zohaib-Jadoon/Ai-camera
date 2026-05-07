from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    assert "message" in response.json()

def test_status():
    response = client.get("/status")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
