# INSERT_YOUR_CODE

# Mapping of subscription label to Stripe price IDs.
# Update the values according to your Stripe dashboard.
SUBSCRIPTIONS = [
    
    {
        "credits": 100,
        'plan': "premium",
        "features": [
            "Basic support",
            "Limited usage",
            "Single user",
        ],
        "stripeId": "",  # optionally plan group/alias
        "prices": [
            {"price_id": "price_1SpsZwDnO0mBP8U42b3D8W7R", "price": 1000, 'annual':False},
            {"price_id": "price_1Sptl6DnO0mBP8U4FHH3ZnJ1", "price": 10000, 'annual':True},    
        ],
    }
    ,
    
]


# INSERT_YOUR_CODE

def get_subscription_by_plan(plan):
    """Return the subscription entry dict for a given plan, or None if not found."""
    for entry in SUBSCRIPTIONS:
        if entry.get("plan") == plan:
            return entry
    return None

def get_subscription_by_price_id(price_id):
    """
    Return the subscription entry dict for a given Stripe price_id, searching
    through all prices/variants for all plans. Returns None if not found.
    """
    for entry in SUBSCRIPTIONS:
        for price in entry.get("prices", []):
            if price.get("price_id") == price_id:
                return entry, price.get('annual', False)
    return None, None



# Utility: get list of price IDs for a given label
def get_price_ids_by_label(label):
    return SUBSCRIPTIONS.get(label, [])

