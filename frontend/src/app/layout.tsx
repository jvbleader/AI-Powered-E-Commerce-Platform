import type { Metadata } from "next";
import "@/styles/globals.css";
import { MarketplaceStoreProvider } from "@/store/use-marketplace-store";
import { GlobalToast } from "@/components/global-toast";

export const metadata: Metadata = {
  title: { default: "Shepoo Marketplace", template: "%s | Shepoo" },
  description: "Mua sắm thông minh tại Shepoo – nền tảng thương mại điện tử với hàng nghìn sản phẩm từ các shop uy tín.",
  keywords: ["mua sắm online", "thương mại điện tử", "Shepoo", "marketplace"],
  openGraph: {
    type: "website",
    siteName: "Shepoo Marketplace",
    title: "Shepoo Marketplace",
    description: "Mua sắm thông minh tại Shepoo – nền tảng thương mại điện tử với hàng nghìn sản phẩm từ các shop uy tín."
  },
  robots: { index: true, follow: true }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>
        <MarketplaceStoreProvider>
          {children}
          <GlobalToast />
        </MarketplaceStoreProvider>
      </body>
    </html>
  );
}
