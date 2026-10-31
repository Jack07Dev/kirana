/** Build UPI deep link / QR payload (NPCI-style). */
export function buildUpiPayUri(vpa: string, amount: number, note: string): string {
  const pa = vpa.trim();
  const params = new URLSearchParams({
    pa,
    am: amount.toFixed(2),
    cu: 'INR',
    tn: note.slice(0, 80),
  });
  return `upi://pay?${params.toString()}`;
}
