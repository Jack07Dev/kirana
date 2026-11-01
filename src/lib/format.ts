export function formatINR(amount: number, compact = false): string {
  if (compact && amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`;
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return phone;
}

export function toE164India(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
  if (phone.startsWith('+')) return phone;
  return `+${digits}`;
}

export const ORDER_STATUS_LABELS: Record<
  string,
  { en: string; hi: string; color: string }
> = {
  pending: { en: 'Pending', hi: 'लंबित', color: '#D97706' },
  accepted: { en: 'Accepted', hi: 'स्वीकृत', color: '#0B6E4F' },
  preparing: { en: 'Preparing', hi: 'तैयार हो रहा', color: '#0B6E4F' },
  packed: { en: 'Packed', hi: 'पैक हो गया', color: '#059669' },
  rejected: { en: 'Rejected', hi: 'अस्वीकृत', color: '#C0392B' },
  out_for_delivery: { en: 'Out for delivery', hi: 'डिलीवरी पर', color: '#2563EB' },
  delivered: { en: 'Delivered', hi: 'डिलीवर', color: '#1B9C6E' },
  cancelled: { en: 'Cancelled', hi: 'रद्द', color: '#9CA3AF' },
};

export const CATEGORIES = [
  { id: 'staples', en: 'Staples', hi: 'राशन' },
  { id: 'dairy', en: 'Dairy', hi: 'डेयरी' },
  { id: 'snacks', en: 'Snacks', hi: 'नाश्ता' },
  { id: 'beverages', en: 'Beverages', hi: 'पेय' },
  { id: 'personal_care', en: 'Personal Care', hi: 'व्यक्तिगत देखभाल' },
  { id: 'household', en: 'Household', hi: 'घरेलू' },
  { id: 'other', en: 'Other', hi: 'अन्य' },
];
