"use client";

import { Suspense } from "react";
import ProductListing from "@/components/shared/product-listing";

export default function ProductsPage() {
  return (
    <Suspense fallback={<div>Đang tải sản phẩm...</div>}>
      <ProductListing title="Tất cả sản phẩm" />
    </Suspense>
  );
}
