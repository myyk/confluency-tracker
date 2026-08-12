"""Seed one 96-well plate with partial confluency history.

The 6-well plates from 0002 stay exactly as they are; this adds the format
the grid has to cope with at density. Nothing about the schema changes --
row_count/col_count already say 8x12 and the labels are derived -- so this
is the whole of what "support 96-well plates" costs on the backend.

What the data is built to show at a glance:
  - a realistic spread: most wells growing towards a per-well plateau, so
    the latest readings land across growing / optimal / over-confluent
  - three wells where the seeding never took, still in the very low band
    five days on
  - four wells that ran past their split point and are over-confluent
  - column 6 never measured at all, so a whole column reads as no data

Timestamps are relative to the moment the migration runs and the RNG is
explicitly seeded, so repeated runs on a fresh clone produce the same plate.
"""

import random
from datetime import timedelta

from django.db import migrations
from django.utils import timezone

PLATE_NAME = "PLT-0011 HEK293T p14"
ROW_COUNT = 8
COL_COUNT = 12

SEEDED_DAYS_AGO = 5
READING_DAYS = 4

# Column index 5 is the column labelled 6. A whole column of no-data wells is
# the case the compact rendering is most likely to get wrong -- an empty well
# has to stay visibly different from a well reading zero.
EMPTY_COLUMN = 5

# (row_index, col_index) of the wells that are deliberately not on the curve.
POOR_WELLS = {(0, 0), (3, 7), (6, 10)}
OVER_CONFLUENT_WELLS = {(1, 2), (2, 9), (5, 4), (7, 11)}


def _at(now, days_ago):
    """The 09:15 reading slot, `days_ago` days before the migration ran."""
    return (now - timedelta(days=days_ago)).replace(
        hour=9, minute=15, second=0, microsecond=0
    )


def _plateau(rng, row, col):
    if (row, col) in POOR_WELLS:
        return rng.randint(3, 14)
    if (row, col) in OVER_CONFLUENT_WELLS:
        return rng.randint(93, 99)
    return rng.randint(45, 90)


def _growth_curve(rng, plateau, days):
    """Confluency for each day of a well's life: slow start, then plateau.

    The same shape as the 6-well seed, but the plateau is chosen per well by
    the caller rather than drawn here, which is what lets a few wells be
    deliberately poor and a few deliberately over-confluent.
    """
    value = min(plateau, rng.randint(3, 12))
    curve = [value]
    for _ in range(days):
        value = min(plateau, value + round((plateau - value) * rng.uniform(0.4, 0.7)))
        curve.append(value)
    return curve


def seed(apps, schema_editor):
    Plate = apps.get_model("plates", "Plate")
    Well = apps.get_model("plates", "Well")
    Measurement = apps.get_model("plates", "Measurement")

    rng = random.Random(20260812)
    now = timezone.now()

    plate = Plate.objects.create(
        name=PLATE_NAME,
        row_count=ROW_COUNT,
        col_count=COL_COUNT,
        created_at=_at(now, SEEDED_DAYS_AGO),
    )
    Well.objects.bulk_create(
        Well(plate=plate, row_index=row, col_index=col)
        for row in range(ROW_COUNT)
        for col in range(COL_COUNT)
    )

    # The last READING_DAYS days of the plate's life, stopping a day short of
    # today: the 09:15 slot has not come round yet when the migration runs in
    # the morning, and a reading stamped in the future is not a reading.
    days = range(SEEDED_DAYS_AGO - READING_DAYS, SEEDED_DAYS_AGO)

    measurements = []
    for well in plate.wells.all():
        if well.col_index == EMPTY_COLUMN:
            continue

        curve = _growth_curve(
            rng, _plateau(rng, well.row_index, well.col_index), SEEDED_DAYS_AGO
        )
        for day in days:
            recorded_at = _at(now, SEEDED_DAYS_AGO - day)
            measurements.append(
                Measurement(
                    well=well,
                    value=curve[day],
                    recorded_at=recorded_at,
                    # Nothing here has been corrected, so the row was written
                    # when it was recorded and never touched again.
                    created_at=recorded_at,
                    updated_at=recorded_at,
                    deleted_at=None,
                )
            )
    Measurement.objects.bulk_create(measurements)


def unseed(apps, schema_editor):
    Plate = apps.get_model("plates", "Plate")
    # Wells and measurements go with the plate via on_delete=CASCADE.
    Plate.objects.filter(name=PLATE_NAME).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("plates", "0002_seed_demo_plates"),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
