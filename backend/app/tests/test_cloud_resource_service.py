from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import UUID

import pytest

from app.models.cloud_resource import CloudResource
from app.services.cloud_resource_service import CloudResourceService
from app.schemas.cloud_resource import CloudResourceCreate, CloudResourceUpdate


@pytest.fixture
def provider_id():
    return UUID("11111111-1111-4111-8111-111111111111")


@pytest.fixture
def resource_id():
    return UUID("22222222-2222-4222-8222-222222222222")


@pytest.fixture
def mock_provider(provider_id):
    return SimpleNamespace(id=provider_id, provider_name="AWS Core")


@pytest.fixture
def mock_query_chain():
    class QueryChain:
        def __init__(self):
            self.calls = []

        def find_many(self, *args, **kwargs):
            self.calls.append(("find_many", args, kwargs))
            return self

        def find(self, *args, **kwargs):
            self.calls.append(("find", args, kwargs))
            return self

        def sort(self, *args, **kwargs):
            self.calls.append(("sort", args, kwargs))
            return self

        def skip(self, *args, **kwargs):
            self.calls.append(("skip", args, kwargs))
            return self

        def limit(self, *args, **kwargs):
            self.calls.append(("limit", args, kwargs))
            return self

        async def to_list(self, *args, **kwargs):
            self.calls.append(("to_list", args, kwargs))
            return []

        async def count(self):
            self.calls.append(("count", (), {}))
            return 0

    return QueryChain()


@pytest.mark.asyncio
async def test_create_resource_success(monkeypatch, provider_id, mock_provider):
    provider_stub = SimpleNamespace(id=provider_id, provider_name="AWS Core")

    original_init = CloudResource.__init__

    def patched_init(self, *args, **kwargs):
        if "provider" in kwargs and kwargs["provider"] is provider_stub:
            kwargs["provider"] = provider_id
            for key, value in kwargs.items():
                object.__setattr__(self, key, value)
            return
        return original_init(self, *args, **kwargs)

    monkeypatch.setattr("app.services.cloud_resource_service.CloudProvider.get", AsyncMock(return_value=provider_stub))
    monkeypatch.setattr(
        "app.services.cloud_resource_service.CloudResource.find_one",
        AsyncMock(return_value=None),
    )
    monkeypatch.setattr(
        "app.services.cloud_resource_service.CloudResource.provider",
        SimpleNamespace(id=provider_id),
        raising=False,
    )
    monkeypatch.setattr(
        "app.services.cloud_resource_service.CloudResource.resource_name",
        "web-01",
        raising=False,
    )
    monkeypatch.setattr(CloudResource, "__init__", patched_init)
    monkeypatch.setattr("app.services.cloud_resource_service.CloudResource.insert", AsyncMock())

    class FakeAuditLog:
        def __init__(self, **kwargs):
            self.__dict__.update(kwargs)

        async def insert(self):
            return None

    audit_insert = AsyncMock()
    monkeypatch.setattr("app.services.cloud_resource_service.AuditLog", FakeAuditLog)
    FakeAuditLog.insert = audit_insert

    resource_in = CloudResourceCreate(
        resource_name="web-01",
        resource_type="EC2",
        service_name="EC2",
        region="us-east-1",
        status="running",
        provider_id=provider_id,
    )

    result = await CloudResourceService.create_resource(resource_in, current_user_id=UUID("33333333-3333-4333-8333-333333333333"))

    assert result.resource_name == "web-01"
    assert result.provider == provider_id
    assert audit_insert.await_count == 1


@pytest.mark.asyncio
async def test_create_resource_missing_provider(monkeypatch, provider_id):
    monkeypatch.setattr("app.services.cloud_resource_service.CloudProvider.get", AsyncMock(return_value=None))

    resource_in = CloudResourceCreate(
        resource_name="web-01",
        resource_type="EC2",
        service_name="EC2",
        region="us-east-1",
        status="running",
        provider_id=provider_id,
    )

    with pytest.raises(ValueError, match=f"Provider with ID {provider_id} not found."):
        await CloudResourceService.create_resource(resource_in)


@pytest.mark.asyncio
async def test_create_resource_duplicate_name(monkeypatch, provider_id, mock_provider):
    monkeypatch.setattr("app.services.cloud_resource_service.CloudProvider.get", AsyncMock(return_value=mock_provider))
    monkeypatch.setattr(
        "app.services.cloud_resource_service.CloudResource.provider",
        SimpleNamespace(id=provider_id),
        raising=False,
    )
    monkeypatch.setattr(
        "app.services.cloud_resource_service.CloudResource.resource_name",
        "web-01",
        raising=False,
    )
    monkeypatch.setattr(
        "app.services.cloud_resource_service.CloudResource.find_one",
        AsyncMock(return_value=SimpleNamespace(resource_name="web-01", provider=mock_provider)),
    )

    assert mock_provider.id == provider_id

    resource_in = CloudResourceCreate(
        resource_name="web-01",
        resource_type="EC2",
        service_name="EC2",
        region="us-east-1",
        status="running",
        provider_id=provider_id,
    )

    with pytest.raises(ValueError, match="already exists in this provider"):
        await CloudResourceService.create_resource(resource_in)


