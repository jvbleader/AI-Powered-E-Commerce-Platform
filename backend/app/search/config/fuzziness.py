# Fuzziness Configuration
FUZZINESS_ENABLED = True
FUZZINESS_MIN_LENGTH = 5  # Only apply fuzzy if keyword length > 4
FUZZINESS_VALUE = "AUTO"  # AUTO creates a fuzziness of 1 for lengths 3..5, 2 for > 5. Since we restrict min length to 5, it means length 5 has fuzzy 1, >5 has fuzzy 2.

# Fields that allow fuzziness
FUZZINESS_ALLOWED_FIELDS = [
    "name",
    "description",
    "category_names"
]

# Fields that strictly DO NOT allow fuzziness (e.g. SKUs)
FUZZINESS_BLOCKED_FIELDS = [
    "sku",
    "brand_name"
]
