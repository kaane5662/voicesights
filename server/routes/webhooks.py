from fastapi import APIRouter

from const import get_subscription_by_price_id


router = APIRouter(prefix="/webhooks", tags=["webhooks"])

# INSERT_YOUR_CODE
from fastapi import Request, status
from fastapi.responses import JSONResponse
from models import Profile
import os
import stripe

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")

@router.post("/stripe")
async def stripe_webhook(request: Request):
    # Get signature and payload
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
    event = None

    # Verify signature
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except ValueError:
        # Invalid payload
        return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={"error": "Invalid payload"})
    except stripe.error.SignatureVerificationError:
        # Invalid signature
        return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={"error": "Invalid signature"})

    # Handle checkout.session.completed
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        metadata = session.get("metadata", {})
        user_id = metadata.get("user_id")
        customer_id = session.get("customer") or session.get("customer_id")
        # You might want to check payment_status as well

        # Stripe webhooks do NOT include line_items by default! Fetch them explicitly:
        price_id = None
        try:
            line_items = stripe.checkout.Session.list_line_items(session["id"])
            if line_items and line_items["data"]:
                price_id = line_items["data"][0]["price"]["id"]
        except Exception as e:
            return JSONResponse(
                status_code=500,
                content={"error": f"Could not fetch line items: {str(e)}"}
            )
        if not price_id:
            return JSONResponse(
                status_code=400,
                content={"error": "No price_id found in line items"}
            )

        entry, annual = get_subscription_by_price_id(price_id)
        if user_id and customer_id:
            profile = Profile.objects(id=user_id).first()
            if profile:
                profile.stripe_customer_id = customer_id
                profile.plan = entry['plan']
                profile.annual = annual
                profile.save()
            else:
                return JSONResponse(status_code=404, content={"error": "Profile not found"})
        else:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"error": "user_id or customer_id missing in metadata/session"}
            )
    # INSERT_YOUR_CODE
    # Handle subscription events: updated, canceled, deleted, renewed

    elif event["type"] == "customer.subscription.updated":
        subscription = event["data"]["object"]
        customer_id = subscription.get("customer")
        status_ = subscription.get("status")
        # plan_id = subscription.get("plan", {}).get("id")
        # Get price ID from subscription ID via Stripe API
        subscription_id = subscription.get("id")
        price_id = None
        if subscription_id:
            try:
                stripe_subscription = stripe.Subscription.retrieve(subscription_id)
                if stripe_subscription["items"]["data"]:
                    price_id = stripe_subscription["items"]["data"][0]["price"]["id"]
            except Exception as e:
                return JSONResponse(
                    status_code=500,
                    content={"error": f"Could not fetch subscription from Stripe: {str(e)}"}
                )
        # Find profile by stripe_customer_id
        entry, annual = get_subscription_by_price_id(price_id)
        profile = Profile.objects(stripe_customer_id=customer_id).first()
        if profile:
            profile.plan = entry['plan']
            profile.annual = annual
            profile.subscription_status = "active"
            profile.save()

    elif event["type"] in set([
        "customer.subscription.deleted",
        "customer.subscription.canceled",
        "customer.subscription.expired",
        # Stripe doesn't explicitly have "renewed", but renewal is a status update to active
    ]):
        subscription = event["data"]["object"]
        customer_id = subscription.get("customer")
        profile = Profile.objects(stripe_customer_id=customer_id).first()
        if profile:
            profile.annual = False
            # Optionally clear plan or set to 'free'
            profile.plan = "free"
            profile.subscription_status = "canceled"
            profile.save()

    elif event["type"] == "invoice.payment_succeeded":
        # This triggers when the payment for an invoice succeeds (subscription created or renewed)
        invoice = event["data"]["object"]
        customer_id = invoice.get("customer")
        # Get subscription id and price information
        subscription_id = invoice.get("subscription")
        line_items = invoice.get("lines", {}).get("data", [])
        # Typically, the first line is the subscription plan purchased
        if line_items:
            price_id = line_items[0].get("price", {}).get("id")
        else:
            price_id = None

        entry, annual = get_subscription_by_price_id(price_id)
        profile = Profile.objects(stripe_customer_id=customer_id).first()
        if profile and entry:
            profile.subscription_status = "active"
            profile.plan = entry["plan"]
            profile.annual = annual
            
            profile.save()

    # Optionally handle other events as needed

    return JSONResponse(status_code=200, content={"status": "success"})
