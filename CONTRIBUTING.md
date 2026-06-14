# Contributing to CopSight AI

First, thank you for considering contributing to CopSight AI! This document outlines the process, code standards, and architecture guidelines for developers wishing to contribute.

---

## 🏗️ Architecture Familiarization

Before contributing, please read the following architectural documents to understand how the platform components interact:
1. [ARCHITECTURE-DIAGRAM.md](ARCHITECTURE-DIAGRAM.md) — The 5-tier architecture
2. [DATA-FLOW-DIAGRAM.md](DATA-FLOW-DIAGRAM.md) — How evidence moves through the system
3. [API-DOCS.md](API-DOCS.md) — The REST API contracts

Understanding the separation between the Node.js API Gateway, the Python AI Service, and the forensixd CLI is critical.

---

## 🛠️ Development Setup

### 1. Repository Setup

```bash
git clone https://github.com/your-org/CopSight.git
cd CopSight

# Install Python dev dependencies (pre-commit, ruff, pytest, etc.)
cd forensixd
pip install -e ".[dev]"
```

### 2. Pre-commit Hooks (Required)

We use `pre-commit` to ensure code formatting and linting standards are met *before* code is pushed.

```bash
# From the project root
pre-commit install
pre-commit install -t pre-push
```

This ensures that `ruff` (Python linting/formatting) and `eslint` (JS/TS linting) run automatically when you commit.

---

## 📏 Code Standards

### Python (`ai-service` & `forensixd`)

- **Formatter & Linter:** We use `Ruff`.
- **Type Hinting:** Mandatory. We use `mypy` for static analysis. All functions must have type hints.
- **Docstrings:** Use Google-style docstrings for all classes and public methods.
- **Validation:** Use `Pydantic v2` for all data models.
- **Imports:** Absolute imports are preferred over relative imports.

```python
# Example of expected Python style
from typing import Optional
from pydantic import BaseModel

class ExtractionResult(BaseModel):
    """Represents the outcome of a device extraction."""
    device_id: str
    success: bool
    error_message: Optional[str] = None
    
    def is_complete(self) -> bool:
        """Check if extraction finished without errors."""
        return self.success and self.error_message is None
```

### Node.js (`backend-node`)

- **Syntax:** ES Modules (`import`/`export`) are mandatory. CommonJS (`require`) is deprecated in this project.
- **Linter:** ESLint with Prettier integration.
- **Async/Await:** Avoid raw Promises/`.then()`. Always use `async/await` with proper `try/catch` blocks.
- **Error Handling:** Pass errors to the `next(error)` middleware; do not send generic 500s directly from controllers.

### React (`frontend`)

- **Language:** TypeScript (`.tsx`) is mandatory. No plain JavaScript.
- **Components:** Functional components only. Use hooks. No class components.
- **Styling:** TailwindCSS exclusively. Avoid custom CSS files unless strictly necessary for D3/Force graph overrides.
- **State:** Use `Zustand` for global state. Avoid React Context unless it's for dependency injection.

---

## 🧪 Testing Guidelines

We enforce a strict testing policy for new features.

### Python Tests (`pytest`)
Write tests in the `tests/` directory.

```bash
# Run all Python tests
pytest tests/

# Run with coverage report
pytest --cov=forensixd tests/
```

### Node.js Tests (`jest`)
Backend tests use Jest and Supertest.

```bash
cd backend-node
npm run test
```

**PR Requirement:** New features must include unit tests. Bug fixes must include a regression test that fails without the fix and passes with it.

---

## 🌿 Git Workflow & Pull Requests

We use a feature-branch workflow:

1. **Create a branch:** `git checkout -b feature/your-feature-name` or `bugfix/issue-description`
2. **Commit frequently:** Write descriptive commit messages.
3. **Run tests locally:** Ensure everything passes.
4. **Push:** Push to your fork or branch.
5. **Open a PR:** Point your PR to the `main` branch.

### Pull Request Checklist

When submitting a PR, ensure you check the following:

- [ ] Code passes all linters (`pre-commit run --all-files`)
- [ ] Tests pass locally (`pytest` and `npm test`)
- [ ] New functionality is covered by tests
- [ ] API changes are documented in `API-DOCS.md`
- [ ] Architecture changes are reflected in `ARCHITECTURE-DIAGRAM.md`
- [ ] No hardcoded paths (e.g., `/Users/name/...`)
- [ ] Environment variable changes are added to `.env.example`

---

## 🐞 Bug Reports & Feature Requests

Please use GitHub Issues. Include:
- **Environment:** OS, Node version, Python version, Docker version
- **Logs:** Relevant error outputs (please redact sensitive API keys or case data)
- **Reproduction Steps:** How to reproduce the bug

---

Thank you for helping make CopSight AI the premier open-source forensic platform!
