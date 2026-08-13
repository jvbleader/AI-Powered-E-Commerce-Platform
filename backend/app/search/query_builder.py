from typing import Any


class QueryBuilder:
    """
    Builder Pattern for constructing Elasticsearch Query DSL.
    Allows method chaining for adding matches, filters, and aggregations.
    Purely builds the core query structure (bool, term, match, aggregations).
    """

    def __init__(self):
        self._must = []
        self._filter = []
        self._should = []
        self._aggregations = {}
        self._sort = []
        self._post_filter = []
        self._from_idx = 0
        self._size = 20
        self._source = None
        self._minimum_should_match = 0
        self._knn = None

    def add_knn(
        self, field: str, query_vector: list[float], k: int = 100, num_candidates: int = 100, boost: float = 1.0
    ) -> "QueryBuilder":
        if query_vector:
            self._knn = {
                "field": field,
                "query_vector": query_vector,
                "k": k,
                "num_candidates": num_candidates,
                "boost": boost,
            }
        return self

    def add_multi_match(
        self,
        query: str,
        fields: list[str],
        fuzziness: str | None = "AUTO",
        minimum_should_match: str | int | None = None,
        boost: float | None = None,
    ) -> "QueryBuilder":
        if query:
            mm: dict[str, Any] = {
                "query": query,
                "fields": fields,
                "type": "best_fields",
            }
            if fuzziness:
                mm["fuzziness"] = fuzziness
            if minimum_should_match is not None:
                mm["minimum_should_match"] = minimum_should_match
            if boost is not None:
                mm["boost"] = boost
            self._must.append({"multi_match": mm})
        return self

    def add_match_phrase(
        self, field: str, query: str, boost: float = 1.0, slop: int = 0
    ) -> "QueryBuilder":
        if query:
            self._should.append({
                "match_phrase": {
                    field: {
                        "query": query,
                        "boost": boost,
                        "slop": slop,
                    }
                }
            })
        return self

    def add_match_phrase_prefix(
        self, field: str, query: str, boost: float = 1.0, max_expansions: int = 10
    ) -> "QueryBuilder":
        if query:
            self._should.append({
                "match_phrase_prefix": {
                    field: {
                        "query": query,
                        "boost": boost,
                        "max_expansions": max_expansions,
                    }
                }
            })
        return self

    def add_match(self, field: str, query: str, boost: float = 1.0) -> "QueryBuilder":
        if query:
            self._should.append({
                "match": {
                    field: {
                        "query": query,
                        "boost": boost
                    }
                }
            })
        return self

    def add_match_filter(self, field: str, query: str) -> "QueryBuilder":
        if query:
            self._must.append({
                "match": {
                    field: query
                }
            })
        return self

    def add_should_match_filter(self, field: str, queries: list[str]) -> "QueryBuilder":
        if queries:
            should_clauses = [{"match": {field: {"query": q, "operator": "and"}}} for q in queries]
            self._must.append({
                "bool": {
                    "should": should_clauses,
                    "minimum_should_match": 1
                }
            })
        return self

    def set_minimum_should_match(self, msm: str | int) -> "QueryBuilder":
        """Set bool-level minimum_should_match for optional should clauses."""
        self._minimum_should_match = msm
        return self

    def add_term_filter(self, field: str, value: Any) -> "QueryBuilder":
        if value is not None:
            self._filter.append({"term": {field: value}})
        return self

    def add_terms_filter(self, field: str, values: list[Any]) -> "QueryBuilder":
        if values:
            self._filter.append({"terms": {field: values}})
        return self

    def add_range_filter(self, field: str, gte: Any = None, lte: Any = None) -> "QueryBuilder":
        if gte is not None or lte is not None:
            range_query = {}
            if gte is not None:
                range_query["gte"] = gte
            if lte is not None:
                range_query["lte"] = lte
            self._filter.append({"range": {field: range_query}})
        return self

    def add_post_filter(self, field: str, values: list[Any]) -> "QueryBuilder":
        if values:
            self._post_filter.append({"terms": {field: values}})
        return self

    def add_aggregation(self, name: str, agg_dsl: dict) -> "QueryBuilder":
        """Add an aggregation to the query."""
        self._aggregations[name] = agg_dsl
        return self

    def add_sort(self, field: str, order: str = "desc") -> "QueryBuilder":
        self._sort.append({field: order})
        return self

    def set_pagination(self, page: int, size: int) -> "QueryBuilder":
        self._from_idx = (page - 1) * size
        self._size = size
        return self

    def set_source(self, source_fields: list[str]) -> "QueryBuilder":
        self._source = source_fields
        return self

    def build_query(self) -> dict:
        """Returns only the query part, useful for RankingEngine to wrap."""
        bool_query = {}
        if self._must:
            bool_query["must"] = self._must
        if self._filter:
            bool_query["filter"] = self._filter
        if self._should:
            bool_query["should"] = self._should
            # Optional should boosts: do not require them when must is present
            if self._minimum_should_match:
                bool_query["minimum_should_match"] = self._minimum_should_match
            elif not self._must:
                bool_query["minimum_should_match"] = 1

        return {"bool": bool_query} if bool_query else {"match_all": {}}

    def build(self, final_query: dict = None) -> dict:
        """
        Builds the complete ES body.
        If final_query is provided (e.g. from RankingEngine), it uses that.
        Otherwise it uses build_query().
        """
        query_dsl = final_query if final_query else self.build_query()

        body = {
            "query": query_dsl,
            "from": self._from_idx,
            "size": self._size,
        }

        if self._knn:
            body["knn"] = self._knn

        if self._sort:
            body["sort"] = self._sort

        if self._source:
            body["_source"] = self._source

        if self._aggregations:
            body["aggs"] = self._aggregations

        if self._post_filter:
            if len(self._post_filter) == 1:
                body["post_filter"] = self._post_filter[0]
            else:
                body["post_filter"] = {"bool": {"filter": self._post_filter}}

        return body
