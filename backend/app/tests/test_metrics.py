import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_list_metrics():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/api/v1/metrics/", headers={"Authorization": "Bearer analyst"})
    assert response.status_code == 200

@pytest.mark.asyncio
async def test_metrics_dashboard():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/api/v1/metrics/dashboard", headers={"Authorization": "Bearer analyst"})
    assert response.status_code == 200
    assert "average_cpu_utilization" in response.json()
