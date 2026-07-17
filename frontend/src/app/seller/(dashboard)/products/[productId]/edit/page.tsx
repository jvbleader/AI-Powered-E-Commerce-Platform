"use client";

import { useParams } from "next/navigation";
import ProductForm from "@/components/seller/product-form";

export default function EditProductPage() {
  const params = useParams();
  const productId = params.productId as string;

  return <ProductForm productId={productId} />;
}
