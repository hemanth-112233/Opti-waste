import pytest
from httpx import AsyncClient
from app.main import app

# Assuming a fixture setup provides test motor client and beanie init
# For Phase 4 we mock it

@pytest.mark.asyncio
async def test_list_providers_empty():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/api/v1/providers/", headers={"Authorization": "Bearer analyst"})
    assert response.status_code == 200

@pytest.mark.asyncio
async def test_create_provider_auth_failure():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.post("/api/v1/providers/", json={
            "provider_name": "TestAWS",
            "provider_type": "AWS",
            "account_name": "Test",
            "account_id": "123",
            "region": "us-east-1"
        }, headers={"Authorization": "Bearer viewer"})
    # viewer should be rejected since engineer is required
    assert response.status_code in [403, 401]
