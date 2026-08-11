from ninja import NinjaAPI

api = NinjaAPI(title="Confluency Tracker API", version="1.0.0")


@api.get("/health")
def health(request):
    return {"status": "ok"}
