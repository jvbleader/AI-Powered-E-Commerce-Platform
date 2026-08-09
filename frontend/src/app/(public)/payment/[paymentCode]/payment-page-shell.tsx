"use client";

import dynamic from "next/dynamic";
import { PaymentLoading } from "./payment-loading";

const PaymentPageClient = dynamic(() => import("./payment-page-client"), {
  ssr: false,
  loading: () => <PaymentLoading />,
});

type PaymentPageShellProps = {
  paymentCode: string;
};

export function PaymentPageShell({ paymentCode }: PaymentPageShellProps) {
  return <PaymentPageClient paymentCode={paymentCode} />;
}
