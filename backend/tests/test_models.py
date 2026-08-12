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
        # Scoped to the 6-well format now that 0003 seeds a 96-well plate
        # alongside them; the counts below are the 0002 seed, unchanged.
        six_well = [
            plate
            for plate in Plate.objects.filter(name__startswith="PLT-")
            if plate.row_count * plate.col_count == 6
        ]

        assert len(six_well) == 10
        assert Well.objects.filter(plate__in=six_well).count() == 60

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


class TestNinetySixWellSeed:
    """The 96-well plate from 0003, which is what the compact grid is for.

    It exists so the density rendering has something real to be judged on, so
    these assert the cases it was built to show rather than exact numbers.
    """

    @pytest.fixture
    def plate(self):
        return Plate.objects.get(name__startswith="PLT-0011")

    def latest_values(self, plate):
        return [
            (well.row_index, well.col_index, well.measurements.first())
            for well in plate.wells.all()
        ]

    def test_is_eight_by_twelve_with_ninety_six_wells(self, plate):
        assert (plate.row_count, plate.col_count) == (8, 12)
        assert plate.wells.count() == 96

    def test_has_several_days_of_history(self, plate):
        days = (
            Measurement.objects.filter(well__plate=plate)
            .dates("recorded_at", "day")
            .count()
        )

        assert days >= 3

    def test_leaves_one_whole_column_unmeasured(self, plate):
        unread = {
            well.col_index
            for well in plate.wells.annotate(n=Count("measurements")).filter(n=0)
        }

        assert len(unread) == 1
        column = unread.pop()
        assert sum(1 for w in plate.wells.all() if w.col_index == column) == 8

    def test_every_other_column_was_measured(self, plate):
        read = plate.wells.annotate(n=Count("measurements")).filter(n__gt=0)

        assert {well.col_index for well in read} == set(range(12)) - {5}

    def test_spreads_the_latest_readings_across_the_bands(self, plate):
        latest = [m for _, _, m in self.latest_values(plate) if m is not None]
        values = [m.value for m in latest]

        assert any(v < 20 for v in values), "no deliberately poor well"
        assert any(20 <= v < 60 for v in values), "nothing still growing"
        assert any(60 <= v <= 90 for v in values), "nothing ready to passage"
        assert any(v > 90 for v in values), "no over-confluent well"
