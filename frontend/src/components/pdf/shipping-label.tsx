"use client";

import { Document, Page, Text, View, StyleSheet, Image, Font, Svg, Path } from "@react-pdf/renderer";
import type { Order } from "@/types/models";
import { formatVnd, parseApiDateTime } from "@/lib/helpers";

// Register Font for Vietnamese support
Font.register({
  family: 'Roboto',
  fonts: [
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-light-webfont.ttf', fontWeight: 300 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf', fontWeight: 400 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-medium-webfont.ttf', fontWeight: 500 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf', fontWeight: 700 },
  ]
});

const styles = StyleSheet.create({
  page: {
    padding: 6, // reduced from 8
    fontFamily: "Roboto",
    backgroundColor: "#ffffff",
  },
  container: {
    border: "1px solid #000000",
    flex: 1,
    flexDirection: "column",
  },
  // Header
  headerRow: {
    flexDirection: "row",
    borderBottom: "1px solid #000000",
    height: 60,
  },
  logoBox: {
    width: "35%",
    borderRight: "1px solid #000000",
    justifyContent: "center",
    alignItems: "center",
    padding: 4,
  },
  logoText: {
    fontSize: 18,
    fontWeight: 700,
    color: "#059669",
  },
  logoTopWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  logoSub: {
    fontSize: 7, // reduced from 8
    marginTop: 2,
  },
  barcodeBox: {
    width: "65%",
    justifyContent: "center",
    alignItems: "center",
    padding: 2, // reduced from 4
  },
  barcodeImage: {
    height: 25, // reduced from 30
    width: 140, // reduced from 150
  },
  barcodeTextRow: {
    marginTop: 2, // reduced from 4
    width: "80%",
  },
  // Address
  addressRow: {
    flexDirection: "row",
  },
  addressBox: {
    width: "50%",
    padding: 4, // reduced from 6
  },
  addressBoxRight: {
    borderLeft: "1px dashed #000000",
  },
  textNormal: {
    fontSize: 8, // reduced from 9
    lineHeight: 1.2, // reduced from 1.3
  },
  textBold: {
    fontSize: 8, // reduced from 9
    fontWeight: 700,
  },
  // Routing
  routingRow: {
    borderTop: "2px solid #000000",
    borderBottom: "2px solid #000000",
    padding: 6, // reduced from 8
    justifyContent: "center",
    alignItems: "center",
  },
  routingText: {
    fontSize: 22, // reduced from 26
    fontWeight: 700,
  },
  // Content
  contentRow: {
    flex: 1,
    flexDirection: "row",
    borderBottom: "1px solid #000000",
  },
  itemBox: {
    width: "70%",
    padding: 4, // reduced from 6
    borderRight: "1px dashed #000000",
    justifyContent: "space-between",
  },
  itemNote: {
    fontSize: 6, // reduced from 7
    color: "#555",
    marginTop: 4, // reduced from 10
  },
  rightCol: {
    width: "30%",
    flexDirection: "column",
  },
  qrWrapper: {
    flex: 1,
    padding: 4, // reduced from 6
    justifyContent: "center",
    alignItems: "center",
    borderBottom: "1px dashed #000000",
  },
  qrImage: {
    width: 55, // reduced from 65
    height: 55, // reduced from 65
  },
  dateWrapper: {
    padding: 4, // reduced from 6
    alignItems: "center",
    justifyContent: "center",
  },
  dateLabel: {
    fontSize: 6, // reduced from 7
    marginBottom: 2,
    color: "#555",
  },
  dateValue: {
    fontSize: 8, // reduced from 9
    fontWeight: 700,
    textAlign: "center",
  },
  // Footer
  footerRow: {
    flexDirection: "row",
    borderBottom: "1px solid #000000",
    flexShrink: 0,
  },
  footerLeft: {
    width: "50%",
    padding: 4, // reduced from 6
    borderRight: "1px solid #000000",
  },
  codText: {
    fontSize: 16, // reduced from 20
    fontWeight: 700,
    textAlign: "center",
    marginTop: 6, // reduced from 12
  },
  footerRight: {
    width: "50%",
  },
  weightBox: {
    padding: 2, // reduced from 4
    paddingLeft: 4, // reduced from 6
    borderBottom: "1px solid #000000",
  },
  signatureBox: {
    padding: 2, // reduced from 4
    alignItems: "center",
    flexShrink: 0,
  },
  signatureBoxInner: {
    width: "90%",
    height: 25,
    border: "1px solid #000000",
    marginTop: 2, // reduced from 4
  },
  bottomNotes: {
    padding: 2, // reduced from 4
    paddingLeft: 4, // reduced from 6
    flexShrink: 0,
  }
});

