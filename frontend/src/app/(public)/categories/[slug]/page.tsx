"use client";

import { useParams } from "next/navigation";
import ProductListing from "@/components/shared/product-listing";
import { useMarketplaceStore } from "@/store/use-marketplace-store";

export default function CategoryListingPage() {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const store = useMarketplaceStore();
  
  const category = store.state.categories.find((c) => c.slug === slug);
  const title = category ? `Danh mục ${category.name}` : "Danh mục sản phẩm";

  return <ProductListing title={title} categorySlug={slug} />;
}
