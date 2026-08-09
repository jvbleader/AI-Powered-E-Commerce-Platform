import { PaymentPageShell } from "./payment-page-shell";

type PaymentPageProps = {
  params: Promise<{ paymentCode: string }>;
};

export default async function PaymentPage({ params }: PaymentPageProps) {
  const { paymentCode } = await params;
  return <PaymentPageShell paymentCode={paymentCode} />;
}
