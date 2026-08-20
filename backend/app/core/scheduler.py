import asyncio
import logging
from datetime import datetime
from core.database import AsyncSessionLocal
from services.admin.statistics_service import recalculate_all_statistics
from services.order.order_service import (
    auto_complete_delivered_orders,
    process_expired_orders,
)

logger = logging.getLogger("scheduler")

# Run 2 times a day = Every 12 hours (43,200 seconds)
STATISTICS_INTERVAL_SECONDS = 12 * 60 * 60

# Check expired & auto-complete orders every 5 minutes (300 seconds)
ORDER_EXPIRATION_INTERVAL_SECONDS = 5 * 60

_scheduler_task: asyncio.Task | None = None
_order_expiration_task: asyncio.Task | None = None

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

async def _order_expiration_loop():
    logger.info("Starting background scheduler: Order Expiration & Auto-complete check job (runs every 5 minutes)")
    while True:
        try:
            async with AsyncSessionLocal() as db:
                res = await process_expired_orders(db)
                auto_completed = await auto_complete_delivered_orders(db)
                from services.wallet.wallet_service import expire_stale_pending_topups
                expired_topups = await expire_stale_pending_topups(db)
                await db.commit()
                if (
                    res.get("expired_payments", 0) > 0
                    or res.get("expired_seller_confirms", 0) > 0
                    or auto_completed > 0
                    or expired_topups > 0
                ):
                    logger.info(
                        f"[{datetime.utcnow().isoformat()}] Scheduled expiration & auto-complete job finished: "
                        f"orders={res}, auto_completed={auto_completed}, expired_wallet_topups={expired_topups}"
                    )
        except Exception as e:
            logger.error(f"Error executing scheduled order expiration & auto-complete job: {e}", exc_info=True)

        # Sleep for 5 minutes until next run
        await asyncio.sleep(ORDER_EXPIRATION_INTERVAL_SECONDS)

def start_scheduler():
    global _scheduler_task, _order_expiration_task
    if _scheduler_task is None or _scheduler_task.done():
        _scheduler_task = asyncio.create_task(_statistics_loop())
        logger.info("Background Statistics Scheduler started successfully.")

    if _order_expiration_task is None or _order_expiration_task.done():
        _order_expiration_task = asyncio.create_task(_order_expiration_loop())
        logger.info("Background Order Expiration Scheduler started successfully.")

def stop_scheduler():
    global _scheduler_task, _order_expiration_task
    if _scheduler_task and not _scheduler_task.done():
        _scheduler_task.cancel()
        logger.info("Background Statistics Scheduler stopped.")

    if _order_expiration_task and not _order_expiration_task.done():
        _order_expiration_task.cancel()
        logger.info("Background Order Expiration Scheduler stopped.")
