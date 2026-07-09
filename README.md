# Veritas Nexus

**Unified Digital Media Intelligence Platform**

Veritas Nexus is an enterprise-grade digital evidence orchestration platform developed for the National Signals Bureau (NSB) of Ghana. It transitions isolated forensic scripts into a unified, operational workflow by providing policy-driven correlation of machine learning deepfake detection (ViT-CORE-FORENSICS) and cryptographic provenance verification (C2PA-Veritas).

## Architectural Philosophy

Nexus is built on strict **Clean Architecture** principles. The system treats forensic models not as standalone applications, but as interchangeable "Engines" that feed normalized Facts into a central Correlation Engine. 

### Core Design Tenets
1. **Immutable Chain of Custody:** Evidence, Analysis Runs, Assessments, and Reports are strictly immutable. Deletions and overwrites are architecturally prohibited.
2. **Facts vs. Judgments:** Engines produce Facts (Analysis Runs). The Correlation Engine applies customizable Policies to produce Judgments (Authenticity Assessments).
3. **Plugin-Based Extensibility:** The platform auto-discovers forensic engines. Adding new capabilities (e.g., Audio Forensics, OCR, Metadata Analysis) requires zero changes to the core orchestration pipeline.
4. **Framework Agnostic Domain:** The core forensic rules and domain models have zero dependencies on external frameworks (FastAPI, SQLAlchemy, etc.).

## Repository Structure

The monorepo is organized by architectural boundary rather than feature:

* `domain/`: Pure Python business logic, entity definitions, and policy frameworks.
* `application/`: The orchestrating Use Cases, DTOs, and interface Ports.
* `infrastructure/`: Adapters fulfilling the application Ports (PostgreSQL, Local Storage, Engine Plugins).
* `api/`: The FastAPI delivery mechanism.
* `frontend/`: The React/Vite Analyst Workstation dashboard.

---

## Local Development Setup

We utilize Docker Compose to spin up the modular monolith infrastructure (FastAPI Gateway + PostgreSQL Database), and Vite for the frontend React application.

### 1. Backend Infrastructure (Docker)

**Clone the repository:**
   ```bash
   git clone [https://github.com/your-org/veritas-nexus.git](https://github.com/your-org/veritas-nexus.git)
   cd veritas-nexus
   ```
2. **Configure Environment Variables:**
Create a .env file in the root directory.
```bash
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=veritas_nexus
DATABASE_URL=postgresql+asyncpg://postgres:your_secure_password@nexus_db:5432/veritas_nexus
```

3. **Spin up the containers:**
```bash
docker-compose up -d --build
```
This launches nexus_api (FastAPI) on port 8000 and nexus_db (PostgreSQL) on port 5432. It also provisions local volumes for database data and physical evidence storage (nexus_storage_vault).
