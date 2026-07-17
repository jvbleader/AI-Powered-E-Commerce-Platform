from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserMeResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    public_id: str = Field(serialization_alias="publicId")
    full_name: str = Field(serialization_alias="full_name")
    email: EmailStr
    phone: str
    avatar_url: str | None = Field(default=None, serialization_alias="avatarUrl")
    gender: str | None = None
    date_of_birth: date | None = Field(default=None, serialization_alias="dateOfBirth")
    email_verified_at: datetime | None = Field(
        default=None, serialization_alias="emailVerifiedAt"
    )
    phone_verified_at: datetime | None = Field(
        default=None, serialization_alias="phoneVerifiedAt"
    )
    status: str
    locked_until: datetime | None = Field(
        default=None, serialization_alias="lockedUntil"
    )
    lock_reason: str | None = Field(default=None, serialization_alias="lockReason")
    roles: list[str]

class UserUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=150)
    gender: str | None = Field(default=None)
    date_of_birth: date | None = Field(default=None)
    avatar_url: str | None = Field(default=None)


class AdminCreateUserRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=150)
    email: EmailStr
    phone: str
    password: str = Field(min_length=8)
    roles: list[str]


class UserRolesUpdateRequest(BaseModel):
    roles: list[str]
