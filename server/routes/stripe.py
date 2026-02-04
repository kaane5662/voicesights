from fastapi import APIRouter, Body, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import stripe
import os

from const import SUBSCRIPTIONS
from helpers.auth import login_required
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")

router = APIRouter(prefix="/stripe", tags=["stripe"])

class StripePurchase(BaseModel):
    plan: str
    annual: bool

@router.post("/checkout")
@login_required
async def create_checkout_session(data: StripePurchase,request:Request, user_id=None):
    """
    Create a Stripe Checkout Session for a user.
    """
    # Validate user_id and map requested plan to Stripe price IDs using the schema from const.py
    # SUBSCRIPTIONS is a list of dicts, each with a 'plan' field and 'prices' (list of dicts with 'annual' and 'price_id')
    subscription = next((sub for sub in SUBSCRIPTIONS if sub.get("plan") == data.plan), None)
    if not subscription:
        return JSONResponse(status_code=400, content={"error": "Subscription not found"})

    prices = subscription.get("prices", [])
    if not isinstance(prices, list):
        return JSONResponse(status_code=400, content={"error": "Invalid price structure for this plan"})

    selected_price = next((p for p in prices if p.get("annual") == data.annual and p.get("price_id")), None)
    if not selected_price:
        return JSONResponse(status_code=400, content={"error": "No matching price for this plan/period"})

    # Choose the correct price ID for Stripe
    price_id = selected_price.get("price_id")
        

    if not price_id:
        return JSONResponse(status_code=400, content={"error": "Price ID not found"})
    frontend_url = os.environ.get("CLIENT_DOMAIN", "http://localhost:3000")
    try:
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            mode="subscription",
            line_items=[
                {"price": price_id, "quantity": 1}
            ],
            success_url=f"{frontend_url}/profile/billing?success=true",
            cancel_url=f"{frontend_url}/profile/billing?canceled=true",
            metadata={"user_id": user_id, "price": price_id},
        )
        return {"checkout_url": checkout_session.url}
    except Exception as e:
        return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content={"error": str(e)})

@router.post("/billing-portal")
async def create_billing_portal_session(request: Request, customer_id: str = Body(...)):
    """
    Create a Stripe Billing Portal session for a user.
    Customer_id is the Stripe customer ID.
    """
    frontend_url = os.environ.get("CLIENT_DOMAIN", "http://localhost:3000")
    try:
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=f"{frontend_url}/profile/billing",
        )
        return {"billing_portal_url": session.url}
    except Exception as e:
        return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content={"error": str(e)})

