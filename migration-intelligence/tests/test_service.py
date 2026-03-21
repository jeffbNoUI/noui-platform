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
async def test_score_columns_real():
    """Test score-columns with real PRISM-like columns"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/intelligence/score-columns", json={
            "columns": [
                {"column_name": "BIRTH_DT", "data_type": "varchar(10)", "null_rate": 0.0, "cardinality": 450, "row_count": 500},
                {"column_name": "NATL_ID", "data_type": "varchar(11)", "null_rate": 0.02, "cardinality": 498, "row_count": 500},
            ],
            "concept_tag": "employee-master",
            "canonical_table": "member",
            "tenant_id": "test-tenant",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["mappings"]) > 0
        # BIRTH_DT should map to birth_date
        birth_mappings = [m for m in data["mappings"] if m["source_column"] == "BIRTH_DT"]
        assert any(m["canonical_column"] == "birth_date" for m in birth_mappings)
        # NATL_ID should map to national_id
        natl_mappings = [m for m in data["mappings"] if m["source_column"] == "NATL_ID"]
        assert any(m["canonical_column"] == "national_id" for m in natl_mappings)


@pytest.mark.asyncio
async def test_score_columns_unknown_concept():
    """Unknown concept_tag should return empty mappings"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/intelligence/score-columns", json={
            "columns": [
                {"column_name": "test_col", "data_type": "VARCHAR", "null_rate": 0.0, "cardinality": 100, "row_count": 500},
            ],
            "concept_tag": "nonexistent-concept",
            "canonical_table": "member",
            "tenant_id": "test-tenant",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["mappings"] == []


@pytest.mark.asyncio
async def test_score_columns_top3_limit():
    """Each source column should return at most 3 candidates"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/intelligence/score-columns", json={
            "columns": [
                {"column_name": "member_id", "data_type": "integer", "null_rate": 0.0, "cardinality": 500, "row_count": 500},
            ],
            "concept_tag": "employee-master",
            "canonical_table": "member",
            "tenant_id": "test-tenant",
        })
        assert resp.status_code == 200
        data = resp.json()
        member_mappings = [m for m in data["mappings"] if m["source_column"] == "member_id"]
        assert len(member_mappings) <= 3
        # member_id should be the top match
        assert member_mappings[0]["canonical_column"] == "member_id"
        assert member_mappings[0]["confidence"] > 0.8


@pytest.mark.asyncio
async def test_corpus_stats_stub():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/intelligence/corpus-stats")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_entries"] == 0
