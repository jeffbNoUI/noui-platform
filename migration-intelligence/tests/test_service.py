import pytest
from httpx import AsyncClient, ASGITransport
from service import app

@pytest.mark.asyncio
async def test_health():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/healthz")
        assert resp.status_code == 200
        data = resp.json()
        assert data["service"] == "migration-intelligence"
        assert data["version"] == "0.1.0"
        assert data["status"] == "ok"

@pytest.mark.asyncio
async def test_score_columns_stub():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/intelligence/score-columns", json={
            "columns": [{"column_name": "test_col", "data_type": "VARCHAR", "null_rate": 0.0, "cardinality": 100}],
            "concept_tag": "employee-master",
            "canonical_table": "member",
            "tenant_id": "test-tenant",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "mappings" in data

@pytest.mark.asyncio
async def test_corpus_stats_stub():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/intelligence/corpus-stats")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_entries"] == 0
