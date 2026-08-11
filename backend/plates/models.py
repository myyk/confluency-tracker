from django.db import models
from django.utils import timezone


class Plate(models.Model):
    name = models.CharField(max_length=200)
    row_count = models.PositiveSmallIntegerField()
    col_count = models.PositiveSmallIntegerField()
    # Not auto_now_add: seeded and imported plates need a real creation date,
    # not the moment the row happened to be written.
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self) -> str:
        return f"{self.name} ({self.row_count}x{self.col_count})"


class Well(models.Model):
    plate = models.ForeignKey(Plate, on_delete=models.CASCADE, related_name="wells")
    row_index = models.PositiveSmallIntegerField()
    col_index = models.PositiveSmallIntegerField()

    class Meta:
        ordering = ["row_index", "col_index"]
        constraints = [
            models.UniqueConstraint(
                fields=["plate", "row_index", "col_index"],
                name="unique_well_position_per_plate",
            )
        ]

    def __str__(self) -> str:
        return f"{self.plate.name} r{self.row_index}c{self.col_index}"


class Measurement(models.Model):
    well = models.ForeignKey(
        Well, on_delete=models.CASCADE, related_name="measurements"
    )
    value = models.IntegerField()
    recorded_at = models.DateTimeField()
    # Corrections write a new row that carries the original created_at forward,
    # so neither timestamp can be auto_now/auto_now_add.
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        # "Latest" is max(recorded_at) with id DESC as the tie-break.
        ordering = ["-recorded_at", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(value__gte=0, value__lte=100),
                name="measurement_value_between_0_and_100",
            )
        ]
        indexes = [
            models.Index(
                fields=["well", "-recorded_at", "-id"],
                name="measurement_latest_idx",
            )
        ]

    def __str__(self) -> str:
        return f"well {self.well_id} = {self.value}%"
