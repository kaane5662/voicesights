from fastapi import APIRouter
from routes.providers import zoom, google_meet, teams, jobs

# Combined router with prefix /providers
router = APIRouter(prefix="/providers", tags=["providers"])

router.include_router(zoom.router)
router.include_router(google_meet.router)
router.include_router(teams.router)
router.include_router(jobs.router)

__all__ = ["router", "zoom", "google_meet", "teams", "jobs"]
