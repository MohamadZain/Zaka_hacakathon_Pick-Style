"""
Generates data/products.json using real remote product photography (Unsplash CDN)
instead of generated placeholders.

Run once from the ai-shop/ directory: python data/generate_catalog.py
"""
import json
import os
import random

random.seed(42)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# retailer price tiers (QAR) and Qatar physical-store availability
RETAILERS = {
    "H&M":        {"tier": "mid",     "qatar_store": True},
    "Zara":       {"tier": "premium", "qatar_store": True},
    "Nike":       {"tier": "premium", "qatar_store": True},
    "Adidas":     {"tier": "premium", "qatar_store": True},
    "Max":        {"tier": "budget",  "qatar_store": True},
    "LC Waikiki": {"tier": "budget",  "qatar_store": True},
    "SHEIN":      {"tier": "budget",  "qatar_store": False},
    "Temu":       {"tier": "budget",  "qatar_store": False},
}

TIER_PRICE_RANGE = {
    "budget":  (19, 69),
    "mid":     (49, 139),
    "premium": (89, 249),
}

# Real product-style photography (Unsplash), grouped and cycled per category.
# Using the CDN's own resize/crop params keeps every card the same aspect ratio.
IMAGE_IDS = {
    "shirt": [
        "1581655353564-df123a1eb820",
        "1521572163474-6864f9cf17ab",
        "1622445275463-afa2ab738c34",
        "1651761179569-4ba2aa054997",
        "1574180566232-aaad1b5b8450",
        "1620799139507-2a76f79a2f4d",
        "1618677603286-0ec56cb6e1b5",
        "1564859228273-274232fdb516",
        "1529374255404-311a2a4f1fd9",
    ],
    "pants": [
        "1783012687000-26e994270984",
        "1772987353018-2e46b564e697",
        "1781124771400-0988d97e358b",
        "1780566036313-1f12261769e8",
        "1780566036289-2ee30453f560",
        "1772987311922-1f2a837bcf59",
        "1764846344349-2bdf437443fe",
    ],
    "shoes": [
        "1512374382149-233c42b6a83b",
        "1597350584914-55bb62285896",
        "1544441892-794166f1e3be",
        "1608229751021-ed4bd8677753",
        "1625860191460-10a66c7384fb",
        "1626379616459-b2ce1d9decbc",
    ],
    "bag": [
        "1574365569389-a10d488ca3fb",
        "1544816155-12df9643f363",
        "1578237493287-8d4d2b03591a",
        "1548863227-3af567fc3b27",
        "1630381260512-e3fe55c11973",
        "1621466550398-ac8062907657",
    ],
    "watch": [
        "1523170335258-f5ed11844a49",
        "1524805444758-089113d48a6d",
        "1620625515032-6ed0c1790c75",
        "1542496658-e33a6d0d50f6",
        "1547996160-81dfa63595aa",
        "1622434641406-a158123450f9",
    ],
}


def image_url(photo_id, w=600, h=750):
    return (
        f"https://images.unsplash.com/photo-{photo_id}"
        f"?w={w}&h={h}&fit=crop&crop=entropy&auto=format&q=80"
    )


CATEGORIES = {
    "shirt": {
        "label": "Shirt",
        "sizes": ["S", "M", "L", "XL"],
        "names": [
            "Oversized Cotton Tee", "Classic Crew Tee", "Relaxed Fit Shirt",
            "Boxy Cotton Tee", "Essential Crew Neck", "Heavyweight Tee",
            "Drop-Shoulder Tee", "Plain Cotton Shirt", "Basic Crew Tee",
            "Everyday Cotton Tee",
        ],
        "colors": ["White", "Off-White", "Black", "Stone", "Sand"],
        "retailers": ["H&M", "Zara", "Max", "LC Waikiki", "Nike", "Adidas", "SHEIN", "Temu"],
    },
    "pants": {
        "label": "Pants",
        "sizes": ["28", "30", "32", "34", "36"],
        "names": [
            "Wide-Leg Trousers", "Straight Fit Pants", "Relaxed Chino",
            "Tapered Trousers", "Cotton Twill Pants", "Wide Leg Cargo",
            "Loose Fit Trousers", "Basic Straight Pants", "Slim Straight Pants",
        ],
        "colors": ["Black", "Charcoal", "Stone", "Navy", "Khaki"],
        "retailers": ["H&M", "Zara", "Max", "LC Waikiki", "SHEIN", "Temu"],
    },
    "shoes": {
        "label": "Shoes",
        "sizes": ["40", "41", "42", "43", "44"],
        "names": [
            "Court Sneaker", "Classic Runner", "Low-Top Sneaker",
            "Retro Trainer", "Everyday Sneaker", "Canvas Trainer", "Basic Sneaker",
        ],
        "colors": ["White", "White/Black", "Off-White", "Black"],
        "retailers": ["Nike", "Adidas", "H&M", "Zara", "Temu"],
    },
    "bag": {
        "label": "Bag",
        "sizes": ["One Size"],
        "names": [
            "Canvas Tote", "Crossbody Bag", "Structured Tote",
            "Mini Shoulder Bag", "Everyday Backpack", "Basic Tote",
        ],
        "colors": ["Black", "Sand", "Stone", "Brown"],
        "retailers": ["Zara", "H&M", "Max", "SHEIN", "Temu"],
    },
    "watch": {
        "label": "Watch",
        "sizes": ["One Size"],
        "names": [
            "Minimal Steel Watch", "Classic Leather Strap Watch", "Sport Watch",
            "Round Dial Watch", "Basic Analog Watch",
        ],
        "colors": ["Black", "Silver", "Brown", "Gold"],
        "retailers": ["Zara", "H&M", "Max", "SHEIN", "Temu"],
    },
}

STYLE_TAGS = ["oversized", "relaxed", "classic", "minimal", "streetwear", "casual"]

products = []
pid = 1


def make_price(retailer):
    tier = RETAILERS[retailer]["tier"]
    lo, hi = TIER_PRICE_RANGE[tier]
    return random.randrange(lo, hi, 2)


for cat_key, cat in CATEGORIES.items():
    image_pool = IMAGE_IDS[cat_key]
    for i, name in enumerate(cat["names"]):
        retailer = cat["retailers"][i % len(cat["retailers"])]
        color = cat["colors"][i % len(cat["colors"])]
        price = make_price(retailer)
        base_match = {"premium": 88, "mid": 84, "budget": 78}[RETAILERS[retailer]["tier"]]
        visual_match = max(68, min(97, base_match + random.randint(-9, 9)))
        product_id = f"{cat_key}-{pid:03d}"
        photo_id = image_pool[i % len(image_pool)]
        product = {
            "id": product_id,
            "name": name,
            "category": cat_key,
            "category_label": cat["label"],
            "retailer": retailer,
            "qatar_store": RETAILERS[retailer]["qatar_store"],
            "image": image_url(photo_id),
            "price": price,
            "currency": "QAR",
            "sizes": cat["sizes"],
            "color": color,
            "style": random.choice(STYLE_TAGS),
            "visual_match": visual_match,
            "product_url": f"https://example.com/{retailer.lower().replace(' ', '').replace('&','')}/{product_id}",
        }
        products.append(product)
        pid += 1

out_path = os.path.join(ROOT, "data", "products.json")
with open(out_path, "w") as f:
    json.dump(products, f, indent=2)

print(f"Wrote {len(products)} products to {out_path}")
