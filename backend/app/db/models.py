"""Database models."""

from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import ForeignKey, Index, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class UsageRecord(Base):
    __tablename__ = "usage_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    instance_id: Mapped[str] = mapped_column(String(64), index=True)
    provider: Mapped[str] = mapped_column(String(32))
    model: Mapped[str] = mapped_column(String(64))
    input_tokens: Mapped[int]
    output_tokens: Mapped[int]
    estimated_cost: Mapped[float]
    timestamp: Mapped[datetime] = mapped_column(default=func.now())


class FormSubmission(Base):
    __tablename__ = "form_submissions"

    id: Mapped[int] = mapped_column(primary_key=True)
    url: Mapped[str] = mapped_column(String(2048))
    page_title: Mapped[str | None] = mapped_column(String(512))
    persona: Mapped[str | None] = mapped_column(Text)
    form_context: Mapped[str | None] = mapped_column(Text)
    instance_id: Mapped[str | None] = mapped_column(String(64), index=True)
    submitted_at: Mapped[datetime] = mapped_column(default=func.now())

    fields: Mapped[list["SubmissionField"]] = relationship(
        back_populates="submission", cascade="all, delete-orphan"
    )


class SubmissionField(Base):
    __tablename__ = "submission_fields"

    id: Mapped[int] = mapped_column(primary_key=True)
    submission_id: Mapped[int] = mapped_column(ForeignKey("form_submissions.id"))
    field_id: Mapped[str] = mapped_column(String(256))
    label: Mapped[str | None] = mapped_column(String(512))
    field_type: Mapped[str | None] = mapped_column(String(64))
    generated_value: Mapped[str] = mapped_column(Text)
    submitted_value: Mapped[str | None] = mapped_column(Text)
    was_corrected: Mapped[bool] = mapped_column(default=False)
    embedding = mapped_column(Vector(384), nullable=True)

    submission: Mapped["FormSubmission"] = relationship(back_populates="fields")


# HNSW index for fast approximate nearest neighbor search
Index(
    "ix_submission_field_embedding",
    SubmissionField.embedding,
    postgresql_using="hnsw",
    postgresql_with={"m": 16, "ef_construction": 64},
    postgresql_ops={"embedding": "vector_cosine_ops"},
)
