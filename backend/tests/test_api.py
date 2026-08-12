from datetime import timedelta

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from plates.models import Measurement, Plate, Well

pytestmark = pytest.mark.django_db

# The wells endpoint costs: the plate, the wells, the windowed latest set.
WELLS_ENDPOINT_QUERIES = 3


@pytest.fixture
def make_plate():
    def _make(rows=2, cols=3, name="test plate"):
        plate = Plate.objects.create(name=name, row_count=rows, col_count=cols)
        Well.objects.bulk_create(
            Well(plate=plate, row_index=r, col_index=c)
            for r in range(rows)
            for c in range(cols)
        )
        return plate

    return _make


@pytest.fixture
def plate(make_plate):
    return make_plate()


@pytest.fixture
def well(plate):
    return plate.wells.first()


def measure(well, value, recorded_at=None, **kwargs):
    return Measurement.objects.create(
        well=well, value=value, recorded_at=recorded_at or timezone.now(), **kwargs
    )


class TestListPlates:
    def test_returns_dims_well_count_and_last_reading(self, client, plate, well):
        recorded_at = timezone.now()
        measure(well, 42, recorded_at)

        body = client.get("/api/plates").json()

        row = next(p for p in body if p["id"] == plate.id)
        assert row["name"] == "test plate"
        assert (row["row_count"], row["col_count"]) == (2, 3)
        assert row["well_count"] == 6
        assert row["last_reading_at"] is not None

    def test_last_reading_is_null_for_an_unmeasured_plate(self, client, plate):
        body = client.get("/api/plates").json()

        row = next(p for p in body if p["id"] == plate.id)
        assert row["last_reading_at"] is None

    def test_last_reading_ignores_deleted_measurements(self, client, plate, well):
        measure(well, 42, deleted_at=timezone.now())

        body = client.get("/api/plates").json()

        row = next(p for p in body if p["id"] == plate.id)
        assert row["last_reading_at"] is None

    def test_last_reading_follows_a_correction_onto_an_earlier_day(
        self, client, plate, well
    ):
        now = timezone.now()
        mistake = measure(well, 91, now)
        corrected_to = now - timedelta(days=2)

        client.patch(
            f"/api/measurements/{mistake.id}",
            {"value": 50, "recorded_at": corrected_to.isoformat()},
            content_type="application/json",
        )

        body = client.get("/api/plates").json()

        row = next(p for p in body if p["id"] == plate.id)
        assert row["last_reading_at"].startswith(
            corrected_to.strftime("%Y-%m-%dT%H:%M")
        )

    def test_well_count_is_not_inflated_by_measurements(self, client, plate, well):
        for day in range(5):
            measure(well, 20, timezone.now() - timedelta(days=day))

        body = client.get("/api/plates").json()

        assert next(p for p in body if p["id"] == plate.id)["well_count"] == 6

    def test_is_a_single_query(self, client, django_assert_num_queries):
        with django_assert_num_queries(1):
            client.get("/api/plates")


class TestGetPlate:
    def test_returns_the_plate_with_dims(self, client, plate):
        body = client.get(f"/api/plates/{plate.id}").json()

        assert body["id"] == plate.id
        assert (body["row_count"], body["col_count"]) == (2, 3)

    def test_unknown_plate_is_404(self, client):
        assert client.get("/api/plates/999999").status_code == 404


