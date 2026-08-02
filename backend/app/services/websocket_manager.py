import asyncio
import json
import logging
import os
from collections import defaultdict
from typing import Dict, List

import redis.asyncio as redis
from fastapi import WebSocket

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = defaultdict(list)
        self.redis = redis.from_url(REDIS_URL, decode_responses=True)
        self.pubsub = self.redis.pubsub()
        self.pubsub_task = None

    async def connect(self, websocket: WebSocket, conversation_id: str):
        await websocket.accept()
        self.active_connections[conversation_id].append(websocket)
        
        # Subscribe to redis channel for this conversation if not already subscribed
        if len(self.active_connections[conversation_id]) == 1:
            await self.pubsub.subscribe(conversation_id)
            if self.pubsub_task is None or self.pubsub_task.done():
                self.pubsub_task = asyncio.create_task(self._listen_to_redis())

    def disconnect(self, websocket: WebSocket, conversation_id: str):
        if websocket in self.active_connections.get(conversation_id, []):
            self.active_connections[conversation_id].remove(websocket)
        if not self.active_connections[conversation_id]:
            del self.active_connections[conversation_id]
            # Unsubscribe from redis channel
            asyncio.create_task(self.pubsub.unsubscribe(conversation_id))

    async def broadcast_to_conversation(self, conversation_id: str, message: dict):
        """
        Gửi tin nhắn thông qua Redis Pub/Sub. Các process khác hoặc manager cục bộ sẽ bắt được message.
        """
        await self.redis.publish(conversation_id, json.dumps(message))

    async def _listen_to_redis(self):
        try:
            async for message in self.pubsub.listen():
                if message["type"] == "message":
                    conversation_id = message["channel"]
                    data = message["data"]
                    # Send to all local websockets connected to this conversation
                    if conversation_id in self.active_connections:
                        connections_to_remove = []
                        for connection in self.active_connections[conversation_id]:
                            try:
                                await connection.send_text(data)
                            except Exception as e:
                                logger.error(f"Error sending message to websocket: {e}")
                                connections_to_remove.append(connection)
                        
                        for conn in connections_to_remove:
                            self.disconnect(conn, conversation_id)
        except asyncio.CancelledError:
            logger.info("Redis listener task cancelled")
        except Exception as e:
            logger.error(f"Redis pubsub error: {e}")

manager = ConnectionManager()
