import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_dashboard_summary():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/api/v1/resources/dashboard/summary", headers={"Authorization": "Bearer analyst"})
    assert response.status_code == 200

@pytest.mark.asyncio
async def test_list_resources():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/api/v1/resources/", headers={"Authorization": "Bearer analyst"})
    assert response.status_code == 200