class TestPlateWells:
    def test_includes_wells_that_have_never_been_measured(self, client, plate, well):
        measure(well, 42)

        body = client.get(f"/api/plates/{plate.id}/wells").json()

        assert len(body) == 6
        assert sum(w["latest"] is None for w in body) == 5
        measured = next(w for w in body if w["id"] == well.id)
        assert measured["latest"]["value"] == 42

    def test_latest_is_null_when_the_plate_has_no_readings(self, client, plate):
        body = client.get(f"/api/plates/{plate.id}/wells").json()

        assert len(body) == 6
        assert all(w["latest"] is None for w in body)

    def test_latest_is_the_newest_recorded_at(self, client, plate, well):
        now = timezone.now()
        measure(well, 10, now - timedelta(days=2))
        measure(well, 80, now)
        measure(well, 45, now - timedelta(days=1))

        body = client.get(f"/api/plates/{plate.id}/wells").json()

        assert next(w for w in body if w["id"] == well.id)["latest"]["value"] == 80

    def test_a_correction_wins_the_recorded_at_tie_on_id(self, client, plate, well):
        """The whole reason the window orders by id DESC as well."""
        recorded_at = timezone.now()
        measure(well, 55, recorded_at)
        correction = measure(well, 72, recorded_at)

        body = client.get(f"/api/plates/{plate.id}/wells").json()

        latest = next(w for w in body if w["id"] == well.id)["latest"]
        assert latest["value"] == 72
        assert latest["id"] == correction.id

    def test_a_correction_that_moves_recorded_at_earlier_is_still_the_latest(
        self, client, plate, well
    ):
        """recorded_at DESC alone cannot resolve this: the row being corrected
        sorts above its own correction until the superseded row is dropped."""
        now = timezone.now()
        mistake = measure(well, 91, now)

        client.patch(
            f"/api/measurements/{mistake.id}",
            {"value": 50, "recorded_at": (now - timedelta(days=2)).isoformat()},
            content_type="application/json",
        )

        body = client.get(f"/api/plates/{plate.id}/wells").json()

        assert next(w for w in body if w["id"] == well.id)["latest"]["value"] == 50

    def test_correcting_the_latest_reading_changes_what_the_plate_returns(
        self, client, plate, well
    ):
        now = timezone.now()
        measure(well, 10, now - timedelta(days=1))
        newest = measure(well, 80, now)

        client.patch(
            f"/api/measurements/{newest.id}",
            {"value": 86},
            content_type="application/json",
        )

        body = client.get(f"/api/plates/{plate.id}/wells").json()

        assert next(w for w in body if w["id"] == well.id)["latest"]["value"] == 86

    def test_correcting_a_stale_reading_does_not_make_it_the_latest(
        self, client, plate, well
    ):
        """Fixing a typo in an old reading must not promote it over newer ones."""
        now = timezone.now()
        old = measure(well, 10, now - timedelta(days=3))
        measure(well, 80, now)

        client.patch(
            f"/api/measurements/{old.id}",
            {"value": 14},
            content_type="application/json",
        )

        body = client.get(f"/api/plates/{plate.id}/wells").json()

        assert next(w for w in body if w["id"] == well.id)["latest"]["value"] == 80

    def test_deleted_measurements_are_not_the_latest(self, client, plate, well):
        now = timezone.now()
        measure(well, 30, now - timedelta(days=1))
        measure(well, 90, now, deleted_at=now)

        body = client.get(f"/api/plates/{plate.id}/wells").json()

        assert next(w for w in body if w["id"] == well.id)["latest"]["value"] == 30

    def test_a_well_whose_only_reading_was_deleted_is_null(self, client, plate, well):
        measure(well, 90, deleted_at=timezone.now())

        body = client.get(f"/api/plates/{plate.id}/wells").json()

        assert next(w for w in body if w["id"] == well.id)["latest"] is None

    def test_wells_of_other_plates_are_not_included(self, client, make_plate):
        plate = make_plate(name="mine")
        make_plate(name="theirs")

        body = client.get(f"/api/plates/{plate.id}/wells").json()

        assert {w["id"] for w in body} == set(plate.wells.values_list("id", flat=True))

    def test_unknown_plate_is_404(self, client):
        assert client.get("/api/plates/999999/wells").status_code == 404

    def test_query_count_is_fixed(self, client, plate, django_assert_num_queries):
        for well in plate.wells.all():
            measure(well, 50)

        with django_assert_num_queries(WELLS_ENDPOINT_QUERIES):
            client.get(f"/api/plates/{plate.id}/wells")

    def test_query_count_does_not_grow_with_the_plate(self, client, make_plate, capsys):
        """A 96-well plate with 8 readings each costs the same as a 6-well one.

        This is the O(1) claim, measured rather than asserted: 6 wells / 6
        measurements versus 96 wells / 768 measurements.
        """
        counts = {}
        for rows, cols, days in [(2, 3, 1), (8, 12, 8)]:
            plate = make_plate(rows, cols, name=f"{rows}x{cols}")
            now = timezone.now()
            Measurement.objects.bulk_create(
                Measurement(
                    well=well,
                    value=day * 10,
                    recorded_at=now - timedelta(days=day),
                )
                for well in plate.wells.all()
                for day in range(days)
            )

            with CaptureQueriesContext(connection) as captured:
                response = client.get(f"/api/plates/{plate.id}/wells")

            assert response.status_code == 200
            assert len(response.json()) == rows * cols
            counts[f"{rows}x{cols}"] = len(captured)

        with capsys.disabled():
            print(f"\n  plate/wells query counts: {counts}")

        assert set(counts.values()) == {WELLS_ENDPOINT_QUERIES}