@pytest.mark.asyncio
async def test_get_resources_returns_filtered_sorted_paginated_resources(monkeypatch, mock_query_chain):
    query_chain = mock_query_chain

    class FakeQuery:
        def __init__(self):
            self.calls = []

        def find_many(self, *args, **kwargs):
            self.calls.append(("find_many", args, kwargs))
            return self

        def find(self, *args, **kwargs):
            self.calls.append(("find", args, kwargs))
            return self

        def sort(self, *args, **kwargs):
            self.calls.append(("sort", args, kwargs))
            return self

        def skip(self, *args, **kwargs):
            self.calls.append(("skip", args, kwargs))
            return self

        def limit(self, *args, **kwargs):
            self.calls.append(("limit", args, kwargs))
            return self

        async def to_list(self, *args, **kwargs):
            self.calls.append(("to_list", args, kwargs))
            return [{"resource_name": "web-01"}]

    fake_query = FakeQuery()

    monkeypatch.setattr("app.services.cloud_resource_service.CloudResource.find", lambda *args, **kwargs: fake_query)

    result = await CloudResourceService.get_resources(
        skip=0,
        limit=10,
        search="web",
        provider_id=UUID("44444444-4444-4444-8444-444444444444"),
        region="us-east-1",
        environment="Production",
        status="running",
        sort_by="created_at",
        descending=True,
    )

    assert result == [{"resource_name": "web-01"}]


@pytest.mark.asyncio
async def test_get_resources_no_matches_returns_empty_list(monkeypatch):
    class EmptyQuery:
        def find_many(self, *args, **kwargs):
            return self

        def find(self, *args, **kwargs):
            return self

        def sort(self, *args, **kwargs):
            return self

        def skip(self, *args, **kwargs):
            return self

        def limit(self, *args, **kwargs):
            return self

        async def to_list(self, *args, **kwargs):
            return []

    monkeypatch.setattr("app.services.cloud_resource_service.CloudResource.find", lambda *args, **kwargs: EmptyQuery())

    result = await CloudResourceService.get_resources(search="missing")

    assert result == []


@pytest.mark.asyncio
async def test_get_resource_valid_id_returns_resource(monkeypatch, resource_id):
    expected = SimpleNamespace(id=resource_id, resource_name="web-01")
    monkeypatch.setattr("app.services.cloud_resource_service.CloudResource.get", AsyncMock(return_value=expected))

    result = await CloudResourceService.get_resource(resource_id)

    assert result is expected


@pytest.mark.asyncio
async def test_get_resource_missing_id_returns_none(monkeypatch, resource_id):
    monkeypatch.setattr("app.services.cloud_resource_service.CloudResource.get", AsyncMock(return_value=None))

    result = await CloudResourceService.get_resource(resource_id)

    assert result is None


@pytest.mark.asyncio
async def test_update_resource_existing_resource_updates_fields_and_logs(monkeypatch, resource_id):
    original = SimpleNamespace(
        id=resource_id,
        resource_name="old-name",
        status="stopped",
        region="us-east-1",
    )
    original.save = AsyncMock()

    class FakeAuditLog:
        def __init__(self, **kwargs):
            self.__dict__.update(kwargs)

        async def insert(self):
            return None

    monkeypatch.setattr("app.services.cloud_resource_service.CloudResource.get", AsyncMock(return_value=original))
    monkeypatch.setattr("app.services.cloud_resource_service.AuditLog", FakeAuditLog)
    FakeAuditLog.insert = AsyncMock()

    update_in = CloudResourceUpdate(resource_name="new-name", status="running")

    result = await CloudResourceService.update_resource(resource_id, update_in, current_user_id=UUID("44444444-4444-4444-8444-444444444444"))

    assert result is original
    assert result.resource_name == "new-name"
    assert result.status == "running"
    assert result.updated_at.tzinfo == timezone.utc
    assert original.save.await_count == 1


@pytest.mark.asyncio
async def test_update_resource_missing_resource_returns_none(monkeypatch, resource_id):
    monkeypatch.setattr("app.services.cloud_resource_service.CloudResource.get", AsyncMock(return_value=None))

    result = await CloudResourceService.update_resource(resource_id, CloudResourceUpdate(resource_name="new-name"))

    assert result is None


