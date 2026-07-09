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

def run_migrations_offline() -> None:
    # Hardcoded URL for offline
    url = "postgresql+psycopg2://postgres:postgres_password@db:5432/veritas_nexus"
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    # Hardcoded URL for online - using psycopg2 for migrations
    connectable = create_engine(
        "postgresql+psycopg2://postgres:postgres_password@db:5432/veritas_nexus",
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