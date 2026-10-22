import type { Kendra } from "@/lib/schemas";

/** Build and download a PDF of the agent-collected Jan Aushadhi kendras. */
export async function downloadKendraPdf(kendras: Kendra[], pincode: string): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 42;
  const maxWidth = pageWidth - margin * 2;
  let y = 52;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Jan Aushadhi Kendras", margin, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`Near pincode ${pincode}  |  ${kendras.length} locations`, margin, y);
  y += 14;
  doc.text("Source: janaushadhi.gov.in/near-by-kendra (live browser agent)", margin, y);
  y += 22;
  doc.setTextColor(0);

  kendras.forEach((kendra, index) => {
    const addressLines = doc.splitTextToSize(kendra.address, maxWidth - 20) as string[];
    const meta = [
      kendra.kendra_code ? `Code: ${kendra.kendra_code}` : null,
      kendra.owner_name ? `Owner: ${kendra.owner_name}` : null,
      kendra.district || kendra.state ? [kendra.district, kendra.state].filter(Boolean).join(", ") : null,
      kendra.pincode ? `PIN ${kendra.pincode}` : null,
    ].filter(Boolean) as string[];
    const metaLines = meta.length ? (doc.splitTextToSize(meta.join("  |  "), maxWidth - 20) as string[]) : [];
    const blockHeight = 30 + addressLines.length * 13 + metaLines.length * 12 + (kendra.phone ? 13 : 0);

    if (y + blockHeight > pageHeight - 50) {
      doc.addPage();
      y = margin;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    const title = `${index + 1}. ${kendra.name}`;
    doc.text(doc.splitTextToSize(title, maxWidth - 70) as string[], margin, y);

    if (kendra.distance_km != null) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(80);
      doc.text(`${kendra.distance_km} km`, pageWidth - margin, y, { align: "right" });
      doc.setTextColor(0);
    }

    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(55);
    for (const line of addressLines) {
      doc.text(line, margin + 14, y);
      y += 12;
    }
    doc.setFontSize(8.5);
    for (const line of metaLines) {
      doc.text(line, margin + 14, y);
      y += 11;
    }
    doc.setFontSize(9.5);
    if (kendra.phone) {
      doc.text(`Phone: ${kendra.phone}`, margin + 14, y);
      y += 12;
    }
    doc.setTextColor(0);
    y += 8;
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(110);
  doc.text(
    "Generated from live locator data. Confirm the kendra address and timings before visiting.",
    margin,
    pageHeight - 26,
  );

  const safePin = pincode.replace(/[^0-9]/g, "") || "india";
  doc.save(`jan-aushadhi-kendras-${safePin}.pdf`);
}
