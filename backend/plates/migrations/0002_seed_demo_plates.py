"""Seed ten 6-well plates with partial confluency history.

Demo data, not fixtures: it lives in a migration so a fresh clone gets a
usable app from `migrate` alone. Timestamps are relative to the moment the
migration runs, so the grid always looks recently worked on, and the RNG is
explicitly seeded so repeated runs produce the same numbers.

Coverage the seed is built to exercise:
  - plate 1: four days of readings on a realistic growth curve, and its
    latest readings land in every display band (very low / growing /
    optimal / over-confluent / no data)
  - plate 2: a single day of readings
  - plates 3-10: a mix of empty, one-day and multi-day histories
  - every plate has at least one well that was never read
"""

import random
from datetime import timedelta

from django.db import migrations
from django.utils import timezone

ROW_COUNT = 2
COL_COUNT = 3

# (name, days since the plate was seeded, days of readings taken)
PLATES = [
    ("PLT-0001 HEK293T p12", 4, 4),
    ("PLT-0002 CHO-K1 p7", 1, 1),
    ("PLT-0003 HeLa p22", 3, 2),
    ("PLT-0004 HEK293T p13", 0, 0),
    ("PLT-0005 A549 p5", 2, 1),
    ("PLT-0006 CHO-K1 p8", 6, 3),
    ("PLT-0007 HeLa p23", 5, 0),
    ("PLT-0008 Jurkat p3", 8, 1),
    ("PLT-0009 A549 p6", 9, 2),
    ("PLT-0010 MDCK p17", 11, 0),
]

# Plate 1 is hand-written rather than generated so the demo reliably shows
# one well per display band. Index = (row_index * COL_COUNT + col_index);
# None means the well was never read.
PLATE_1_CURVES = [
    [12, 31, 68, 91],  # A1 -> over-confluent, needs splitting
    [10, 28, 61, 88],  # A2 -> optimal
    [14, 35, 72, 84],  # A3 -> optimal
    [8, 19, 38, 55],  # B1 -> growing
    [2, 4, 7, 11],  # B2 -> very low, seeding never took
    None,  # B3 -> no data
]


def _at(now, days_ago):
    """The 09:15 reading slot, `days_ago` days before the migration ran."""
    return (now - timedelta(days=days_ago)).replace(
        hour=9, minute=15, second=0, microsecond=0
    )


def _growth_curve(rng, age_days):
    """Confluency for every day of a well's life: slow start, then plateau.

    The plateau is per-well and below 100 so plates left for a week do not
    all read exactly 100 -- they spread across the optimal and
    over-confluent bands the way a neglected incubator shelf really does.
    """
    value = rng.randint(4, 16)
    plateau = rng.randint(78, 99)
    curve = [value]
    for _ in range(age_days):
        growth = round((plateau - value) * rng.uniform(0.35, 0.62))
        value = min(plateau, value + growth)
        curve.append(value)
    return curve


def _read_on(rng, seeded_days_ago, reading_days):
    """Which days of a plate's life were actually read.

    The most recent consecutive run of days, nudged back a little so that
    not every plate was last checked this morning.
    """
    stale = rng.randrange(3)
    last = min(seeded_days_ago, max(reading_days - 1, seeded_days_ago - stale))
    return range(last - reading_days + 1, last + 1)


def seed(apps, schema_editor):
    Plate = apps.get_model("plates", "Plate")
    Well = apps.get_model("plates", "Well")
    Measurement = apps.get_model("plates", "Measurement")

    rng = random.Random(20260811)
    now = timezone.now()

    for plate_number, (name, seeded_days_ago, reading_days) in enumerate(PLATES, 1):
        plate = Plate.objects.create(
            name=name,
            row_count=ROW_COUNT,
            col_count=COL_COUNT,
            created_at=_at(now, seeded_days_ago),
        )
        wells = Well.objects.bulk_create(
            Well(plate=plate, row_index=row, col_index=col)
            for row in range(ROW_COUNT)
            for col in range(COL_COUNT)
        )

        if reading_days == 0:
            continue

        if plate_number == 1:
            # Read every day since seeding, so day N of the curve is day N of
            # the plate's life.
            days = range(reading_days)
            curves = PLATE_1_CURVES
        else:
            days = _read_on(rng, seeded_days_ago, reading_days)
            # Every plate keeps at least one never-read well; which one moves
            # around so the UI is not always missing the same corner.
            skipped = rng.randrange(len(wells))
            curves = []
            for index in range(len(wells)):
                if index == skipped:
                    curves.append(None)
                    continue
                lifetime = _growth_curve(rng, seeded_days_ago)
                curves.append([lifetime[day] for day in days])

        measurements = []
        for well, curve in zip(wells, curves):
            if curve is None:
                continue
            for day, value in zip(days, curve):
                recorded_at = _at(now, seeded_days_ago - day)
                measurements.append(
                    Measurement(
                        well=well,
                        value=value,
                        recorded_at=recorded_at,
                        # Nothing here has been corrected, so the row was
                        # written when it was recorded and never touched again.
                        created_at=recorded_at,
                        updated_at=recorded_at,
                        deleted_at=None,
                    )
                )
        Measurement.objects.bulk_create(measurements)


def unseed(apps, schema_editor):
    Plate = apps.get_model("plates", "Plate")
    # Wells and measurements go with the plate via on_delete=CASCADE.
    Plate.objects.filter(name__in=[name for name, _, _ in PLATES]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("plates", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
