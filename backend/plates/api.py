from django.db import transaction
from django.db.models import Count, F, OuterRef, Q, Subquery, Window
from django.db.models.functions import RowNumber
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import NinjaAPI, Status

from plates.models import Measurement, Plate, Well
from plates.schemas import (
    MeasurementIn,
    MeasurementOut,
    PlateListOut,
    PlateOut,
    WellOut,
)

api = NinjaAPI(title="Confluency Tracker API", version="1.0.0")

# A measurement is live until it is soft-deleted. Every read path filters on
# this; history included, so a deleted reading disappears from the UI while
# staying on disk.
LIVE = Q(deleted_at__isnull=True)


@api.get("/health")
def health(request):
    return {"status": "ok"}


@api.get("/plates", response=list[PlateListOut])
def list_plates(request):
    return Plate.objects.annotate(
        well_count=Count("wells"),
        last_reading_at=Subquery(
            in_force(Measurement.objects.filter(well__plate=OuterRef("pk")))
            .order_by("-recorded_at", "-id")
            .values("recorded_at")[:1]
        ),
    )


@api.get("/plates/{plate_id}", response=PlateOut)
def get_plate(request, plate_id: int):
    return get_object_or_404(Plate, id=plate_id)


def in_force(measurements):
    """Collapse each reading to the single version that currently applies.

    A correction is appended as a new row that carries the corrected row's
    created_at forward, so (well_id, created_at) identifies one reading
    across every correction of it, and updated_at says which version won.

    Since corrections retire the row they supersede, each partition should
    now hold exactly one live row and this window has nothing left to
    choose between. It stays as the backstop for the two cases where that is
    not true: rows corrected before the retirement existed, which are still
    on disk with no deleted_at, and any future write that appends a version
    without retiring its predecessor.

    Ordering by updated_at rather than id because id only agrees with write
    order by accident; updated_at is the field the correction actually
    stamps. id stays as the tie-break for rows written in the same tick.
    """
    return (
        measurements.filter(LIVE)
        .annotate(
            version=Window(
                expression=RowNumber(),
                partition_by=[F("well_id"), F("created_at")],
                order_by=[F("updated_at").desc(), F("id").desc()],
            )
        )
        .filter(version=1)
    )


def latest_measurement_per_well(plate_id: int):
    """The current reading for each well on a plate, in one query.

    Two windows, and the order matters: collapse corrections first, then rank
    what survives by recorded_at. Ranking first would let a reading that has
    since been corrected onto an earlier day keep winning, because the stale
    row still carries the newer recorded_at.

    They have to be separate query levels. Annotating both on one queryset
    lets Django compute them side by side in a single SELECT, so the second
    window would rank the superseded rows it is supposed to have dropped --
    feeding the first through `id__in` forces it to resolve first.
    """
    in_force_ids = in_force(Measurement.objects.filter(well__plate_id=plate_id)).values(
        "id"
    )

    return (
        Measurement.objects.filter(id__in=Subquery(in_force_ids))
        .annotate(
            position=Window(
                expression=RowNumber(),
                partition_by=F("well_id"),
                order_by=[F("recorded_at").desc(), F("id").desc()],
            )
        )
        .filter(position=1)
    )


@api.get("/plates/{plate_id}/wells", response=list[WellOut])
def list_plate_wells(request, plate_id: int):
    """Every well on the plate, with its latest reading or null.

    Three queries regardless of how many wells the plate has: the plate, the
    wells, and the windowed latest-measurement set. Attaching in Python is
    what keeps never-measured wells in the response -- they simply miss the
    dict lookup and come back as null.
    """
    plate = get_object_or_404(Plate, id=plate_id)
    latest = {m.well_id: m for m in latest_measurement_per_well(plate.id)}

    wells = list(plate.wells.all())
    for well in wells:
        well.latest = latest.get(well.id)
    return wells


@api.get(
    "/plates/{plate_id}/wells/{well_id}/measurements", response=list[MeasurementOut]
)
def list_well_measurements(request, plate_id: int, well_id: int):
    """One entry per reading, newest first -- corrections replace in place.

    A corrected reading appears once, at the point in the timeline its
    recorded_at puts it, carrying the corrected value. The row it superseded
    stays on disk but never surfaces here.
    """
    well = get_object_or_404(Well, id=well_id, plate_id=plate_id)
    return in_force(well.measurements.all()).order_by("-recorded_at", "-id")


@api.post(
    "/plates/{plate_id}/wells/{well_id}/measurements",
    response={201: MeasurementOut},
)
def create_measurement(request, plate_id: int, well_id: int, payload: MeasurementIn):
    well = get_object_or_404(Well, id=well_id, plate_id=plate_id)

    now = timezone.now()
    measurement = Measurement.objects.create(
        well=well,
        value=payload.value,
        recorded_at=payload.recorded_at or now,
        created_at=now,
        updated_at=now,
    )
    return Status(201, measurement)


@api.patch("/measurements/{measurement_id}", response=MeasurementOut)
def correct_measurement(request, measurement_id: int, payload: MeasurementIn):
    """Corrections are appends, not edits.

    The table is append-only, so a correction writes a new row that carries
    the original's created_at forward and stamps updated_at now. That shared
    created_at is what lets `in_force` recognise the two rows as one reading
    and serve only this one; the superseded row stays on disk unread.

    It is also retired -- deleted_at stamped, same as a delete -- and that is
    load-bearing rather than tidiness. Out-ranking is relative: `in_force`
    hides the old row only while the new one is there to out-rank it. Delete
    the correction and the row it replaced is the best remaining candidate,
    so a reading the user deleted comes back wearing its pre-correction
    value. Retiring it makes the whole reading, every version of it, leave
    together.
    """
    original = get_object_or_404(Measurement, LIVE, id=measurement_id)

    now = timezone.now()
    # Both writes or neither: a replacement without the retirement is the bug
    # above, and a retirement without the replacement loses the reading.
    with transaction.atomic():
        replacement = Measurement.objects.create(
            well_id=original.well_id,
            value=payload.value,
            recorded_at=payload.recorded_at or original.recorded_at,
            created_at=original.created_at,
            updated_at=now,
        )
        original.deleted_at = now
        original.updated_at = now
        original.save(update_fields=["deleted_at", "updated_at"])

    return replacement


@api.delete("/measurements/{measurement_id}", response={204: None})
def delete_measurement(request, measurement_id: int):
    measurement = get_object_or_404(Measurement, LIVE, id=measurement_id)

    measurement.deleted_at = timezone.now()
    measurement.updated_at = measurement.deleted_at
    measurement.save(update_fields=["deleted_at", "updated_at"])
    return Status(204, None)