@pytest.mark.asyncio
async def test_delete_resource_existing_resource_deletes_and_logs(monkeypatch, resource_id):
    resource = SimpleNamespace(id=resource_id, resource_name="web-01")
    resource.delete = AsyncMock()

    class FakeAuditLog:
        def __init__(self, **kwargs):
            self.__dict__.update(kwargs)

        async def insert(self):
            return None

    monkeypatch.setattr("app.services.cloud_resource_service.CloudResource.get", AsyncMock(return_value=resource))
    monkeypatch.setattr("app.services.cloud_resource_service.AuditLog", FakeAuditLog)
    FakeAuditLog.insert = AsyncMock()

    result = await CloudResourceService.delete_resource(resource_id, current_user_id=UUID("55555555-5555-4555-8555-555555555555"))

    assert result is True
    assert resource.delete.await_count == 1


@pytest.mark.asyncio
async def test_delete_resource_missing_resource_returns_false(monkeypatch, resource_id):
    monkeypatch.setattr("app.services.cloud_resource_service.CloudResource.get", AsyncMock(return_value=None))

    result = await CloudResourceService.delete_resource(resource_id)

    assert result is False


@pytest.mark.asyncio
async def test_get_dashboard_summary_returns_totals_and_aggregates(monkeypatch):
    monkeypatch.setattr("app.services.cloud_resource_service.CloudProvider.count", AsyncMock(return_value=3))
    monkeypatch.setattr("app.services.cloud_resource_service.CloudResource.count", AsyncMock(return_value=10))

    class CountQuery:
        def __init__(self, value):
            self.value = value

        async def count(self):
            return self.value

    def fake_find(query):
        if isinstance(query, dict):
            if "status" in query:
                return CountQuery({"running": 6, "stopped": 2}[query["status"]])
            if "environment" in query:
                return CountQuery({"Production": 7, "Development": 3}[query["environment"]])
        return CountQuery(0)

    monkeypatch.setattr("app.services.cloud_resource_service.CloudResource.find", fake_find)

    class AggResult:
        def __init__(self, data):
            self.data = data

        async def to_list(self):
            return self.data

    def fake_aggregate(pipeline, *args, **kwargs):
        if pipeline == [{"$group": {"_id": "$provider.$id", "count": {"$sum": 1}}}]:
            return AggResult([
                {"_id": "provider-1", "count": 2},
            ])
        if pipeline == [{"$group": {"_id": "$region", "count": {"$sum": 1}}}]:
            return AggResult([
                {"_id": "us-east-1", "count": 4},
            ])
        if pipeline == [{"$group": {"_id": "$service_name", "count": {"$sum": 1}}}]:
            return AggResult([
                {"_id": "EC2", "count": 5},
            ])
        return AggResult([])

    monkeypatch.setattr("app.services.cloud_resource_service.CloudResource.aggregate", fake_aggregate)

    result = await CloudResourceService.get_dashboard_summary()

    assert result["total_providers"] == 3
    assert result["total_resources"] == 10
    assert result["running_resources"] == 6
    assert result["stopped_resources"] == 2
    assert result["production_resources"] == 7
    assert result["development_resources"] == 3
    assert result["resources_by_provider"] == [{"_id": "provider-1", "count": 2}]
    assert result["resources_by_region"] == [{"_id": "us-east-1", "count": 4}]
    assert result["resources_by_service"] == [{"_id": "EC2", "count": 5}]


@pytest.mark.asyncio
async def test_get_dashboard_summary_no_data_returns_zeros_and_empty_lists(monkeypatch):
    monkeypatch.setattr("app.services.cloud_resource_service.CloudProvider.count", AsyncMock(return_value=0))
    monkeypatch.setattr("app.services.cloud_resource_service.CloudResource.count", AsyncMock(return_value=0))

    class CountQuery:
        async def count(self):
            return 0

    monkeypatch.setattr("app.services.cloud_resource_service.CloudResource.find", lambda *args, **kwargs: CountQuery())

    class AggResult:
        async def to_list(self):
            return []

    monkeypatch.setattr("app.services.cloud_resource_service.CloudResource.aggregate", lambda *args, **kwargs: AggResult())

    result = await CloudResourceService.get_dashboard_summary()

    assert result == {
        "total_providers": 0,
        "total_resources": 0,
        "running_resources": 0,
        "stopped_resources": 0,
        "production_resources": 0,
        "development_resources": 0,
        "resources_by_provider": [],
        "resources_by_region": [],
        "resources_by_service": [],
    }
