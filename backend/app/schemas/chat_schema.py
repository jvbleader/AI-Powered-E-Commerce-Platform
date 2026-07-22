from datetime import datetime
from typing import Any

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class ChatMessageResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: int
    session_id: str = Field(
        validation_alias=AliasChoices("session_id", "sessionId"),
        serialization_alias="sessionId",
    )
    role: str
    content: str
    metadata: dict[str, Any] | list[Any] | None = Field(
        default=None,
        validation_alias=AliasChoices("metadata_info", "metadata"),
        serialization_alias="metadata",
    )
    created_at: datetime = Field(
        validation_alias=AliasChoices("created_at", "createdAt"),
        serialization_alias="createdAt",
    )


class ChatSessionResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: str
    user_id: int | None = Field(
        default=None,
        validation_alias=AliasChoices("user_id", "userId"),
        serialization_alias="userId",
    )
    session_token: str | None = Field(
        default=None,
        validation_alias=AliasChoices("session_token", "sessionToken"),
        serialization_alias="sessionToken",
    )
    created_at: datetime = Field(
        validation_alias=AliasChoices("created_at", "createdAt"),
        serialization_alias="createdAt",
    )
    messages: list[ChatMessageResponse] = Field(default_factory=list)


class SendMessageRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    message: str = Field(..., min_length=1)
    session_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("session_id", "sessionId"),
        serialization_alias="sessionId",
    )
    session_token: str | None = Field(
        default=None,
        validation_alias=AliasChoices("session_token", "sessionToken"),
        serialization_alias="sessionToken",
    )
    history: list[dict[str, Any]] | None = Field(default=None)



class ChatHistoryResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    session_id: str = Field(
        validation_alias=AliasChoices("session_id", "sessionId"),
        serialization_alias="sessionId",
    )
    messages: list[ChatMessageResponse] = Field(default_factory=list)

