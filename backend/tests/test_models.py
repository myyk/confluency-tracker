import pytest
from django.db import IntegrityError, transaction
from django.db.models import Count, Max
from django.utils import timezone

from plates.models import Measurement, Plate, Well

pytestmark = pytest.mark.django_db


@pytest.fixture
def well():
    plate = Plate.objects.create(name="test plate", row_count=2, col_count=3)
    return Well.objects.create(plate=plate, row_index=0, col_index=0)


@pytest.mark.parametrize("value", [0, 100, 42])
def test_check_constraint_accepts_values_in_range(well, value):
    measurement = Measurement.objects.create(
        well=well, value=value, recorded_at=timezone.now()
    )

    assert measurement.pk is not None


@pytest.mark.parametrize("value", [-1, 101, 1000])
def test_check_constraint_rejects_values_out_of_range(well, value):
    with pytest.raises(IntegrityError), transaction.atomic():
        Measurement.objects.create(well=well, value=value, recorded_at=timezone.now())


def test_well_position_is_unique_per_plate(well):
    with pytest.raises(IntegrityError), transaction.atomic():
        Well.objects.create(plate=well.plate, row_index=0, col_index=0)


def test_same_position_is_allowed_on_a_different_plate(well):
    other = Plate.objects.create(name="other plate", row_count=2, col_count=3)

    duplicate = Well.objects.create(plate=other, row_index=0, col_index=0)

    assert duplicate.pk is not None


def test_latest_measurement_breaks_recorded_at_ties_on_id(well):
    recorded_at = timezone.now()
    Measurement.objects.create(well=well, value=10, recorded_at=recorded_at)
    newer = Measurement.objects.create(well=well, value=20, recorded_at=recorded_at)

    assert well.measurements.first() == newer


class TestSeedMigration:
    """The demo seed ships in a migration, so it is present in the test DB too.

    These assertions are the contract the frontend is built against; they also
    stop the seed from silently rotting.
    """

    def test_seeds_ten_six_well_plates(self):
        seeded = Plate.objects.filter(name__startswith="PLT-")

        assert seeded.count() == 10
        assert all(p.row_count * p.col_count == 6 for p in seeded)
        assert Well.objects.filter(plate__in=seeded).count() == 60

    def test_every_seeded_plate_has_an_unread_well(self):
        for plate in Plate.objects.filter(name__startswith="PLT-"):
            unread = plate.wells.annotate(n=Count("measurements")).filter(n=0)

            assert unread.exists(), f"{plate.name} has no never-read well"

    def test_plate_one_has_four_days_of_history(self):
        plate = Plate.objects.get(name__startswith="PLT-0001")

        days = (
            Measurement.objects.filter(well__plate=plate)
            .dates("recorded_at", "day")
            .count()
        )
        assert days == 4

    def test_plate_two_has_a_single_day_of_history(self):
        plate = Plate.objects.get(name__startswith="PLT-0002")

        days = (
            Measurement.objects.filter(well__plate=plate)
            .dates("recorded_at", "day")
            .count()
        )
        assert days == 1

    def test_some_seeded_plates_have_no_measurements_at_all(self):
        empty = (
            Plate.objects.filter(name__startswith="PLT-")
            .annotate(last=Max("wells__measurements__recorded_at"))
            .filter(last__isnull=True)
        )

        assert empty.count() >= 1

    def test_seeded_values_are_all_within_the_valid_range(self):
        values = Measurement.objects.values_list("value", flat=True)

        assert values
        assert all(0 <= value <= 100 for value in values)