export interface ShippingLabelData {
  order: Order;
  barcodeDataUrl: string;
  qrCodeDataUrl: string;
  routingCode: string;
  logoUrl?: string;
}

export function ShippingLabelDocument({ labels }: { labels: ShippingLabelData[] }) {
  return (
    <Document>
      {labels.map(({ order, barcodeDataUrl, qrCodeDataUrl, routingCode, logoUrl }) => {
        const address = order.shipment;
        const codAmount = order.paymentStatus === "PAID" ? 0 : order.totalAmount;
        
        let maskedPhone = "N/A";
        if (address?.receiverPhone) {
          const p = address.receiverPhone;
          maskedPhone = p.length >= 7 ? p.slice(0, 4) + "***" + p.slice(-3) : p;
        }

        const dateObj = parseApiDateTime(order.createdAt) || new Date();
        const formatter = new Intl.DateTimeFormat("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false
        });
        const parts = formatter.formatToParts(dateObj).reduce((acc, part) => {
          acc[part.type] = part.value;
          return acc;
        }, {} as Record<string, string>);
        
        const dateStr = `${parts.day}-${parts.month}-${parts.year}`;
        const timeStr = `${parts.hour}:${parts.minute}`;
        
        const trackingCode = order.shipment?.trackingCode || order.orderCode;
        const providerName = order.shipment?.shippingProviderName || "SuperXpress";

        return (
          <Page key={order.id} size="A6" style={styles.page}>
            <View style={styles.container}>
              
              {/* Header */}
              <View style={styles.headerRow}>
                <View style={styles.logoBox}>
                  <Image src={typeof window !== "undefined" ? window.location.origin + "/images/platform/shepoo_logo.png" : "/images/platform/shepoo_logo.png"} style={{ width: 90, height: 28, objectFit: "contain" }} />
                  {logoUrl ? (
                    <Image src={logoUrl} style={{ width: 85, height: 28, objectFit: "contain", marginTop: -2 }} />
                  ) : (
                    <Text style={[styles.textBold, { marginTop: 0, color: "#333", fontSize: 10 }]}>{providerName}</Text>
                  )}
                </View>
                <View style={styles.barcodeBox}>
                  {barcodeDataUrl && <Image src={barcodeDataUrl} style={styles.barcodeImage} />}
                  <View style={styles.barcodeTextRow}>
                    <Text style={styles.textNormal}>Mã vận đơn:  <Text style={styles.textBold}>{trackingCode}</Text></Text>
                    <Text style={styles.textNormal}>Mã đơn hàng: <Text style={styles.textBold}>{order.orderCode}</Text></Text>
                  </View>
                </View>
              </View>

              {/* Addresses */}
              <View style={styles.addressRow}>
                <View style={styles.addressBox}>
                  <Text style={styles.textBold}>Từ:</Text>
                  <Text style={styles.textNormal}>{order.shopName || (order as any).seller?.shopName || "Tên Shop"}</Text>
                  <Text style={styles.textNormal}>{(order as any).seller?.pickupAddress || "Kho hàng người bán"}</Text>
                  <Text style={styles.textNormal}>SĐT: {(order as any).seller?.phone || "Liên hệ qua chat"}</Text>
                </View>
                <View style={[styles.addressBox, styles.addressBoxRight]}>
                  <Text style={styles.textBold}>Đến:</Text>
                  <Text style={styles.textNormal}>{address?.receiverName || "Khách hàng"}</Text>
                  <Text style={styles.textNormal}>
                    {address?.detailAddress}, {address?.ward}, {address?.district}, {address?.province}
                  </Text>
                  <Text style={styles.textNormal}>SĐT: {maskedPhone}</Text>
                </View>
              </View>

              {/* Routing */}
              <View style={styles.routingRow}>
                <Text style={styles.routingText}>{routingCode}</Text>
              </View>

              {/* Content & QR */}
              <View style={styles.contentRow}>
                <View style={styles.itemBox}>
                  <View>
                    <Text style={styles.textBold}>Nội dung hàng (Tổng SL sản phẩm: {order.items.reduce((s, i) => s + i.quantity, 0)})</Text>
                    {order.items.slice(0, 3).map((item, idx) => (
                      <Text key={idx} style={[styles.textNormal, { marginTop: 2 }]}>
                        {idx + 1}. {item.productNameSnapshot} {item.variantNameSnapshot !== "Default" ? `- ${item.variantNameSnapshot}` : ""}, SL: {item.quantity}
                      </Text>
                    ))}
                    {order.items.length > 3 && (
                      <Text style={[styles.textNormal, { marginTop: 2, color: "#555" }]}>
                        ... và {order.items.length - 3} sản phẩm khác
                      </Text>
                    )}
                    {order.customerNote && (
                      <Text style={[styles.textNormal, { marginTop: 4 }]}>
                        Ghi chú: {order.customerNote}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.itemNote}>
                    Kiểm tra tên sản phẩm và đối chiếu Mã vận đơn/Mã đơn hàng trên ứng dụng trước khi nhận hàng (Lưu ý: Một số sản phẩm có thể bị ẩn do danh sách quá dài).
                  </Text>
                </View>
                <View style={styles.rightCol}>
                  <View style={styles.qrWrapper}>
                    {qrCodeDataUrl && <Image src={qrCodeDataUrl} style={styles.qrImage} />}
                  </View>
                  <View style={styles.dateWrapper}>
                    <Text style={styles.dateLabel}>Ngày đặt hàng:</Text>
                    <Text style={styles.dateValue}>{dateStr}</Text>
                    <Text style={styles.dateValue}>{timeStr}</Text>
                  </View>
                </View>
              </View>

              {/* Footer */}
              <View style={{ flexDirection: "column" }}>
                <View style={styles.footerRow}>
                  <View style={styles.footerLeft}>
                    <Text style={styles.textNormal}>Tiền thu Người nhận:</Text>
                    <Text style={styles.codText}>{formatVnd(codAmount)}</Text>
                  </View>
                  <View style={styles.footerRight}>
                    <View style={styles.weightBox}>
                      <Text style={styles.textNormal}>Khối lượng tối đa: <Text style={styles.textBold}>300 g</Text></Text>
                    </View>
                    <View style={styles.signatureBox}>
                      <Text style={styles.textBold}>Chữ ký người nhận</Text>
                      <Text style={{ textAlign: "center", fontSize: 6.5, color: "#333", marginTop: 1, lineHeight: 1.1 }}>
                        Xác nhận hàng nguyên vẹn, không móp/méo, bể/vỡ
                      </Text>
                      <View style={styles.signatureBoxInner} />
                    </View>
                  </View>
                </View>
                <View style={styles.bottomNotes}>
                  <Text style={styles.textNormal}>
                    <Text style={styles.textBold}>Chỉ dẫn giao hàng: </Text>
                    Không đồng kiểm; Chuyển hoàn sau 3 lần phát; Lưu kho tối đa 5 ngày.
                  </Text>
                </View>
              </View>

            </View>
          </Page>
        );
      })}
    </Document>
  );
}
