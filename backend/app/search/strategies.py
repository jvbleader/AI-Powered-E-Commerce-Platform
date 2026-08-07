from abc import ABC, abstractmethod
from typing import Any
from .query_builder import QueryBuilder
from .ranking_engine import RankingEngine
from .config.field_boost import PRODUCT_SEARCH_FIELDS, SHOP_SEARCH_FIELDS, MINIMUM_SHOULD_MATCH
from .config.fuzziness import FUZZINESS_ENABLED, FUZZINESS_MIN_LENGTH, FUZZINESS_VALUE
from .config.aggregation import AGGREGATIONS_CONFIG

class BaseSearchStrategy(ABC):
    @abstractmethod
    def build_query(self, processed_query: str, filters: dict, page: int, size: int, sort_by: str) -> dict:
        pass

class ProductSearchStrategy(BaseSearchStrategy):
    def build_query(self, processed_query: str, filters: dict, page: int, size: int, sort_by: str) -> dict:
        builder = QueryBuilder()
        builder.set_pagination(page, size)
        
        if processed_query:
            fuzziness = FUZZINESS_VALUE if FUZZINESS_ENABLED and len(processed_query) >= FUZZINESS_MIN_LENGTH else None
            builder.add_multi_match(processed_query, PRODUCT_SEARCH_FIELDS, fuzziness=fuzziness)
            builder.set_minimum_should_match(MINIMUM_SHOULD_MATCH)
            
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
            
        if filters.get("min_price") or filters.get("max_price"):
            builder.add_range_filter("price", gte=filters.get("min_price"), lte=filters.get("max_price"))
            
        if filters.get("rating"):
            builder.add_range_filter("average_rating", gte=filters.get("rating"))
            
        if filters.get("brand"):
            builder.add_term_filter("brand_name.keyword", filters["brand"])
            
        if filters.get("pickup_address"):
            addresses = [s.strip() for s in filters["pickup_address"].split(",") if s.strip()]
            builder.add_should_match_filter("pickup_address", addresses)

        # Default filters
        builder.add_term_filter("status", "ACTIVE")
        
        # Add Aggregations
        for agg_name, agg_dsl in AGGREGATIONS_CONFIG.items():
            builder.add_aggregation(agg_name, agg_dsl)

        # Build Base Query
        base_query_dsl = builder.build_query()
        
        # Apply Ranking
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
            builder.add_sort("price", "asc")
        elif sort_by == "price_desc":
            builder.add_sort("price", "desc")
        elif sort_by == "latest":
            builder.add_sort("created_at", "desc")
        elif sort_by == "sales":
            builder.add_sort("sold_count", "desc")
        else:
            if not processed_query:
                # Default sort if no query
                builder.add_sort("sold_count", "desc")
                
        return builder.build(final_query_dsl)

class ShopSearchStrategy(BaseSearchStrategy):
    def build_query(self, processed_query: str, filters: dict, page: int, size: int, sort_by: str) -> dict:
        builder = QueryBuilder()
        builder.set_pagination(page, size)
        
        if processed_query:
            fuzziness = FUZZINESS_VALUE if FUZZINESS_ENABLED and len(processed_query) >= FUZZINESS_MIN_LENGTH else None
            builder.add_multi_match(processed_query, SHOP_SEARCH_FIELDS, fuzziness=fuzziness)
        
        builder.add_term_filter("status", "ACTIVE")
        
        base_query_dsl = builder.build_query()
        
        if sort_by == "relevance" and processed_query:
            ranking = RankingEngine(base_query_dsl)
            # Shops mainly rely on total_sold and average_rating
            ranking.apply_rating_score()
            ranking.functions.append({
                "field_value_factor": {
                    "field": "total_sold",
                    "modifier": "log1p",
                    "missing": 0,
                    "weight": 1.5
                }
            })
            final_query_dsl = ranking.build()
        else:
            final_query_dsl = base_query_dsl
            
        if sort_by == "rating":
            builder.add_sort("average_rating", "desc")
        elif sort_by == "latest":
            builder.add_sort("created_at", "desc")
        else:
            if not processed_query:
                builder.add_sort("total_sold", "desc")
                
        return builder.build(final_query_dsl)
