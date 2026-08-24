"""
AI Visual Shopping Assistant — hackathon prototype backend.

Flow: upload -> detect -> select items -> sizes -> budget/shopping source
      -> analyze & find options -> results (Closest Match / Best Value / Best Price tabs)
      -> recalculate
No auth, no cart, no payments, no database. Products come from data/products.json.

One candidate pool is built per request (hard constraints: category, size, budget,
shopping source), then ranked three different ways locally — no repeated "AI calls".
"""
import itertools
import json
import os
import random

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PRODUCTS_PATH = os.path.join(BASE_DIR, "data", "products.json")

with open(PRODUCTS_PATH, "r") as f:
    PRODUCTS = json.load(f)

PRODUCTS_BY_CATEGORY = {}
for p in PRODUCTS:
    PRODUCTS_BY_CATEGORY.setdefault(p["category"], []).append(p)

# Items we can "detect" in an uploaded photo, for the demo.
DETECTABLE_ITEMS = [
    {"category": "shirt", "label": "Shirt", "icon": "👕"},
    {"category": "pants", "label": "Pants", "icon": "👖"},
    {"category": "shoes", "label": "Shoes", "icon": "👟"},
    {"category": "bag", "label": "Bag", "icon": "👜"},
    {"category": "watch", "label": "Watch", "icon": "⌚"},
]

MALLS = [
    {
        "name": "Doha Festival City",
        "retailers": ["H&M", "Zara", "Nike", "Adidas"],
    },
    {
        "name": "Villaggio Mall",
        "retailers": ["Zara", "Max", "LC Waikiki"],
    },
    {
        "name": "Mall of Qatar",
        "retailers": ["H&M", "Adidas", "Max"],
    },
]


# ---------------------------------------------------------------------------
# Recommendation engine
# ---------------------------------------------------------------------------

def filter_candidates(category, size, source):
    """Hard-filter products in a category by size and shopping source.
    source: 'all' | 'online' | 'qatar'. 'qatar' restricts to retailers with a
    physical Qatar store; 'online' and 'all' include everything in the mock catalog."""
    candidates = PRODUCTS_BY_CATEGORY.get(category, [])
    out = []
    for p in candidates:
        if size and size != "One Size" and size not in p["sizes"]:
            continue
        if source == "qatar" and not p.get("qatar_store", True):
            continue
        out.append(p)
    return out


def build_combinations(selected_items, sizes, source, max_per_category=8, max_combos=6000):
    """selected_items: list of category keys. sizes: {category: size}.
    Returns list of combos, each combo is a list of product dicts (one per category)."""
    per_category_lists = []
    for cat in selected_items:
        size = sizes.get(cat)
        candidates = filter_candidates(cat, size, source)
        if not candidates:
            return []
        # cap candidates per category to keep the cartesian product small
        candidates = sorted(candidates, key=lambda p: -p["visual_match"])[:max_per_category]
        per_category_lists.append(candidates)

    combos = []
    for combo in itertools.product(*per_category_lists):
        combos.append(list(combo))
        if len(combos) >= max_combos:
            break
    return combos


def score_combo(combo):
    total_price = sum(p["price"] for p in combo)
    avg_match = sum(p["visual_match"] for p in combo) / len(combo)
    return total_price, avg_match


def combo_to_result(combo, budget, rank=None):
    total_price, avg_match = score_combo(combo)
    result = {
        "items": combo,
        "total_price": total_price,
        "currency": combo[0]["currency"] if combo else "QAR",
        "visual_match": round(avg_match),
        "over_budget": total_price > budget,
    }
    if rank is not None:
        result["rank"] = rank
    return result


def value_score(combo, lo_p, hi_p, lo_m, hi_m):
    price, match = score_combo(combo)
    price_norm = 0.0 if hi_p == lo_p else (price - lo_p) / (hi_p - lo_p)
    match_norm = 1.0 if hi_m == lo_m else (match - lo_m) / (hi_m - lo_m)
    return match_norm * 0.5 + (1 - price_norm) * 0.5