class TestWellHistory:
    def test_returns_full_history_newest_first(self, client, plate, well):
        now = timezone.now()
        measure(well, 10, now - timedelta(days=2))
        measure(well, 45, now - timedelta(days=1))
        measure(well, 80, now)

        body = client.get(f"/api/plates/{plate.id}/wells/{well.id}/measurements").json()

        assert [m["value"] for m in body] == [80, 45, 10]

    def test_excludes_deleted_measurements(self, client, plate, well):
        measure(well, 10)
        measure(well, 99, deleted_at=timezone.now())

        body = client.get(f"/api/plates/{plate.id}/wells/{well.id}/measurements").json()

        assert [m["value"] for m in body] == [10]

    def test_correcting_an_earlier_reading_replaces_it_in_the_timeline(
        self, client, plate, well
    ):
        """The middle reading of three is corrected through the API.

        The corrected value has to land in the middle of the timeline, where
        the reading it corrects sat, and the superseded value must be gone.
        """
        now = timezone.now()
        measure(well, 10, now - timedelta(days=2))
        middle = measure(well, 45, now - timedelta(days=1))
        measure(well, 80, now)

        client.patch(
            f"/api/measurements/{middle.id}",
            {"value": 52},
            content_type="application/json",
        )

        body = client.get(f"/api/plates/{plate.id}/wells/{well.id}/measurements").json()

        assert [m["value"] for m in body] == [80, 52, 10]
        assert 45 not in [m["value"] for m in body]

    def test_the_superseded_row_is_still_on_disk(self, client, plate, well):
        """Hidden from the API, not destroyed -- the history stays append-only."""
        original = measure(well, 45)

        client.patch(
            f"/api/measurements/{original.id}",
            {"value": 52},
            content_type="application/json",
        )

        body = client.get(f"/api/plates/{plate.id}/wells/{well.id}/measurements").json()

        assert [m["value"] for m in body] == [52]
        assert well.measurements.count() == 2

    def test_a_correction_of_a_correction_shows_only_the_newest(
        self, client, plate, well
    ):
        original = measure(well, 45)

        first = client.patch(
            f"/api/measurements/{original.id}",
            {"value": 52},
            content_type="application/json",
        ).json()
        client.patch(
            f"/api/measurements/{first['id']}",
            {"value": 61},
            content_type="application/json",
        )

        body = client.get(f"/api/plates/{plate.id}/wells/{well.id}/measurements").json()

        assert [m["value"] for m in body] == [61]

    def test_a_correction_can_move_the_reading_in_the_timeline(
        self, client, plate, well
    ):
        """A reading logged on the wrong day is corrected onto the right one."""
        now = timezone.now()
        measure(well, 10, now - timedelta(days=3))
        measure(well, 80, now - timedelta(days=1))
        misdated = measure(well, 45, now)

        client.patch(
            f"/api/measurements/{misdated.id}",
            {
                "value": 45,
                "recorded_at": (now - timedelta(days=2)).isoformat(),
            },
            content_type="application/json",
        )

        body = client.get(f"/api/plates/{plate.id}/wells/{well.id}/measurements").json()

        assert [m["value"] for m in body] == [80, 45, 10]

    def test_unknown_well_is_404(self, client, plate):
        url = f"/api/plates/{plate.id}/wells/999999/measurements"

        assert client.get(url).status_code == 404

    def test_well_on_another_plate_is_404(self, client, make_plate):
        plate = make_plate(name="mine")
        stranger = make_plate(name="theirs").wells.first()

        url = f"/api/plates/{plate.id}/wells/{stranger.id}/measurements"

        assert client.get(url).status_code == 404


