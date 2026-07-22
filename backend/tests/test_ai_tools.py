import json
import os
import sys
from pathlib import Path
import unittest
from unittest.mock import AsyncMock, MagicMock

# Add backend/app to sys.path
backend_app_dir = Path(__file__).resolve().parent.parent / "app"
if str(backend_app_dir) not in sys.path:
    sys.path.insert(0, str(backend_app_dir))

from ai.tools import get_agent_tools


class TestAITools(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.mock_db = AsyncMock()
        self.tools = get_agent_tools(self.mock_db)
        self.tool_map = {t.name: t for t in self.tools}

    def test_tools_registration(self):
        expected_tool_names = {
            "search_catalog",
            "get_product_details",
            "check_inventory",
            "recommend_similar_products",
        }
        self.assertEqual(set(self.tool_map.keys()), expected_tool_names)
        self.assertEqual(len(self.tools), 4)

    def test_tool_docstrings_and_names(self):
        for tool_name in ["search_catalog", "get_product_details", "check_inventory", "recommend_similar_products"]:
            tool_obj = self.tool_map[tool_name]
            self.assertTrue(len(tool_obj.description) > 10)

    async def test_search_catalog_invocation(self):
        mock_img = MagicMock()
        mock_img.is_thumbnail = True
        mock_img.image_url = "/img/test.jpg"

        mock_product = MagicMock()
        mock_product.id = 10
        mock_product.name = "Test Product"
        mock_product.brand = "Test Brand"
        mock_product.average_rating = 4.5
        mock_product.review_count = 10
        mock_product.slug = "test-product"
        mock_product.images = [mock_img]

        mock_variant = MagicMock()
        mock_variant.status = "ACTIVE"
        mock_variant.price = 100000.0
        mock_variant.sale_price = 80000.0
        mock_inventory = MagicMock()
        mock_inventory.quantity = 20
        mock_inventory.reserved_quantity = 5
        mock_variant.inventory = mock_inventory
        mock_product.variants = [mock_variant]

        search_tool = self.tool_map["search_catalog"]

        from repositories import product_repository
        original_get_public = product_repository.get_public_products
        try:
            product_repository.get_public_products = AsyncMock(return_value=([mock_product], 1))
            res_str = await search_tool.ainvoke({"keyword": "Test", "limit": 5})
            data = json.loads(res_str)

            self.assertIsInstance(data, list)
            self.assertEqual(len(data), 1)
            self.assertEqual(data[0]["id"], 10)
            self.assertEqual(data[0]["name"], "Test Product")
            self.assertEqual(data[0]["price"], 100000.0)
            self.assertEqual(data[0]["sale_price"], 80000.0)
            self.assertEqual(data[0]["stock"], 15)
            self.assertEqual(data[0]["thumbnail_url"], "/img/test.jpg")
        finally:
            product_repository.get_public_products = original_get_public

    async def test_get_product_details_invocation(self):
        mock_img = MagicMock()
        mock_img.image_url = "/img/a12.jpg"

        mock_cat = MagicMock()
        mock_cat.name = "My Pham"

        mock_product = MagicMock()
        mock_product.id = 12
        mock_product.name = "Son Kem Li A12"
        mock_product.brand = "Black Rouge"
        mock_product.origin = "Han Quoc"
        mock_product.warranty_info = "12 thang"
        mock_product.short_description = "Son lip"
        mock_product.description = "Full details"
        mock_product.average_rating = 4.8
        mock_product.review_count = 42
        mock_product.images = [mock_img]
        mock_product.categories = [mock_cat]

        mock_variant = MagicMock()
        mock_variant.id = 101
        mock_variant.sku = "A12-RED"
        mock_variant.variant_name = "Do Gach"
        mock_variant.price = 159000.0
        mock_variant.sale_price = 139000.0
        mock_variant.status = "ACTIVE"
        mock_inventory = MagicMock()
        mock_inventory.quantity = 20
        mock_inventory.reserved_quantity = 5
        mock_variant.inventory = mock_inventory
        mock_product.variants = [mock_variant]

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_product
        self.mock_db.execute = AsyncMock(return_value=mock_result)

        detail_tool = self.tool_map["get_product_details"]
        res_str = await detail_tool.ainvoke({"product_id": 12})
        data = json.loads(res_str)

        self.assertEqual(data["id"], 12)
        self.assertEqual(data["name"], "Son Kem Li A12")
        self.assertEqual(data["brand"], "Black Rouge")
        self.assertEqual(len(data["variants"]), 1)
        self.assertEqual(data["variants"][0]["variant_id"], 101)
        self.assertEqual(data["variants"][0]["available_stock"], 15)

    async def test_check_inventory_invocation(self):
        mock_variant = MagicMock()
        mock_variant.id = 101
        mock_variant.variant_name = "Do Gach"
        mock_variant.product_id = 12
        mock_product = MagicMock()
        mock_product.name = "Son Kem Li A12"
        mock_variant.product = mock_product

        mock_inventory = MagicMock()
        mock_inventory.quantity = 20
        mock_inventory.reserved_quantity = 5
        mock_variant.inventory = mock_inventory

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_variant
        self.mock_db.execute = AsyncMock(return_value=mock_result)

        check_tool = self.tool_map["check_inventory"]
        res_str = await check_tool.ainvoke({"variant_id": 101})
        data = json.loads(res_str)

        self.assertEqual(data["variant_id"], 101)
        self.assertEqual(data["quantity"], 20)
        self.assertEqual(data["reserved_quantity"], 5)
        self.assertEqual(data["available_stock"], 15)
        self.assertTrue(data["in_stock"])

    async def test_recommend_similar_products_invocation(self):
        mock_product = MagicMock()
        mock_product.id = 12
        mock_cat = MagicMock()
        mock_cat.id = 3
        mock_product.categories = [mock_cat]

        mock_img = MagicMock()
        mock_img.is_thumbnail = True
        mock_img.image_url = "/img/rec.jpg"

        mock_rec = MagicMock()
        mock_rec.id = 15
        mock_rec.name = "Son Thoi Black Rouge"
        mock_rec.brand = "Black Rouge"
        mock_rec.average_rating = 4.6
        mock_rec.review_count = 15
        mock_rec.slug = "son-thoi"
        mock_rec.images = [mock_img]

        mock_rec_var = MagicMock()
        mock_rec_var.status = "ACTIVE"
        mock_rec_var.price = 180000.0
        mock_rec_var.sale_price = None
        mock_rec_var.inventory = MagicMock(quantity=10, reserved_quantity=2)
        mock_rec.variants = [mock_rec_var]

        mock_result_prod = MagicMock()
        mock_result_prod.scalar_one_or_none.return_value = mock_product

        mock_scalars = MagicMock()
        mock_scalars.unique.return_value.all.return_value = [mock_rec]
        mock_result_recs = MagicMock()
        mock_result_recs.scalars.return_value = mock_scalars

        self.mock_db.execute = AsyncMock(side_effect=[mock_result_prod, mock_result_recs])

        rec_tool = self.tool_map["recommend_similar_products"]
        res_str = await rec_tool.ainvoke({"product_id": 12})
        data = json.loads(res_str)

        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["id"], 15)
        self.assertEqual(data[0]["name"], "Son Thoi Black Rouge")
        self.assertEqual(data[0]["stock"], 8)


if __name__ == "__main__":
    unittest.main()
