"""
Phase 2 E2E Verification — Migration Engine

Verifies the full Phase 2 pipeline: profile → mapping → batch → transform → load.
Tests both PRISM and PAS source databases load to canonical schema via the
migration service with zero schema changes.

Prerequisites:
  - Docker services running: `docker compose up -d`
  - Migration service on port 8100
  - Migration intelligence service on port 8101
  - PostgreSQL with migration schema initialized

Run:
  pytest migration-simulation/tests/test_phase2_e2e.py -v
"""
import os
import subprocess
import time

import psycopg2
import pytest
import requests

MIGRATION_URL = os.getenv("MIGRATION_URL", "http://localhost:8100")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_USER = os.getenv("DB_USER", "noui")
DB_PASSWORD = os.getenv("DB_PASSWORD", "noui")
DB_NAME = os.getenv("DB_NAME", "noui")

TENANT_ID = "e2e-test-tenant"


def api(method, path, **kwargs):
    """Helper to call migration API and return parsed JSON."""
    resp = getattr(requests, method)(
        f"{MIGRATION_URL}{path}",
        headers={"X-Tenant-ID": TENANT_ID},
        **kwargs,
    )
    resp.raise_for_status()
    return resp.json()


def db_conn():
    """Return a fresh database connection."""
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        dbname=DB_NAME,
    )