class TestCreateMeasurement:
    def url(self, well):
        return f"/api/plates/{well.plate_id}/wells/{well.id}/measurements"

    def test_creates_a_measurement(self, client, well):
        response = client.post(
            self.url(well), {"value": 65}, content_type="application/json"
        )

        assert response.status_code == 201
        body = response.json()
        assert body["value"] == 65
        assert body["created_at"] == body["updated_at"]
        assert Measurement.objects.filter(id=body["id"]).exists()

    def test_a_recorded_measurement_can_be_read_back(self, client, plate, well):
        """The round trip: record one, then find it through both read paths."""
        created = client.post(
            self.url(well), {"value": 65}, content_type="application/json"
        ).json()

        history = client.get(self.url(well)).json()
        assert [m["id"] for m in history] == [created["id"]]
        assert history[0]["value"] == 65

        wells = client.get(f"/api/plates/{plate.id}/wells").json()
        latest = next(w for w in wells if w["id"] == well.id)["latest"]
        assert latest["id"] == created["id"]
        assert latest["value"] == 65

    def test_recorded_at_defaults_to_now(self, client, well):
        response = client.post(
            self.url(well), {"value": 65}, content_type="application/json"
        )

        assert response.json()["recorded_at"] is not None

    def test_recorded_at_can_be_backdated(self, client, well):
        recorded_at = timezone.now() - timedelta(days=3)

        response = client.post(
            self.url(well),
            {"value": 65, "recorded_at": recorded_at.isoformat()},
            content_type="application/json",
        )

        assert response.json()["recorded_at"].startswith(
            recorded_at.strftime("%Y-%m-%dT%H:%M")
        )

    @pytest.mark.parametrize("value", [-1, 101, 1000])
    def test_value_outside_the_range_is_422(self, client, well, value):
        response = client.post(
            self.url(well), {"value": value}, content_type="application/json"
        )

        assert response.status_code == 422

    @pytest.mark.parametrize("value", [0, 100])
    def test_the_range_is_inclusive(self, client, well, value):
        response = client.post(
            self.url(well), {"value": value}, content_type="application/json"
        )

        assert response.status_code == 201

    def test_unknown_well_is_404(self, client, plate):
        response = client.post(
            f"/api/plates/{plate.id}/wells/999999/measurements",
            {"value": 65},
            content_type="application/json",
        )

        assert response.status_code == 404


