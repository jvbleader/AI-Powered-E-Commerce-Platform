import asyncio
import json
import logging
from collections import defaultdict
from typing import Dict, List, Set

import redis.asyncio as redis
from fastapi import WebSocket

from core.config import settings

logger = logging.getLogger(__name__)

REDIS_URL = settings.REDIS_URL

# Every chat event travels on one Redis channel and is routed to logical
# channels in-process. Subscribing/unsubscribing per conversation while another
# task sits in pubsub.listen() deadlocks redis-py's asyncio client.
FANOUT_CHANNEL = "ws:fanout"

LISTENER_RETRY_SEC = 1.0


def conversation_channel(conversation_id: str) -> str:
    return conversation_id


def inbox_user_channel(user_id: int) -> str:
    return f"seller:inbox:user:{user_id}"


def inbox_shop_channel(shop_id: int) -> str:
    return f"seller:inbox:shop:{shop_id}"


def support_inbox_guest_channel(guest_id: str) -> str:
    return f"support:inbox:guest:{guest_id}"


def support_inbox_customer_channel(user_id: int) -> str:
    return f"support:inbox:customer:{user_id}"


def support_inbox_supporter_channel(user_id: int) -> str:
    return f"support:inbox:supporter:{user_id}"


def support_inbox_queue_channel() -> str:
    return "support:inbox:queue"