def top_n(combos, budget, key_fn, reverse, n=3):
    """Pick the top n combos by key_fn, preferring combos within budget (a hard
    constraint) but falling back to the closest options above budget if nothing fits."""
    in_budget = [c for c in combos if score_combo(c)[0] <= budget]
    pool = in_budget if in_budget else combos
    ranked = sorted(pool, key=key_fn, reverse=reverse)
    return ranked[:n]


def generate_results(selected_items, sizes, budget, source):
    """Build ONE candidate pool (hard constraints applied), then rank it three
    different ways. No separate expensive calls per tab."""
    combos = build_combinations(selected_items, sizes, source)
    if not combos:
        return None

    lo_p = min(score_combo(c)[0] for c in combos)
    hi_p = max(score_combo(c)[0] for c in combos)
    lo_m = min(score_combo(c)[1] for c in combos)
    hi_m = max(score_combo(c)[1] for c in combos)

    closest_match = top_n(combos, budget, key_fn=lambda c: score_combo(c)[1], reverse=True)
    best_price = top_n(combos, budget, key_fn=lambda c: score_combo(c)[0], reverse=False)
    best_value = top_n(
        combos, budget,
        key_fn=lambda c: value_score(c, lo_p, hi_p, lo_m, hi_m),
        reverse=True,
    )

    def to_results(combo_list):
        return [combo_to_result(c, budget, rank=i + 1) for i, c in enumerate(combo_list)]

    tabs = {
        "closest_match": to_results(closest_match),
        "best_value": to_results(best_value),
        "best_price": to_results(best_price),
    }

    any_in_budget = any(
        not r["over_budget"] for results in tabs.values() for r in results
    )
    return {
        "tabs": tabs,
        "any_in_budget": any_in_budget,
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/analyze", methods=["POST"])
def api_analyze():
    """Mocked detection step. In production this would call a multimodal model
    on the uploaded image. Here we return a consistent demo detection result."""
    # Randomly simulate a low-confidence read ~1 in 8 times, per the "bad image
    # handling" requirement, so the manual-confirm path is reachable in the demo.
    confident = random.random() > 0.125
    return jsonify({
        "confident": confident,
        "items": DETECTABLE_ITEMS,
    })


@app.route("/api/products", methods=["GET"])
def api_products():
    return jsonify(PRODUCTS)


@app.route("/api/recommend", methods=["POST"])
def api_recommend():
    data = request.get_json(force=True) or {}
    selected_items = data.get("items", [])
    sizes = data.get("sizes", {})
    budget = float(data.get("budget", 0) or 0)
    source = data.get("source", "all")

    if not selected_items:
        return jsonify({"error": "No items selected."}), 400

    payload = generate_results(selected_items, sizes, budget, source)
    if payload is None:
        return jsonify({"error": "No products match your selection and sizes."}), 404

    if not payload["any_in_budget"]:
        payload["message"] = f"No exact match found under {budget:g} QAR. Showing the closest options above budget."

    return jsonify(payload)


@app.route("/api/recalculate", methods=["POST"])
def api_recalculate():
    data = request.get_json(force=True) or {}
    selected_items = data.get("items", [])
    sizes = data.get("sizes", {})
    old_budget = float(data.get("old_budget", 0) or 0)
    new_budget = float(data.get("new_budget", 0) or 0)
    source = data.get("source", "all")

    if not selected_items:
        return jsonify({"error": "No items selected."}), 400

    payload = generate_results(selected_items, sizes, new_budget, source)
    if payload is None:
        return jsonify({"error": "No products match your selection and sizes."}), 404

    if not payload["any_in_budget"]:
        message = f"No exact match found under {new_budget:g} QAR. Showing the closest options above budget."
    elif new_budget < old_budget:
        message = (
            "Your budget changed, so we found a cheaper combination "
            "while keeping the overall look as similar as possible."
        )
    elif new_budget > old_budget:
        message = "Your budget went up, so we found stronger visual matches within the new range."
    else:
        message = "Budget unchanged — here are your options again."

    payload["message"] = message
    return jsonify(payload)


@app.route("/api/malls", methods=["GET"])
def api_malls():
    return jsonify(MALLS)


if __name__ == "__main__":
    app.run(debug=True, port=5000)
