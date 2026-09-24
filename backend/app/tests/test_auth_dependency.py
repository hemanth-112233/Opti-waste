from types import SimpleNamespace
from uuid import UUID

import pytest
from fastapi import HTTPException

from app.api.dependencies import auth


class MockUser:
    def __init__(self, id, name, email, password_hash, role, is_active):
        self.id = id
        self.name = name
        self.email = email
        self.password_hash = password_hash
        self.role = role
        self.is_active = is_active


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("token", "expected_role"),
    [
        ("admin", "Administrator"),
        ("engineer", "Cloud Engineer"),
        ("analyst", "FinOps Analyst"),
        ("unknown", "Viewer"),
    ],
)
async def test_get_current_user_role_mapping(token, expected_role, monkeypatch):
    monkeypatch.setattr(auth, "User", MockUser)

    user = await auth.get_current_user(f"Bearer {token}")

    assert isinstance(user, auth.User)
    assert user.id == UUID("00000000-0000-0000-0000-000000000000")
    assert getattr(user, "role_name_mock") == expected_role


@pytest.mark.asyncio
async def test_get_current_user_missing_authorization_header_raises_401():
    with pytest.raises(HTTPException) as exc_info:
        await auth.get_current_user(None)

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Could not validate credentials"


@pytest.mark.asyncio
@pytest.mark.parametrize("header_value", ["Basic abc123", "Token xyz", "Invalid "])
async def test_get_current_user_malformed_authorization_header_raises_401(header_value):
    with pytest.raises(HTTPException) as exc_info:
        await auth.get_current_user(header_value)

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Could not validate credentials"


@pytest.mark.asyncio
async def test_get_current_admin_allows_administrator():
    current_user = SimpleNamespace(role_name_mock="Administrator")

    result = await auth.get_current_admin(current_user)

    assert result is current_user


@pytest.mark.asyncio
@pytest.mark.parametrize("role_name", ["Cloud Engineer", "Viewer"])
async def test_get_current_admin_rejects_non_admin_roles(role_name):
    current_user = SimpleNamespace(role_name_mock=role_name)

    with pytest.raises(HTTPException) as exc_info:
        await auth.get_current_admin(current_user)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "The user doesn't have enough privileges"


@pytest.mark.asyncio
@pytest.mark.parametrize("role_name", ["Administrator", "Cloud Engineer"])
async def test_get_current_engineer_allows_authorized_roles(role_name):
    current_user = SimpleNamespace(role_name_mock=role_name)

    result = await auth.get_current_engineer(current_user)

    assert result is current_user


@pytest.mark.asyncio
@pytest.mark.parametrize("role_name", ["FinOps Analyst", "Viewer"])
async def test_get_current_engineer_rejects_unauthorized_roles(role_name):
    current_user = SimpleNamespace(role_name_mock=role_name)

    with pytest.raises(HTTPException) as exc_info:
        await auth.get_current_engineer(current_user)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "The user doesn't have enough privileges"


@pytest.mark.asyncio
@pytest.mark.parametrize("role_name", ["Administrator", "Cloud Engineer", "FinOps Analyst"])
async def test_get_current_analyst_allows_authorized_roles(role_name):
    current_user = SimpleNamespace(role_name_mock=role_name)

    result = await auth.get_current_analyst(current_user)

    assert result is current_user


@pytest.mark.asyncio
async def test_get_current_analyst_rejects_viewer():
    current_user = SimpleNamespace(role_name_mock="Viewer")

    with pytest.raises(HTTPException) as exc_info:
        await auth.get_current_analyst(current_user)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "The user doesn't have enough privileges"
