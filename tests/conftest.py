"""Shared pytest fixtures for API integration tests.

Spins up a real, ephemeral Postgres container per test session (via
testcontainers), runs the actual Alembic migrations against it, and exposes
an httpx.AsyncClient wired to the real FastAPI routers - hitting real SQL,
not mocks. This is deliberate: this codebase's worst bugs so far (missing
migrations, schema drift, the case CRUD path) were exactly the kind that
mocked-DB tests would have papered over.

Requires Docker to be running locally / in CI.
"""
import os
import subprocess
import sys
import tempfile
import uuid

import pytest
import pytest_asyncio

# Must be set before api.dependencies / api.services.auth_service are ever
# imported (they read it at module level) - hence set here, at collection
# time, rather than inside a fixture.
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-do-not-use-in-prod")

# api.routers.evidence also reads its storage path at module level. Point it
# at a throwaway temp dir instead of the production default (a docker-volume
# mount point that doesn't exist on a bare CI runner).
os.environ.setdefault("EVIDENCE_VAULT_PATH", tempfile.mkdtemp(prefix="veritas-nexus-test-vault-"))

TEST_PASSWORD = "TestPassword123!"


def _find_alembic_executable() -> str:
    """Locate the alembic console script even when it isn't on PATH
    (pip --user installs on Windows don't add their Scripts dir to PATH)."""
    candidate = os.path.join(os.path.dirname(sys.executable), "Scripts", "alembic.exe")
    if os.path.exists(candidate):
        return candidate
    appdata_candidate = os.path.join(
        os.path.expanduser("~"), "AppData", "Roaming", "Python",
        f"Python{sys.version_info.major}{sys.version_info.minor}", "Scripts", "alembic.exe",
    )
    if os.path.exists(appdata_candidate):
        return appdata_candidate
    return "alembic"  # fall back to PATH lookup (Linux CI runners, venvs, etc.)


@pytest.fixture(scope="session")
def postgres_database_url():
    """Starts one Postgres container for the whole test session and runs
    migrations against it once. Tests are expected to clean up their own
    rows (see the `db_session` fixture's per-test transaction rollback)."""
    from testcontainers.community.postgres import PostgresContainer

    with PostgresContainer("postgres:15-alpine", dbname="veritas_nexus_test") as pg:
        url = pg.get_connection_url(driver="asyncpg")
        repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        result = subprocess.run(
            [_find_alembic_executable(), "upgrade", "head"],
            cwd=repo_root,
            env={**os.environ, "DATABASE_URL": url},
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise RuntimeError(f"alembic upgrade head failed:\n{result.stdout}\n{result.stderr}")
        yield url


@pytest.fixture(scope="session", autouse=True)
def _bind_app_to_test_database(postgres_database_url):
    """Every app module that reads DATABASE_URL does so at import time, so
    this env var must be set before api.dependencies/api.main are ever
    imported - hence session-scoped + autouse rather than per-test."""
    os.environ["DATABASE_URL"] = postgres_database_url
    yield


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    """api/rate_limiting.py's Limiter is a module-level singleton shared by
    every test in this session (each test gets its own FastAPI() app, but
    they all import the same Limiter instance) - without resetting it here,
    tests that hit /auth/register or /auth/login enough times would start
    tripping 429s against each other instead of the app they're testing."""
    from api.rate_limiting import limiter

    limiter.reset()
    yield


@pytest_asyncio.fixture
async def api_client(_bind_app_to_test_database):
    """An httpx.AsyncClient wired directly to the real FastAPI app (routers
    only - not api.main's lifespan, so no background worker task competes
    with test assertions for rows)."""
    import httpx
    from fastapi import FastAPI

    from api.routers import auth, cases, evidence, assessments, reports

    app = FastAPI()
    app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
    app.include_router(cases.router, prefix="/api/v1/cases", tags=["Cases"])
    app.include_router(evidence.router)
    app.include_router(assessments.router, prefix="/api/v1/assessments", tags=["Assessments"])
    app.include_router(reports.router, prefix="/api/v1/reports", tags=["Reports"])

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest_asyncio.fixture
async def db_session(_bind_app_to_test_database):
    """A raw AsyncSession for tests that need to call worker-side functions
    (e.g. the purge sweep) directly rather than through the HTTP API."""
    from infrastructure.persistence.database import async_session_maker

    async with async_session_maker() as session:
        yield session


async def _register_and_verify(api_client, db_session) -> dict:
    """Registers a fresh user with a unique email, then bypasses real email
    delivery (there's no SMTP in tests) by verifying them directly in the DB
    - api/routers/auth.py's actual verify_email flow is covered separately
    in test_api_auth.py."""
    from sqlalchemy import text

    email = f"test-{uuid.uuid4().hex[:12]}@example.com"
    response = await api_client.post("/api/v1/auth/register", json={"email": email, "password": TEST_PASSWORD})
    assert response.status_code == 201, response.text

    await db_session.execute(text("UPDATE core.users SET is_verified = true WHERE email = :email"), {"email": email})
    await db_session.commit()

    return {"email": email, "password": TEST_PASSWORD}


async def _login_headers(api_client, credentials: dict) -> dict:
    login = await api_client.post(
        "/api/v1/auth/login",
        json={"email": credentials["email"], "password": credentials["password"]},
    )
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def registered_user(api_client, db_session):
    return await _register_and_verify(api_client, db_session)


@pytest_asyncio.fixture
async def auth_headers(api_client, registered_user):
    """A valid Authorization header for a freshly registered + verified
    user, for tests that just need *some* authenticated identity and don't
    care whose."""
    return await _login_headers(api_client, registered_user)


@pytest_asyncio.fixture
async def other_registered_user(api_client, db_session):
    """A second, distinct verified user - for tests asserting that shared
    team visibility doesn't also mean shared edit/delete rights (see
    test_authorization_boundaries.py)."""
    return await _register_and_verify(api_client, db_session)


@pytest_asyncio.fixture
async def other_auth_headers(api_client, other_registered_user):
    return await _login_headers(api_client, other_registered_user)
