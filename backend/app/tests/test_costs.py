import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_list_costs():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/api/v1/costs/", headers={"Authorization": "Bearer analyst"})
    assert response.status_code == 200

@pytest.mark.asyncio
async def test_costs_dashboard():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/api/v1/costs/dashboard", headers={"Authorization": "Bearer analyst"})
    assert response.status_code == 200
    assert "total_daily_cost" in response.json()

@pytest.mark.asyncio
async def test_create_costs_unauthorized():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post("/api/v1/costs/", json={"billing_period": "2026-08"}, headers={"Authorization": "Bearer viewer"})
    assert response.status_code in [401, 403]
