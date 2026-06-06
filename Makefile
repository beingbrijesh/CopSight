install:
	pip install -e .

dev:
	pip install -e .[dev]

lint:
	ruff check forensixd/
	mypy forensixd/

test:
	pytest tests/ -v

clean:
	rm -rf dist/ build/ .coverage __pycache__
