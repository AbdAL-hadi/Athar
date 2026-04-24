"""Deterministic prompt and response composition for accessibility-focused product descriptions."""

from __future__ import annotations

import re


SINGULAR_CATEGORY = {
    "bags": "bag",
    "bracelets": "bracelet",
    "rings": "ring",
    "wallets": "wallet",
    "accessories": "accessory",
    "watches": "watch",
}

STYLE_RULES = {
    "elegant": ["elegant", "refined", "polished", "luxury", "formal", "graceful"],
    "heritage-inspired": ["heritage", "palestinian", "embroidered", "engraved", "motif", "traditional"],
    "modern": ["modern", "clean", "minimal", "sleek", "contemporary"],
    "decorative": ["decorative", "ornate", "embossed", "floral", "engraved", "motif"],
    "minimal": ["minimal", "simple", "clean", "slim", "structured"],
    "feminine": ["blush", "rose", "floral", "soft", "delicate"],
    "statement": ["statement", "bold", "dramatic", "ornate"],
}

OCCASION_RULES = {
    "gift": ["gift", "gift-ready", "special", "keepsake"],
    "formal occasion": ["formal", "elegant", "evening", "refined", "polished"],
    "daily use": ["daily", "everyday", "practical", "structured", "wallet", "card holder"],
    "evening wear": ["evening", "glossy", "ornate", "metallic", "dressy"],
    "statement piece": ["statement", "bold", "decorative", "engraved", "ornate"],
}

PALETTE_DESCRIPTIONS = {
    "black": "deep black",
    "white": "soft white",
    "ivory": "ivory",
    "beige": "warm beige",
    "cream": "cream",
    "brown": "rich brown",
    "tan": "soft tan",
    "gold": "warm gold",
    "silver": "silver",
    "rose gold": "rose-gold",
    "pink": "blush pink",
    "red": "soft red",
    "blue": "cool blue",
    "green": "olive green",
    "gray": "muted gray",
}


def _tokenize(*parts: str) -> list[str]:
    """Splits multiple text fragments into lowercase lexical tokens."""

    merged_text = " ".join(str(part or "") for part in parts).lower()
    return [token for token in re.split(r"[^a-z0-9]+", merged_text) if token]


def _pick_tags(rule_map: dict[str, list[str]], tokens: list[str], fallback: list[str]) -> list[str]:
    """Returns deterministic tags using keyword matching with fallback values."""

    detected_tags = [
        tag
        for tag, keywords in rule_map.items()
        if any(keyword in tokens for keyword in keywords)
    ]

    return (detected_tags or fallback)[:5]


def _build_visual_traits(category_label: str, dominant_colors: list[str], caption: str, material: str) -> list[str]:
    """Produces exactly three short visual traits for accessibility playback."""

    traits = []
    lowered_caption = caption.lower()
    lowered_material = material.lower()

    if dominant_colors:
        traits.append(f"{dominant_colors[0]} tone")

    if any(keyword in lowered_caption for keyword in ["structured", "box", "frame", "slim"]):
        traits.append("structured silhouette")
    elif category_label in {"bag", "wallet", "watch"}:
        traits.append("defined silhouette")
    else:
        traits.append("balanced shape")

    if any(keyword in lowered_caption for keyword in ["floral", "rose", "petal"]):
        traits.append("floral detail")
    elif any(keyword in lowered_caption for keyword in ["engraved", "embossed", "motif"]) or any(
        keyword in lowered_material for keyword in ["engraved", "embossed", "heritage"]
    ):
        traits.append("heritage motif detail")
    else:
        traits.append("refined surface detail")

    while len(traits) < 3:
        traits.append("refined presentation")

    return traits[:3]


def _slugify(values: list[str]) -> list[str]:
    """Converts tags and traits into search-friendly semantic tokens."""

    semantic_tags = []
    seen_values = set()

    for value in values:
        normalized_value = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")

        if not normalized_value or normalized_value in seen_values:
            continue

        seen_values.add(normalized_value)
        semantic_tags.append(normalized_value)

    return semantic_tags


def build_grounded_visual_description(
    *,
    title: str,
    category: str,
    material: str,
    description: str,
    caption: str,
    dominant_colors: list[str],
) -> dict[str, object]:
    """Builds accessibility-friendly product description text and tags from facts plus caption output."""

    tokens = _tokenize(title, category, material, description, caption, *dominant_colors)
    category_label = SINGULAR_CATEGORY.get(category.lower(), "piece")
    color_phrase = ", ".join(dominant_colors[:2]) if dominant_colors else "soft neutral"
    style_tags = _pick_tags(STYLE_RULES, tokens, ["refined", "heritage-inspired", "elegant"])
    occasion_tags = _pick_tags(OCCASION_RULES, tokens, ["gift", "daily use"])
    visual_traits = _build_visual_traits(category_label, dominant_colors, caption, material)
    material_phrase = material or "crafted finish"
    appearance_phrase = style_tags[0] if style_tags else "refined"

    short_description = (
        f"A {color_phrase} {category_label} with {visual_traits[1]} and an {appearance_phrase} feel."
    )

    long_description = " ".join(
        [
            f"This {category_label} appears in {color_phrase} tones and shows a {visual_traits[0]}.",
            f"It features {visual_traits[1]} and surface cues that suggest {material_phrase.lower()}.",
            f"Overall, it seems {appearance_phrase} and may suit {occasion_tags[0].lower()} use.",
        ]
    )

    semantic_tags = _slugify(
        [
            title,
            category,
            material,
            *style_tags,
            *occasion_tags,
            *visual_traits,
            *dominant_colors[:3],
            "appears-suitable-as-gift" if "gift" in occasion_tags else "everyday-leaning",
            "heritage-inspired" if "heritage-inspired" in style_tags else "modern-leaning",
            "decorative" if "decorative" in style_tags else "minimal-leaning",
        ]
    )

    return {
        "descriptions": {
            "en": {
                "short": short_description,
                "long": long_description,
            },
            "ar": {
                "short": "",
                "long": "",
            },
        },
        "styleTags": style_tags,
        "occasionTags": occasion_tags,
        "dominantColors": dominant_colors[:5],
        "visualTraits": visual_traits,
        "semanticTags": semantic_tags[:12],
    }
