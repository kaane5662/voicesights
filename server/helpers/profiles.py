import datetime

from models import Profile
from fastapi.responses import JSONResponse

def check_rate_limit(user_obj: Profile):
    """
    Enforces API rate limits per user and plan.
    - Free plan: max 20 requests, period does not reset.
    - Paid plan: max 20 requests per rolling 1 minute.
    Returns None if allowed, otherwise returns JSONResponse error.
    """
    now = datetime.datetime.utcnow()
    if user_obj.plan == "free":
        if user_obj.rate_limit_remaining is not None and user_obj.rate_limit_remaining <= 0:
            return JSONResponse(
                status_code=429,
                content={"error": "Request limit reached: upgrade your plan to continue."}
            )
        # Decrement on successful pass (should be called AFTER check in endpoint)
        # user_obj.rate_limit_remaining -= 1
        # user_obj.save()
        return None
    else:
        # Paid: 20 req/min (rolling)
        last_reset = user_obj.rate_limit_last
        if not last_reset or (now - last_reset).total_seconds() > 60:
            # Reset window
            user_obj.rate_limit_remaining = 19  # counting THIS request
            user_obj.rate_limit_last = now
            user_obj.save()
            return None
        else:
            if user_obj.rate_limit_remaining is not None and user_obj.rate_limit_remaining <= 0:
                retry_after = 60 - int((now - last_reset).total_seconds())
                return JSONResponse(
                    status_code=429,
                    content={"error": f"Rate limit exceeded. Try again in {retry_after} seconds."}
                )
            # Within window, decrement
            user_obj.rate_limit_remaining -= 1
            user_obj.save()
            return None

