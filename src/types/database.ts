export type UserRole = 'customer' | 'store_owner';
export type StoreType = 'kirana' | 'sabzi' | 'medical' | 'restaurant' | 'other';
export type StockStatus = 'in_stock' | 'out_of_stock' | 'low_stock';
export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';
export type PaymentMethod = 'cod' | 'upi' | 'khata';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type KhataEntryType = 'debit' | 'credit' | 'adjustment';
export type ReminderCycle = 'weekly' | 'monthly' | 'none';

export interface User {
  id: string;
  phone: string;
  full_name: string | null;
  role: UserRole | null;
  avatar_url: string | null;
  preferred_lang: 'hi' | 'en';
  push_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpeningHoursDay {
  open: string;
  close: string;
  closed?: boolean;
}

export type OpeningHours = Record<
  'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun',
  OpeningHoursDay
>;

export interface Store {
  id: string;
  owner_id: string;
  name: string;
  store_type: StoreType;
  description: string | null;
  address_line: string;
  city: string | null;
  pincode: string | null;
  /** WKT or GeoJSON point — app stores lat/lng separately */
  location: unknown;
  lat?: number;
  lng?: number;
  photo_url: string | null;
  opening_hours: OpeningHours;
  delivery_radius_m: number;
  is_online: boolean;
  upi_id: string | null;
  platform_fee: number;
  created_at: string;
  updated_at: string;
  distance_m?: number;
}

export interface CatalogItem {
  id: string;
  name_en: string;
  name_hi: string;
  brand: string | null;
  category: string;
  unit: string;
  default_mrp: number | null;
  barcode: string | null;
  image_url: string | null;
  store_types: StoreType[];
}

export interface Product {
  id: string;
  store_id: string;
  catalog_id: string | null;
  name: string;
  name_hi: string | null;
  brand: string | null;
  category: string | null;
  photo_url: string | null;
  barcode: string | null;
  unit: string;
  mrp: number;
  selling_price: number;
  discount_pct: number;
  stock_status: StockStatus;
  stock_qty: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Address {
  id: string;
  user_id: string;
  label: string;
  house_no: string;
  landmark: string | null;
  address_line: string;
  contact_phone: string;
  location: unknown;
  lat?: number;
  lng?: number;
  is_default: boolean;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  store_id: string;
  customer_id: string;
  address_id: string;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  subtotal: number;
  delivery_fee: number;
  platform_fee: number;
  discount_total: number;
  total: number;
  notes: string | null;
  rejection_reason: string | null;
  accepted_at: string | null;
  out_for_delivery_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
  store?: Store;
  items?: OrderItem[];
  address?: Address;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  unit: string;
  quantity: number;
  mrp: number;
  selling_price: number;
  line_total: number;
}

export interface KhataAccount {
  id: string;
  store_id: string;
  customer_id: string;
  credit_limit: number;
  balance: number;
  is_enabled: boolean;
  reminder_cycle: ReminderCycle;
  last_reminder_at: string | null;
  created_at: string;
  updated_at: string;
  store?: Store;
  customer?: User;
}

export interface KhataLedgerEntry {
  id: string;
  account_id: string;
  entry_type: KhataEntryType;
  amount: number;
  balance_after: number;
  order_id: string | null;
  payment_id: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  order_id: string | null;
  khata_account_id: string | null;
  store_id: string;
  customer_id: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  upi_txn_id: string | null;
  note: string | null;
  created_at: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface NearbyStore extends Store {
  distance_m: number;
}