def _is_inbox_channel(channel: str) -> bool:
    return channel.startswith("seller:inbox:") or channel.startswith("support:inbox:")


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = defaultdict(list)
        self._ws_channels: Dict[WebSocket, Set[str]] = {}
        self._accepted_websockets: Set[WebSocket] = set()
        self.redis = redis.from_url(REDIS_URL, decode_responses=True)
        self.pubsub = None
        self.pubsub_task: asyncio.Task | None = None
        self._online_key = "seller:inbox:online"

    def has_subscribers(self, channel: str) -> bool:
        return bool(self.active_connections.get(channel))

    async def is_inbox_online(self, channel: str) -> bool:
        try:
            return bool(await self.redis.sismember(self._online_key, channel))
        except Exception:
            return self.has_subscribers(channel)

    async def connect(self, websocket: WebSocket, channel: str):
        """Accept the socket once, then attach it to any number of channels."""
        if websocket not in self._accepted_websockets:
            await websocket.accept()
            self._accepted_websockets.add(websocket)
            self._ws_channels[websocket] = set()

        channels = self._ws_channels.setdefault(websocket, set())
        if channel in channels:
            return

        channels.add(channel)
        if websocket not in self.active_connections[channel]:
            self.active_connections[channel].append(websocket)

        if _is_inbox_channel(channel):
            try:
                await self.redis.sadd(self._online_key, channel)
            except Exception as e:
                logger.error(f"Failed to mark inbox online: {e}")

        self._ensure_listener()

    def _ensure_listener(self):
        if self.pubsub_task is None or self.pubsub_task.done():
            self.pubsub_task = asyncio.create_task(self._listen_to_redis())

    def disconnect(self, websocket: WebSocket, channel: str):
        connections = self.active_connections.get(channel, [])
        if websocket in connections:
            connections.remove(websocket)
        if channel in self.active_connections and not self.active_connections[channel]:
            del self.active_connections[channel]
            if _is_inbox_channel(channel):
                asyncio.create_task(self._clear_inbox_online(channel))

        # The accepted flag survives until disconnect_all: a socket may drop all
        # channels and later re-subscribe, and accept() must not run twice.
        channels = self._ws_channels.get(websocket)
        if channels is not None:
            channels.discard(channel)

    def disconnect_all(self, websocket: WebSocket):
        for channel in list(self._ws_channels.get(websocket, set())):
            self.disconnect(websocket, channel)
        self._accepted_websockets.discard(websocket)
        self._ws_channels.pop(websocket, None)

    async def _clear_inbox_online(self, channel: str):
        try:
            await self.redis.srem(self._online_key, channel)
        except Exception as e:
            logger.error(f"Failed to clear inbox online: {e}")

    async def broadcast(self, channel: str, message: dict):
        envelope = json.dumps({"channel": channel, "data": message}, default=str)
        try:
            await self.redis.publish(FANOUT_CHANNEL, envelope)
        except Exception as e:
            logger.error(f"Failed to publish websocket message: {e}")
            await self.send_local(channel, message)

    async def broadcast_to_conversation(self, conversation_id: str, message: dict):
        await self.broadcast(conversation_channel(conversation_id), message)

    async def broadcast_to_user_inbox(self, user_id: int, message: dict):
        await self.broadcast(inbox_user_channel(user_id), message)

    async def broadcast_to_shop_inbox(self, shop_id: int, message: dict):
        await self.broadcast(inbox_shop_channel(shop_id), message)

    async def broadcast_to_support_guest_inbox(self, guest_id: str, message: dict):
        await self.broadcast(support_inbox_guest_channel(guest_id), message)

    async def broadcast_to_support_customer_inbox(self, user_id: int, message: dict):
        await self.broadcast(support_inbox_customer_channel(user_id), message)

    async def broadcast_to_support_supporter_inbox(self, user_id: int, message: dict):
        await self.broadcast(support_inbox_supporter_channel(user_id), message)

    async def broadcast_to_support_queue(self, message: dict):
        await self.broadcast(support_inbox_queue_channel(), message)

    async def send_local(self, channel: str, message: dict):
        await self._deliver(channel, json.dumps(message, default=str))

    async def _deliver(self, channel: str, payload: str):
        stale = []
        for connection in list(self.active_connections.get(channel, [])):
            try:
                await connection.send_text(payload)
            except Exception as e:
                # Usually just a client that vanished; drop it and move on.
                logger.debug(f"Dropping websocket on {channel}: {e!r}")
                stale.append(connection)
        for connection in stale:
            self.disconnect(connection, channel)

    async def _listen_to_redis(self):
        """Single long-lived subscription; subscribe only from this task."""
        while True:
            pubsub = None
            try:
                pubsub = self.redis.pubsub()
                await pubsub.subscribe(FANOUT_CHANNEL)
                self.pubsub = pubsub

                async for raw in pubsub.listen():
                    if raw.get("type") != "message":
                        continue
                    try:
                        envelope = json.loads(raw["data"])
                    except (TypeError, ValueError):
                        continue

                    channel = envelope.get("channel")
                    if not channel or channel not in self.active_connections:
                        continue
                    await self._deliver(
                        channel, json.dumps(envelope.get("data"), default=str)
                    )
            except asyncio.CancelledError:
                if pubsub is not None:
                    try:
                        await pubsub.aclose()
                    except Exception:
                        pass
                logger.info("Redis listener task cancelled")
                break
            except Exception as e:
                logger.error(f"Redis pubsub error: {e}, restarting listener")
                if pubsub is not None:
                    try:
                        await pubsub.aclose()
                    except Exception:
                        pass
                await asyncio.sleep(LISTENER_RETRY_SEC)

    async def shutdown(self):
        """Cancel the Redis listener and close clients (dev reload / shutdown)."""
        if self.pubsub_task and not self.pubsub_task.done():
            self.pubsub_task.cancel()
            try:
                await self.pubsub_task
            except asyncio.CancelledError:
                pass
        self.pubsub_task = None

        if self.pubsub is not None:
            try:
                await self.pubsub.aclose()
            except Exception as e:
                logger.error(f"Failed to close pubsub: {e}")
            self.pubsub = None

        try:
            await self.redis.aclose()
        except Exception as e:
            logger.error(f"Failed to close redis client: {e}")

        self.active_connections.clear()
        self._ws_channels.clear()
        self._accepted_websockets.clear()


manager = ConnectionManager()
