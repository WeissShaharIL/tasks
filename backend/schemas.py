from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    display_name: str
    is_admin: bool
    color: Optional[str] = None

    class Config:
        from_attributes = True


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class UserCreate(BaseModel):
    username: str
    display_name: str
    password: str
    is_admin: bool = False
    color: Optional[str] = None


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    password: Optional[str] = None
    is_admin: Optional[bool] = None
    color: Optional[str] = None


class ColumnCreate(BaseModel):
    name: str
    color: str = "#6b7280"


class ColumnUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


class ColumnOut(BaseModel):
    id: int
    name: str
    color: str
    position: int

    class Config:
        from_attributes = True


class ColumnsReorder(BaseModel):
    ids: List[int]


class PropertyValueIn(BaseModel):
    prop_def_id: int
    value_text: Optional[str] = None


class PropertyValueOut(BaseModel):
    prop_def_id: int
    value_text: Optional[str] = None

    class Config:
        from_attributes = True


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    column_id: int
    assigned_to: Optional[int] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assigned_to: Optional[int] = None


class TaskMove(BaseModel):
    column_id: int
    position: float


class TaskOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    column_id: int
    position: float
    created_by: Optional[int]
    assigned_to: Optional[int]
    created_at: datetime
    updated_at: datetime
    properties: List[PropertyValueOut] = []

    class Config:
        from_attributes = True


class PropertyDefCreate(BaseModel):
    name: str
    field_type: str
    options_json: Optional[str] = None
    is_required: bool = False


class PropertyDefUpdate(BaseModel):
    name: Optional[str] = None
    field_type: Optional[str] = None
    options_json: Optional[str] = None
    is_required: Optional[bool] = None


class PropertyDefOut(BaseModel):
    id: int
    name: str
    field_type: str
    options_json: Optional[str]
    is_required: bool
    position: int

    class Config:
        from_attributes = True


class PropertyDefsReorder(BaseModel):
    ids: List[int]


class BoardOut(BaseModel):
    columns: List[ColumnOut]
    tasks: List[TaskOut]
    property_defs: List[PropertyDefOut]
    users: List[UserOut]
