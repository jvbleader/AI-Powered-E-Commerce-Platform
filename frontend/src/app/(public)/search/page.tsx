"use client";

import { useSearchParams } from "next/navigation";
import ProductListing from "@/components/shared/product-listing";

import { Suspense } from "react";

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";

  return <ProductListing title="Tìm kiếm sản phẩm" initialKeyword={query} />;
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <SearchContent />
    </Suspense>
  );
}
