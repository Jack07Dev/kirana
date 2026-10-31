export const UPI_PAYMENT_WINDOW_MS = 5 * 60 * 1000;

export function getUpiPaymentExpiresAt(order: {
  payment_expires_at?: string | null;
  created_at: string;
}): number {
  if (order.payment_expires_at) {
    return new Date(order.payment_expires_at).getTime();
  }
  return new Date(order.created_at).getTime() + UPI_PAYMENT_WINDOW_MS;
}

export function upiPaymentSecondsLeft(order: {
  payment_expires_at?: string | null;
  created_at: string;
}): number {
  return Math.max(0, Math.floor((getUpiPaymentExpiresAt(order) - Date.now()) / 1000));
}

export function formatPaymentCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function isUpiPaymentWindowExpired(order: {
  payment_expires_at?: string | null;
  created_at: string;
  payment_status: string;
}): boolean {
  if (order.payment_status === 'paid') return false;
  return Date.now() >= getUpiPaymentExpiresAt(order);
}
