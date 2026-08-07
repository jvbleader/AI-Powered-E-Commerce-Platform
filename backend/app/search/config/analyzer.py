ANALYZER_CONFIG = {
    "analysis": {
        "char_filter": {
            "html_strip": {
                "type": "html_strip"
            },
            "vi_char_filter": {
                "type": "mapping",
                "mappings": [
                    "đ => d",
                    "Đ => d"
                ]
            }
        },
        "filter": {
            "product_synonym_filter": {
                "type": "synonym_graph",
                "synonyms_path": "synonyms/product_synonyms.txt",
                "updateable": True
            },
            "brand_synonym_filter": {
                "type": "synonym_graph",
                "synonyms_path": "synonyms/brand_synonyms.txt",
                "updateable": True
            },
            "category_synonym_filter": {
                "type": "synonym_graph",
                "synonyms_path": "synonyms/category_synonyms.txt",
                "updateable": True
            },
            "location_synonym_filter": {
                "type": "synonym_graph",
                "synonyms_path": "synonyms/location_synonyms.txt",
                "updateable": True
            }
        },
        "analyzer": {
            "vi_index_analyzer": {
                "type": "custom",
                "tokenizer": "standard",
                "char_filter": ["html_strip", "vi_char_filter"],
                "filter": ["lowercase", "asciifolding"]
            },
            "vi_search_analyzer": {
                "type": "custom",
                "tokenizer": "standard",
                "char_filter": ["html_strip", "vi_char_filter"],
                "filter": [
                    "lowercase",
                    "asciifolding",
                    "product_synonym_filter",
                    "brand_synonym_filter",
                    "category_synonym_filter",
                    "location_synonym_filter"
                ]
            }
        }
    }
}