class TestCorrectMeasurement:
    def test_appends_a_new_row_instead_of_editing(self, client, well):
        original = measure(well, 55)

        body = client.patch(
            f"/api/measurements/{original.id}",
            {"value": 72},
            content_type="application/json",
        ).json()

        assert body["id"] != original.id
        original.refresh_from_db()
        assert original.value == 55
        assert well.measurements.count() == 2

    def test_retires_the_row_it_supersedes(self, client, well):
        original = measure(well, 55)

        client.patch(
            f"/api/measurements/{original.id}",
            {"value": 72},
            content_type="application/json",
        )

        original.refresh_from_db()
        assert original.deleted_at is not None
        # Retired, not rewritten: the old value stays on disk to be read back.
        assert original.value == 55

    def test_keeps_created_at_and_moves_updated_at(self, client, well):
        original = measure(well, 55, created_at=timezone.now() - timedelta(days=5))

        body = client.patch(
            f"/api/measurements/{original.id}",
            {"value": 72},
            content_type="application/json",
        ).json()

        correction = Measurement.objects.get(id=body["id"])
        assert correction.created_at == original.created_at
        assert correction.updated_at > original.updated_at

    def test_inherits_recorded_at_when_not_given(self, client, well):
        recorded_at = timezone.now() - timedelta(days=2)
        original = measure(well, 55, recorded_at)

        body = client.patch(
            f"/api/measurements/{original.id}",
            {"value": 72},
            content_type="application/json",
        ).json()

        assert Measurement.objects.get(id=body["id"]).recorded_at == recorded_at

    @pytest.mark.parametrize("value", [-1, 101])
    def test_value_outside_the_range_is_422(self, client, well, value):
        original = measure(well, 55)

        response = client.patch(
            f"/api/measurements/{original.id}",
            {"value": value},
            content_type="application/json",
        )

        assert response.status_code == 422

    def test_unknown_measurement_is_404(self, client):
        response = client.patch(
            "/api/measurements/999999", {"value": 72}, content_type="application/json"
        )

        assert response.status_code == 404

    def test_deleted_measurement_is_404(self, client, well):
        deleted = measure(well, 55, deleted_at=timezone.now())

        response = client.patch(
            f"/api/measurements/{deleted.id}",
            {"value": 72},
            content_type="application/json",
        )

        assert response.status_code == 404


class TestCorrectThenDelete:
    """Correct a reading, then delete it. The old value must not come back.

    This is the one that got away. `in_force` hides a superseded row by
    out-ranking it, and out-ranking is relative: take the winner away and the
    row it beat is simply the best remaining candidate. So a reading that was
    corrected 40 -> 72 and then deleted came back as 40 -- not in some
    unreachable audit table, but in the well history and on the plate grid,
    wearing a value the user had already replaced and then thrown away.

    Nothing failed at the time. The correction tests passed, because the
    correction was right. The delete tests passed, because the delete was
    right. Only the pair was wrong, so the pair is what these cover.
    """

    def history(self, client, plate, well):
        body = client.get(f"/api/plates/{plate.id}/wells/{well.id}/measurements").json()
        return [row["value"] for row in body]

    def latest(self, client, plate, well):
        body = client.get(f"/api/plates/{plate.id}/wells").json()
        return next(w for w in body if w["id"] == well.id)["latest"]

    def correct(self, client, measurement_id, value):
        return client.patch(
            f"/api/measurements/{measurement_id}",
            {"value": value},
            content_type="application/json",
        ).json()

    def test_deleting_a_corrected_reading_does_not_resurrect_the_old_value(
        self, client, plate, well
    ):
        original = measure(well, 40)
        correction = self.correct(client, original.id, 72)

        assert client.delete(f"/api/measurements/{correction['id']}").status_code == 204

        assert self.history(client, plate, well) == []
        assert self.latest(client, plate, well) is None

    def test_every_version_of_the_reading_is_stamped_deleted(self, client, plate, well):
        original = measure(well, 40)
        correction = self.correct(client, original.id, 72)
        client.delete(f"/api/measurements/{correction['id']}")

        rows = Measurement.objects.filter(well=well)
        assert rows.count() == 2, "both versions should still be on disk"
        assert all(row.deleted_at is not None for row in rows)

    def test_it_falls_back_to_an_earlier_reading_not_to_the_old_version(
        self, client, plate, well
    ):
        """The dangerous near-miss: something is left to promote.

        An empty history makes a resurrection obvious. Here the well has a
        genuine earlier reading, so the grid shows *a* number either way --
        and the wrong one, 40, is a plausible-looking confluency.
        """
        now = timezone.now()
        measure(well, 15, now - timedelta(days=2))
        newer = measure(well, 40, now)
        correction = self.correct(client, newer.id, 72)

        client.delete(f"/api/measurements/{correction['id']}")

        assert self.history(client, plate, well) == [15]
        assert self.latest(client, plate, well)["value"] == 15

    def test_a_chain_of_corrections_leaves_together(self, client, plate, well):
        original = measure(well, 40)
        first = self.correct(client, original.id, 60)
        second = self.correct(client, first["id"], 72)

        client.delete(f"/api/measurements/{second['id']}")

        assert self.history(client, plate, well) == []
        live = Measurement.objects.filter(well=well, deleted_at__isnull=True)
        assert live.count() == 0

    def test_deleting_a_superseded_row_directly_is_404(self, client, well):
        """The old row is gone as far as the API is concerned, so it cannot be
        deleted twice, and a client holding a stale id gets told so."""
        original = measure(well, 40)
        self.correct(client, original.id, 72)

        assert client.delete(f"/api/measurements/{original.id}").status_code == 404

    def test_a_correction_still_shows_once_while_it_is_alive(self, client, plate, well):
        """The retirement must not take the live version with it."""
        original = measure(well, 40)
        self.correct(client, original.id, 72)

        assert self.history(client, plate, well) == [72]
        assert self.latest(client, plate, well)["value"] == 72