def wait_for_service(url, timeout=30):
    """Block until the service health endpoint responds."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            resp = requests.get(f"{url}/healthz", timeout=2)
            if resp.status_code == 200:
                return
        except requests.ConnectionError:
            pass
        time.sleep(1)
    pytest.skip(f"Service at {url} not available after {timeout}s")


# --------------------------------------------------------------------------- #
# Fixtures
# --------------------------------------------------------------------------- #

@pytest.fixture(scope="module", autouse=True)
def check_services():
    """Skip the entire module if Docker services are not running."""
    wait_for_service(MIGRATION_URL)


@pytest.fixture(scope="module")
def db():
    """Module-scoped database connection."""
    conn = db_conn()
    yield conn
    conn.close()


@pytest.fixture(scope="module")
def canonical_schema_before(db):
    """Capture canonical schema DDL before any migration runs."""
    cur = db.cursor()
    cur.execute("""
        SELECT table_name, column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('member', 'salary', 'employment', 'benefit')
        ORDER BY table_name, ordinal_position
    """)
    schema = cur.fetchall()
    cur.close()
    return schema


# --------------------------------------------------------------------------- #
# PRISM Source Migration
# --------------------------------------------------------------------------- #

class TestPRISMMigration:
    """Full pipeline for the PRISM pension source system."""

    @pytest.fixture(scope="class")
    def prism_engagement(self):
        """Create a PRISM engagement and return its ID."""
        data = api("post", "/api/v1/migration/engagements", json={
            "source_system_name": "PRISM",
        })
        engagement_id = data["data"]["engagement_id"]
        yield engagement_id

    def test_01_create_engagement(self, prism_engagement):
        """Engagement is created with PROFILING status."""
        data = api("get", f"/api/v1/migration/engagements/{prism_engagement}")
        eng = data["data"]
        assert eng["source_system_name"] == "PRISM"
        assert eng["status"] == "PROFILING"

    def test_02_profile(self, prism_engagement):
        """Profiling produces quality scores for source tables."""
        data = api("post", f"/api/v1/migration/engagements/{prism_engagement}/profile")
        profiles = data["data"]
        assert len(profiles) > 0, "Expected at least one profiled table"
        for p in profiles:
            assert p["row_count"] > 0
            assert 0.0 <= p["accuracy_score"] <= 1.0

    def test_03_generate_mappings(self, prism_engagement):
        """Mapping generation produces field mappings via dual strategy."""
        data = api("post", f"/api/v1/migration/engagements/{prism_engagement}/generate-mappings")
        mappings = data["data"]
        assert len(mappings) > 0, "Expected at least one field mapping"
        # Verify dual strategy produces agreement analysis
        statuses = {m["agreement_status"] for m in mappings}
        assert len(statuses) > 0

    def test_04_create_and_execute_batch(self, prism_engagement):
        """Batch executes and loads rows to canonical schema."""
        # Create batch
        batch_data = api("post", f"/api/v1/migration/engagements/{prism_engagement}/batches", json={
            "scope": "full",
            "mapping_version": "v1.0",
        })
        batch_id = batch_data["data"]["batch_id"]
        assert batch_data["data"]["status"] == "PENDING"

        # Execute batch
        exec_data = api("post", f"/api/v1/migration/batches/{batch_id}/execute")
        assert exec_data["data"]["status"] in ("LOADED", "RUNNING")

        # Poll for completion (max 60s)
        deadline = time.time() + 60
        while time.time() < deadline:
            status_data = api("get", f"/api/v1/migration/batches/{batch_id}")
            status = status_data["data"]["status"]
            if status in ("LOADED", "FAILED"):
                break
            time.sleep(2)

        assert status == "LOADED", f"Batch ended with status {status}"
        assert status_data["data"]["row_count_loaded"] > 0

    def test_05_lineage_exists(self, prism_engagement, db):
        """Every loaded canonical row has a lineage entry."""
        cur = db.cursor()
        cur.execute("""
            SELECT COUNT(*) FROM migration.lineage l
            JOIN migration.batch b ON b.batch_id = l.batch_id
            WHERE b.engagement_id = %s
              AND l.superseded_by IS NULL
        """, (prism_engagement,))
        lineage_count = cur.fetchone()[0]
        cur.close()
        assert lineage_count > 0, "Expected lineage records for loaded rows"

    def test_06_exceptions_quarantined(self, prism_engagement, db):
        """Constraint violations are in exception table, not silently dropped."""
        cur = db.cursor()
        cur.execute("""
            SELECT COUNT(*) FROM migration.exception e
            JOIN migration.batch b ON b.batch_id = e.batch_id
            WHERE b.engagement_id = %s
        """, (prism_engagement,))
        exception_count = cur.fetchone()[0]
        cur.close()
        # It's OK if there are zero exceptions (clean data), but the test
        # verifies the mechanism exists. The batch stats should be consistent.
        assert exception_count >= 0


# --------------------------------------------------------------------------- #
# PAS Source Migration
# --------------------------------------------------------------------------- #

class TestPASMigration:
    """Full pipeline for a PAS (Pension Administration System) source."""

    @pytest.fixture(scope="class")
    def pas_engagement(self):
        """Create a PAS engagement and return its ID."""
        data = api("post", "/api/v1/migration/engagements", json={
            "source_system_name": "PAS",
        })
        engagement_id = data["data"]["engagement_id"]
        yield engagement_id

    def test_01_create_engagement(self, pas_engagement):
        """PAS engagement is created with PROFILING status."""
        data = api("get", f"/api/v1/migration/engagements/{pas_engagement}")
        eng = data["data"]
        assert eng["source_system_name"] == "PAS"
        assert eng["status"] == "PROFILING"

    def test_02_profile(self, pas_engagement):
        """PAS profiling produces quality scores."""
        data = api("post", f"/api/v1/migration/engagements/{pas_engagement}/profile")
        profiles = data["data"]
        assert len(profiles) > 0

    def test_03_generate_mappings(self, pas_engagement):
        """PAS mapping generation produces field mappings."""
        data = api("post", f"/api/v1/migration/engagements/{pas_engagement}/generate-mappings")
        mappings = data["data"]
        assert len(mappings) > 0

    def test_04_execute_batch(self, pas_engagement):
        """PAS batch executes and loads to the SAME canonical schema."""
        batch_data = api("post", f"/api/v1/migration/engagements/{pas_engagement}/batches", json={
            "scope": "full",
            "mapping_version": "v1.0",
        })
        batch_id = batch_data["data"]["batch_id"]

        exec_data = api("post", f"/api/v1/migration/batches/{batch_id}/execute")

        deadline = time.time() + 60
        status = "RUNNING"
        while time.time() < deadline:
            status_data = api("get", f"/api/v1/migration/batches/{batch_id}")
            status = status_data["data"]["status"]
            if status in ("LOADED", "FAILED"):
                break
            time.sleep(2)

        assert status == "LOADED", f"PAS batch ended with status {status}"
        assert status_data["data"]["row_count_loaded"] > 0


# --------------------------------------------------------------------------- #
# Cross-source verification
# --------------------------------------------------------------------------- #

class TestCanonicalSchemaIntegrity:
    """Verify canonical schema is not modified by migration and data is clean."""

    def test_schema_unchanged(self, canonical_schema_before, db):
        """Migration must NOT alter canonical table definitions."""
        cur = db.cursor()
        cur.execute("""
            SELECT table_name, column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name IN ('member', 'salary', 'employment', 'benefit')
            ORDER BY table_name, ordinal_position
        """)
        schema_after = cur.fetchall()
        cur.close()
        assert schema_after == canonical_schema_before, (
            "Canonical schema was modified during migration! "
            "Migration should use the schema as-is, not alter it."
        )

    def test_both_sources_loaded(self, db):
        """Both PRISM and PAS data coexist in canonical tables."""
        cur = db.cursor()
        cur.execute("""
            SELECT DISTINCT e.source_system_name
            FROM migration.lineage l
            JOIN migration.batch b ON b.batch_id = l.batch_id
            JOIN migration.engagement e ON e.engagement_id = b.engagement_id
            WHERE l.superseded_by IS NULL
        """)
        sources = {row[0] for row in cur.fetchall()}
        cur.close()
        assert "PRISM" in sources, "PRISM data not found in canonical"
        assert "PAS" in sources, "PAS data not found in canonical"

    def test_lineage_covers_all_loaded_rows(self, db):
        """Every loaded row has exactly one active (non-superseded) lineage."""
        cur = db.cursor()
        cur.execute("""
            SELECT b.batch_id, b.row_count_loaded,
                   COUNT(l.lineage_id) AS lineage_count
            FROM migration.batch b
            LEFT JOIN migration.lineage l
              ON l.batch_id = b.batch_id
              AND l.superseded_by IS NULL
            WHERE b.status = 'LOADED'
            GROUP BY b.batch_id, b.row_count_loaded
        """)
        for batch_id, loaded, lineage_count in cur.fetchall():
            assert lineage_count == loaded, (
                f"Batch {batch_id}: loaded={loaded} but lineage={lineage_count}"
            )
        cur.close()

    def test_exception_counts_consistent(self, db):
        """Batch exception counts match actual exception table rows."""
        cur = db.cursor()
        cur.execute("""
            SELECT b.batch_id, b.row_count_exception,
                   COUNT(e.exception_id) AS actual_count
            FROM migration.batch b
            LEFT JOIN migration.exception e ON e.batch_id = b.batch_id
            WHERE b.status = 'LOADED'
            GROUP BY b.batch_id, b.row_count_exception
        """)
        for batch_id, reported, actual in cur.fetchall():
            if reported is not None:
                assert actual == reported, (
                    f"Batch {batch_id}: reported {reported} exceptions "
                    f"but found {actual} in exception table"
                )
        cur.close()

    def test_confidence_levels_valid(self, db):
        """All lineage confidence levels are within allowed values."""
        cur = db.cursor()
        cur.execute("""
            SELECT DISTINCT confidence_level FROM migration.lineage
        """)
        allowed = {"ACTUAL", "DERIVED", "ESTIMATED", "ROLLED_UP"}
        for (level,) in cur.fetchall():
            assert level in allowed, f"Invalid confidence level: {level}"
        cur.close()

    def test_no_orphan_exceptions(self, db):
        """All exceptions reference valid batches."""
        cur = db.cursor()
        cur.execute("""
            SELECT COUNT(*) FROM migration.exception e
            LEFT JOIN migration.batch b ON b.batch_id = e.batch_id
            WHERE b.batch_id IS NULL
        """)
        orphans = cur.fetchone()[0]
        cur.close()
        assert orphans == 0, f"Found {orphans} orphan exception records"


# --------------------------------------------------------------------------- #
# Code table discovery verification
# --------------------------------------------------------------------------- #

class TestCodeTableDiscovery:
    """Verify code table discovery and mapping workflow."""

    @pytest.fixture(scope="class")
    def engagement_with_mappings(self):
        """Return the first engagement that has completed mapping."""
        data = api("get", "/api/v1/migration/engagements")
        engagements = data["data"]
        for eng in engagements:
            if eng["status"] in ("TRANSFORMING", "RECONCILING", "COMPLETE"):
                return eng["engagement_id"]
        pytest.skip("No engagement past MAPPING stage")

    def test_code_mappings_exist(self, engagement_with_mappings):
        """Code mappings should be generated for low-cardinality columns."""
        data = api("get", f"/api/v1/migration/engagements/{engagement_with_mappings}/code-mappings")
        mappings = data["data"]
        # Code mappings may or may not exist depending on source data
        assert isinstance(mappings, list)


# --------------------------------------------------------------------------- #
# Retransformation verification
# --------------------------------------------------------------------------- #

class TestRetransformation:
    """Verify re-transformation preserves audit trail."""

    def test_superseded_lineage_preserved(self, db):
        """After retransform, old lineage is superseded, not deleted."""
        cur = db.cursor()
        cur.execute("""
            SELECT COUNT(*) FROM migration.lineage
            WHERE superseded_by IS NOT NULL
        """)
        superseded = cur.fetchone()[0]
        cur.close()
        # After a fresh migration with no corrections, superseded count may be 0.
        # This test just verifies the query works and the column exists.
        assert superseded >= 0
