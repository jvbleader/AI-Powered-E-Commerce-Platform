"use client";

import { useSearchParams } from "next/navigation";
import ProductListing from "@/components/shared/product-listing";

export default function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";

  return <ProductListing title="Tìm kiếm sản phẩm" initialKeyword={query} />;
}
