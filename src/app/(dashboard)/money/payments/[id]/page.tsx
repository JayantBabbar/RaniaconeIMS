"use client";

// Re-uses the receipts detail under the hood — same Payment entity,
// just labelled differently. Keeping a dedicated route so the URL
// /money/payments/{id} works after navigation from the payments list.

import ReceiptDetailPage from "@/app/(dashboard)/money/receipts/[id]/page";

export default ReceiptDetailPage;
