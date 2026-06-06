from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey, Integer,
    String, Text, UniqueConstraint, func,
)
from db import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String(64), unique=True, nullable=False)
    display_name = Column(String(128), nullable=False, default="")
    password_hash = Column(String(255), nullable=False)
    is_admin = Column(Boolean, nullable=False, default=False)
    color = Column(String(16), nullable=True)  # hex color for this user's tasks
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)


class KanbanColumn(Base):
    __tablename__ = "columns"
    id = Column(Integer, primary_key=True)
    name = Column(String(128), nullable=False)
    color = Column(String(16), nullable=False, default="#6b7280")
    position = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True)
    title = Column(String(512), nullable=False)
    description = Column(Text, nullable=True)
    column_id = Column(Integer, ForeignKey("columns.id", ondelete="RESTRICT"), nullable=False)
    position = Column(Float, nullable=False, default=0.0)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_to = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class TaskPropertyDef(Base):
    __tablename__ = "task_property_defs"
    id = Column(Integer, primary_key=True)
    name = Column(String(128), nullable=False)
    field_type = Column(String(16), nullable=False)  # text|select|date|user|number
    options_json = Column(Text, nullable=True)
    is_required = Column(Boolean, nullable=False, default=False)
    position = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class TaskAttachment(Base):
    __tablename__ = "task_attachments"
    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(512), nullable=False)
    file_type = Column(String(64), nullable=False)
    file_size = Column(Integer, nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    endpoint = Column(String(512), unique=True, nullable=False)
    p256dh = Column(String(255), nullable=False)
    auth = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class TaskPropertyValue(Base):
    __tablename__ = "task_property_values"
    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    prop_def_id = Column(Integer, ForeignKey("task_property_defs.id", ondelete="CASCADE"), nullable=False)
    value_text = Column(Text, nullable=True)
    __table_args__ = (UniqueConstraint("task_id", "prop_def_id"),)
