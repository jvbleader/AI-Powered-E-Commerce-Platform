FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app/app:/app
ENV PORT=8000

WORKDIR /app

COPY requirements.txt .
RUN python -m pip install --upgrade pip \
    && python -m pip install --no-cache-dir -r requirements.txt python-dotenv

COPY . .

EXPOSE 8000

CMD ["sh", "-c", "if [ \"${INIT_DB_ON_START:-true}\" = \"true\" ]; then alembic upgrade head; python -c \"import asyncio, importlib, pkgutil, models; from core.database import engine; from models.base import Base; [importlib.import_module(f'models.{m.name}') for m in pkgutil.iter_modules(models.__path__) if m.name != 'base' and not m.name.startswith('_')]; ns = {'engine': engine, 'Base': Base}; exec('async def init_db():\\n    async with engine.begin() as conn:\\n        await conn.run_sync(Base.metadata.create_all)\\n    await engine.dispose()', ns); asyncio.run(ns['init_db']())\"; fi; exec python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --reload --reload-dir /app --timeout-graceful-shutdown 2"]

