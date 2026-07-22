import asyncio
import logging
from datetime import datetime
from core.database import AsyncSessionLocal
from services.statistics_service import recalculate_all_statistics

logger = logging.getLogger("scheduler")

# Run 2 times a day = Every 12 hours (43,200 seconds)
STATISTICS_INTERVAL_SECONDS = 12 * 60 * 60

_scheduler_task: asyncio.Task | None = None

async def _statistics_loop():
    logger.info("Starting background scheduler: Shop & Platform Statistics job (runs 2 times/day)")
    while True:
        try:
            logger.info(f"[{datetime.utcnow().isoformat()}] Running scheduled statistics calculation...")
            async with AsyncSessionLocal() as db:
                res = await recalculate_all_statistics(db)
                logger.info(f"Scheduled statistics job finished: {res}")
        except Exception as e:
            logger.error(f"Error executing scheduled statistics job: {e}", exc_info=True)

        # Sleep for 12 hours until next run
        await asyncio.sleep(STATISTICS_INTERVAL_SECONDS)

def start_scheduler():
    global _scheduler_task
    if _scheduler_task is None or _scheduler_task.done():
        _scheduler_task = asyncio.create_task(_statistics_loop())
        logger.info("Background Statistics Scheduler started successfully.")

def stop_scheduler():
    global _scheduler_task
    if _scheduler_task and not _scheduler_task.done():
        _scheduler_task.cancel()
        logger.info("Background Statistics Scheduler stopped.")