class TestDeleteMeasurement:
    def test_soft_deletes_and_returns_204(self, client, well):
        measurement = measure(well, 55)

        response = client.delete(f"/api/measurements/{measurement.id}")

        assert response.status_code == 204
        measurement.refresh_from_db()
        assert measurement.deleted_at is not None

    def test_unknown_measurement_is_404(self, client):
        assert client.delete("/api/measurements/999999").status_code == 404

    def test_deleting_twice_is_404(self, client, well):
        measurement = measure(well, 55)
        client.delete(f"/api/measurements/{measurement.id}")

        assert client.delete(f"/api/measurements/{measurement.id}").status_code == 404


class TestDeleteMeasurementMovesTheGrid:
    """What the plate endpoint says after a delete.

    The read path already excludes soft-deleted rows, but the grid is what the
    user is looking at when they delete, so these go through the endpoint end
    to end rather than asserting on `deleted_at`.
    """

    def latest_for(self, client, plate, well):
        body = client.get(f"/api/plates/{plate.id}/wells").json()
        return next(w for w in body if w["id"] == well.id)["latest"]

    def test_deleting_the_latest_promotes_the_one_before_it(self, client, plate, well):
        now = timezone.now()
        older = measure(well, 40, now - timedelta(days=1))
        newest = measure(well, 80, now)

        assert client.delete(f"/api/measurements/{newest.id}").status_code == 204

        latest = self.latest_for(client, plate, well)
        assert latest["id"] == older.id
        assert latest["value"] == 40

    def test_deleting_a_non_latest_leaves_the_latest_alone(self, client, plate, well):
        now = timezone.now()
        older = measure(well, 40, now - timedelta(days=1))
        newest = measure(well, 80, now)

        assert client.delete(f"/api/measurements/{older.id}").status_code == 204

        latest = self.latest_for(client, plate, well)
        assert latest["id"] == newest.id
        assert latest["value"] == 80

    def test_deleting_the_only_reading_returns_the_well_to_no_data(
        self, client, plate, well
    ):
        only = measure(well, 55)

        assert client.delete(f"/api/measurements/{only.id}").status_code == 204

        assert self.latest_for(client, plate, well) is None

    def test_the_deleted_reading_leaves_the_history_too(self, client, plate, well):
        now = timezone.now()
        measure(well, 40, now - timedelta(days=1))
        newest = measure(well, 80, now)

        client.delete(f"/api/measurements/{newest.id}")

        history = client.get(
            f"/api/plates/{plate.id}/wells/{well.id}/measurements"
        ).json()
        assert [row["value"] for row in history] == [40]
