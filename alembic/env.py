import sys
import os

# Force the current working directory into the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.getcwd(), ".")))

from logging.config import fileConfig
from sqlalchemy import create_engine
from sqlalchemy import pool
from alembic import context

# Import your metadata
from infrastructure.persistence.models import Base
target_metadata = Base.metadata

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

def get_url() -> str:
    # Reuse the same DATABASE_URL the app itself reads (infrastructure/persistence/database.py),
    # swapped to the sync psycopg2 driver alembic needs. This used to be hardcoded to the
    # docker-compose DB, which made it impossible to point migrations at a test database.
    url = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres_password@db:5432/veritas_nexus")
    return url.replace("+asyncpg", "+psycopg2")

def run_migrations_offline() -> None:
    context.configure(
        url=get_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    connectable = create_engine(
        get_url(),
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, 
            target_metadata=target_metadata
        )
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()