"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { pdf } from "@react-pdf/renderer";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import { ShippingLabelDocument, type ShippingLabelData } from "@/components/pdf/shipping-label";
import { useMarketplaceStore } from "@/store/use-marketplace-store";
import { Loader2 } from "lucide-react";

function PrintOrdersContent() {
  const searchParams = useSearchParams();
  const idsParam = searchParams.get("ids");
  const store = useMarketplaceStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!idsParam) {
      setError("Không tìm thấy mã đơn hàng.");
      return;
    }

    const processPdf = async () => {
      try {
        const orderIds = idsParam.split(",");
        const orders = store.state.orders.filter(o => orderIds.includes(o.id));
        
        if (orders.length === 0) {
          // If the store is empty, maybe we need to fetch them? 
          // For now, assuming the store has the orders since we just opened from the dashboard
          setError("Không tìm thấy dữ liệu đơn hàng trong bộ nhớ tạm.");
          return;
        }

        const labelsData: ShippingLabelData[] = [];

        for (const order of orders) {
          const shop = store.state.shops.find(s => s.id === order.sellerId);
          // Generate QR Code
          const qrCodeDataUrl = await QRCode.toDataURL(order.orderCode, { width: 200, margin: 1 });
          
          // Generate Barcode using offscreen canvas
          const canvas = document.createElement("canvas");
          JsBarcode(canvas, order.orderCode, {
            format: "CODE128",
            displayValue: false,
            fontSize: 20,
            height: 50,
            margin: 0
          });
          const barcodeDataUrl = canvas.toDataURL("image/png");

          // Fake Routing Code
          const routingCode = `HC-${Math.floor(Math.random() * 90 + 10)}-0${Math.floor(Math.random() * 9 + 1)}-GV${Math.floor(Math.random() * 90 + 10)}`;

          const orderWithShop = {
            ...order,
            seller: shop
          } as any;

          labelsData.push({
            order: orderWithShop,
            barcodeDataUrl,
            qrCodeDataUrl,
            routingCode,
          });
        }

        // Generate PDF
        const doc = <ShippingLabelDocument labels={labelsData} />;
        const asPdf = pdf();
        asPdf.updateContainer(doc);
        const blob = await asPdf.toBlob();
        const url = URL.createObjectURL(blob);
        
        // Open PDF in this tab (replaces the loading screen with the native PDF viewer)
        window.location.replace(url);

      } catch (err) {
        console.error(err);
        setError("Lỗi khi tạo file PDF.");
      }
    };

    if (store.ready) {
      processPdf();
    }
  }, [idsParam, store.state.orders, store.ready]);

  if (error) {
    return <div className="p-8 text-red-500 font-bold">{error}</div>;
  }

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-50">
      <Loader2 className="h-10 w-10 animate-spin text-emerald-600 mb-4" />
      <h2 className="text-xl font-bold text-slate-800">Đang khởi tạo phiếu giao hàng...</h2>
      <p className="text-slate-500 mt-2">Vui lòng chờ trong giây lát (Render PDF)</p>
    </div>
  );
}

export default function PrintOrdersPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Đang khởi tạo phiếu giao hàng...</h2>
        <p className="text-slate-500 mt-2">Vui lòng chờ trong giây lát (Render PDF)</p>
      </div>
    }>
      <PrintOrdersContent />
    </Suspense>
  );
}
