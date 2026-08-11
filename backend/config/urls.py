from django.urls import path

from plates.api import api

urlpatterns = [
    path("api/", api.urls),
]
