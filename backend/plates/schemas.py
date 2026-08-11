from datetime import datetime

from ninja import Field, Schema


class PlateOut(Schema):
    id: int
    name: str
    row_count: int
    col_count: int
    created_at: datetime


class PlateListOut(PlateOut):
    well_count: int
    last_reading_at: datetime | None


class MeasurementOut(Schema):
    id: int
    value: int
    recorded_at: datetime
    created_at: datetime
    updated_at: datetime


class WellOut(Schema):
    id: int
    row_index: int
    col_index: int
    latest: MeasurementOut | None


class MeasurementIn(Schema):
    # First of the two deliberate validation layers: this is what turns an
    # out-of-range reading into a 422. The DB CheckConstraint is the backstop.
    value: int = Field(ge=0, le=100)
    recorded_at: datetime | None = None
