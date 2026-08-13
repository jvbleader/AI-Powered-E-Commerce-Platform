from abc import ABC, abstractmethod

from .query_builder import QueryBuilder
from .ranking_engine import RankingEngine
from .config.field_boost import (
    PRODUCT_SEARCH_FIELDS,
    SHOP_SEARCH_FIELDS,
    MINIMUM_SHOULD_MATCH,
    NAME_PHRASE_BOOST,
    NAME_PREFIX_BOOST,
)
from .config.fuzziness import FUZZINESS_ENABLED, FUZZINESS_MIN_LENGTH, FUZZINESS_VALUE
from .config.aggregation import AGGREGATIONS_CONFIG


class BaseSearchStrategy(ABC):
    @abstractmethod
    def build_query(self, processed_query: str, filters: dict, page: int, size: int, sort_by: str) -> dict:
        pass


def _normalize_sort(sort_by: str | None) -> str:
    if not sort_by:
        return "relevance"
    aliases = {
        "latest": "newest",
        "sales": "best_selling",
        "sold_count": "best_selling",
        "rating": "high_rating",
    }
    return aliases.get(sort_by, sort_by)


class ProductSearchStrategy(BaseSearchStrategy):
    def build_query(self, processed_query: str, filters: dict, page: int, size: int, sort_by: str, query_vector: list[float] = None) -> dict:
        builder = QueryBuilder()
        builder.set_pagination(page, size)
        sort_by = _normalize_sort(sort_by)

        if query_vector and sort_by == "relevance":
            builder.add_knn(
                field="embedding",
                query_vector=query_vector,
                k=size * 2,
                num_candidates=100
            )

        if processed_query:
            fuzziness = (
                FUZZINESS_VALUE
                if FUZZINESS_ENABLED and len(processed_query) >= FUZZINESS_MIN_LENGTH
                else None
            )
            builder.add_multi_match(
                processed_query,
                PRODUCT_SEARCH_FIELDS,
                fuzziness=fuzziness,
                minimum_should_match=MINIMUM_SHOULD_MATCH,
            )
            # Phrase / prefix boosts — optional should clauses (do not gate hits)
            builder.add_match_phrase("name", processed_query, boost=NAME_PHRASE_BOOST, slop=1)
            if len(processed_query) <= 40:
                builder.add_match_phrase_prefix(
                    "name", processed_query, boost=NAME_PREFIX_BOOST
                )

        # Apply Filters
        if filters.get("category_slug"):
            slugs = [s.strip() for s in filters["category_slug"].split(",") if s.strip()]
            builder.add_post_filter("category_slugs", slugs)

        if filters.get("shop_slug"):
            slugs = [s.strip() for s in filters["shop_slug"].split(",") if s.strip()]
            builder.add_post_filter("shop_slug", slugs)

        # Also support seller_id string representing shop slugs (as sent by frontend)
        if filters.get("seller_id"):
            val = filters["seller_id"]
            if all(v.strip().isdigit() for v in val.split(",")):
                seller_ids = [int(v.strip()) for v in val.split(",") if v.strip()]
                builder.add_post_filter("seller_id", seller_ids)
            else:
                slugs = [s.strip() for s in val.split(",") if s.strip()]
                builder.add_post_filter("shop_slug", slugs)

        if filters.get("min_price") is not None or filters.get("max_price") is not None:
            builder.add_range_filter(
                "min_price",
                gte=filters.get("min_price"),
                lte=filters.get("max_price"),
            )

        min_rating = filters.get("min_rating")
        if min_rating is None:
            min_rating = filters.get("rating")
        if min_rating is not None:
            builder.add_range_filter("average_rating", gte=min_rating)

        if filters.get("brand"):
            builder.add_term_filter("brand_name.keyword", filters["brand"])

        if filters.get("pickup_address"):
            addresses = [s.strip() for s in filters["pickup_address"].split(",") if s.strip()]
            builder.add_should_match_filter("pickup_address", addresses)

        if filters.get("in_stock") is True:
            builder.add_term_filter("in_stock", True)

        # Default filters
        builder.add_term_filter("status", "ACTIVE")

        # Add Aggregations
        for agg_name, agg_dsl in AGGREGATIONS_CONFIG.items():
            builder.add_aggregation(agg_name, agg_dsl)

        # Build Base Query
        base_query_dsl = builder.build_query()

        # Apply Ranking only for relevance + keyword searches
        if sort_by == "relevance" and processed_query:
            ranking = RankingEngine(base_query_dsl)
            ranking.apply_popularity_score()
            ranking.apply_rating_score()
            ranking.apply_freshness_score()
            ranking.apply_availability_score()
            final_query_dsl = ranking.build()
        else:
            final_query_dsl = base_query_dsl

        # Add sort
        if sort_by == "price_asc":
            builder.add_sort("min_price", "asc")
        elif sort_by == "price_desc":
            builder.add_sort("min_price", "desc")
        elif sort_by == "newest":
            builder.add_sort("created_at", "desc")
        elif sort_by == "best_selling":
            builder.add_sort("sold_count", "desc")
        elif sort_by == "high_rating":
            builder.add_sort("average_rating", "desc")
            builder.add_sort("review_count", "desc")
        else:
            if not processed_query:
                # Default browse sort when no keyword
                builder.add_sort("sold_count", "desc")

        return builder.build(final_query_dsl)


class ShopSearchStrategy(BaseSearchStrategy):
    def build_query(self, processed_query: str, filters: dict, page: int, size: int, sort_by: str) -> dict:
        builder = QueryBuilder()
        builder.set_pagination(page, size)
        sort_by = _normalize_sort(sort_by)

        if processed_query:
            fuzziness = (
                FUZZINESS_VALUE
                if FUZZINESS_ENABLED and len(processed_query) >= FUZZINESS_MIN_LENGTH
                else None
            )
            builder.add_multi_match(
                processed_query,
                SHOP_SEARCH_FIELDS,
                fuzziness=fuzziness,
                minimum_should_match=MINIMUM_SHOULD_MATCH,
            )
            builder.add_match_phrase("shop_name", processed_query, boost=8.0, slop=1)

        # Shop docs store seller status (APPROVED / PENDING / ...)
        builder.add_term_filter("status", "APPROVED")

        min_rating = filters.get("min_rating")
        if min_rating is None:
            min_rating = filters.get("rating")
        if min_rating is not None:
            builder.add_range_filter("average_rating", gte=min_rating)

        base_query_dsl = builder.build_query()

        if sort_by == "relevance" and processed_query:
            ranking = RankingEngine(base_query_dsl)
            ranking.apply_rating_score()
            ranking.apply_field_value_factor("total_sold", modifier="log1p", weight=1.5)
            final_query_dsl = ranking.build()
        else:
            final_query_dsl = base_query_dsl

        if sort_by in ("high_rating", "rating"):
            builder.add_sort("average_rating", "desc")
        elif sort_by == "newest":
            builder.add_sort("created_at", "desc")
        elif sort_by == "product_count":
            builder.add_sort("product_count", "desc")
        else:
            if not processed_query:
                builder.add_sort("total_sold", "desc")

        return builder.build(final_query_dsl)
