from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.chat_message import ChatMessage
from models.chat_session import ChatSession


async def get_session_by_id(session_id: str, db: AsyncSession) -> ChatSession | None:
    result = await db.execute(
        select(ChatSession)
        .options(selectinload(ChatSession.messages))
        .where(ChatSession.id == session_id)
    )
    return result.scalar_one_or_none()


async def get_or_create_session(
    session_id: str | None = None,
    user_id: int | None = None,
    session_token: str | None = None,
    db: AsyncSession | None = None,
) -> ChatSession:
    if db is None:
        raise ValueError("Database session (db) is required")

    session: ChatSession | None = None
    if session_id:
        session = await get_session_by_id(session_id, db)

    if session is None and session_token:
        result = await db.execute(
            select(ChatSession)
            .options(selectinload(ChatSession.messages))
            .where(ChatSession.session_token == session_token)
            .order_by(ChatSession.created_at.desc())
        )
        session = result.scalars().first()

    if session is None and user_id is not None and not session_id and not session_token:
        user_sessions = await list_user_sessions(user_id=user_id, limit=1, db=db)
        if user_sessions:
            session = user_sessions[0]


    if session:
        # If user logs in while using an existing guest session, bind user_id
        if user_id and session.user_id is None:
            session.user_id = user_id
            await db.flush()
        return session

    # Otherwise create a new session
    session_kwargs: dict[str, Any] = {
        "user_id": user_id,
        "session_token": session_token,
    }
    if session_id:
        session_kwargs["id"] = session_id

    session = ChatSession(**session_kwargs)
    db.add(session)
    await db.flush()
    return session


async def add_chat_message(
    session_id: str,
    role: str,
    content: str,
    metadata_info: dict[str, Any] | list[Any] | None = None,
    db: AsyncSession | None = None,
) -> ChatMessage:
    if db is None:
        raise ValueError("Database session (db) is required")

    msg = ChatMessage(
        session_id=session_id,
        role=role,
        content=content,
        metadata_info=metadata_info,
    )
    db.add(msg)
    
    # Update the parent session's updated_at
    from models.base import utc_now
    from sqlalchemy import update
    await db.execute(
        update(ChatSession)
        .where(ChatSession.id == session_id)
        .values(updated_at=utc_now())
    )
    
    await db.flush()
    return msg


async def get_chat_history(
    session_id: str,
    limit: int = 50,
    db: AsyncSession | None = None,
) -> list[ChatMessage]:
    if db is None:
        raise ValueError("Database session (db) is required")

    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
    )
    messages = list(result.scalars().all())
    messages.sort(key=lambda m: m.created_at)
    return messages


async def list_user_sessions(
    user_id: int,
    limit: int = 20,
    db: AsyncSession | None = None,
) -> list[ChatSession]:
    if db is None:
        raise ValueError("Database session (db) is required")

    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == user_id)
        .order_by(ChatSession.updated_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())

async def list_user_sessions_with_first_message(
    user_id: int,
    limit: int = 20,
    db: AsyncSession | None = None,
) -> list[ChatSession]:
    if db is None:
        raise ValueError("Database session (db) is required")

    result = await db.execute(
        select(ChatSession)
        .options(selectinload(ChatSession.messages))
        .where(ChatSession.user_id == user_id)
        .order_by(ChatSession.updated_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())
