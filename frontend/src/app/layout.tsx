import { Suspense } from "react";
import type { Metadata } from "next";
import "@/styles/globals.css";
import { MarketplaceStoreProvider } from "@/store/use-marketplace-store";
import { GlobalToast } from "@/components/global-toast";
import { PageviewTracker } from "@/components/analytics/pageview-tracker";

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
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var s = localStorage.getItem('shepoo-marketplace-state-v5');
                if (s) {
                  var p = JSON.parse(s);
                  var isDashboard = window.location.pathname.startsWith('/admin') || window.location.pathname.startsWith('/seller') || window.location.pathname.startsWith('/supporter');
                  if (!isDashboard && p.activeRole && p.users) {
                    var c = p.users.find(function(u) { return u.id === p.sessionUserId });
                    if (c && c.roles) {
                       if ((p.activeRole === 'ADMIN' && c.roles.includes('ADMIN')) || 
                           (p.activeRole === 'SELLER' && c.roles.includes('SELLER')) || 
                           (p.activeRole === 'SUPPORTER' && c.roles.includes('SUPPORTER'))) {
                          document.documentElement.classList.add('hide-until-redirect');
                       }
                    }
                  }
                }
              } catch(e) {}
            `
          }}
        />
        <style dangerouslySetInnerHTML={{ __html: ".hide-until-redirect { opacity: 0 !important; pointer-events: none !important; }" }} />
      </head>
      <body>
        <MarketplaceStoreProvider>
          <Suspense fallback={null}>
            <PageviewTracker />
          </Suspense>
          {children}
          <GlobalToast />
        </MarketplaceStoreProvider>
      </body>
    </html>
  );
}
