import { supabase, geoPoint } from './supabase';
import { parseLocation } from './geo';
import { attachStoreCoordinates } from './storeCoords';
import type {
  Address,
  CatalogItem,
  DeliveryAssignment,
  DeliveryPartner,
  InventoryMovement,
  KhataAccount,
  KhataLedgerEntry,
  NearbyStore,
  OpeningHours,
  Order,
  OrderStatus,
  PaymentMethod,
  Product,
  StockStatus,
  Store,
  StoreType,
} from '../types/database';

// ─── Stores ──────────────────────────────────────────────

export async function createStore(input: {
  owner_id: string;
  name: string;
  address_line: string;
  lat: number;
  lng: number;
  delivery_radius_m: number;
  photo_url?: string;
  upi_id?: string;
  opening_hours?: OpeningHours;
  store_type?: StoreType;
  city?: string;
  pincode?: string;
}) {
  const { data, error } = await supabase
    .from('stores')
    .insert({
      owner_id: input.owner_id,
      name: input.name,
      address_line: input.address_line,
      location: geoPoint(input.lat, input.lng),
      delivery_radius_m: input.delivery_radius_m,
      photo_url: input.photo_url ?? null,
      upi_id: input.upi_id ?? null,
      opening_hours: input.opening_hours,
      store_type: input.store_type ?? 'kirana',
      city: input.city ?? null,
      pincode: input.pincode ?? null,
      is_online: false,
      platform_fee: 0,
    })
    .select()
    .single();
  return { data: data as Store | null, error };
}

export async function updateStore(
  storeId: string,
  patch: Partial<{
    name: string;
    address_line: string;
    delivery_radius_m: number;
    photo_url: string;
    upi_id: string;
    opening_hours: OpeningHours;
    is_online: boolean;
    lat: number;
    lng: number;
  }>
) {
  const body: Record<string, unknown> = { ...patch };
  if (patch.lat != null && patch.lng != null) {
    body.location = geoPoint(patch.lat, patch.lng);
    delete body.lat;
    delete body.lng;
  }
  const { data, error } = await supabase
    .from('stores')
    .update(body)
    .eq('id', storeId)
    .select()
    .single();
  return { data: data as Store | null, error };
}

export async function fetchNearbyStores(
  lat: number,
  lng: number
): Promise<NearbyStore[]> {
  const { data, error } = await supabase.rpc('nearby_stores', {
    customer_lat: lat,
    customer_lng: lng,
    max_results: 50,
  });
  if (error) {
    // Fallback: client-side filter if RPC unavailable
    const { data: stores } = await supabase
      .from('stores')
      .select('*')
      .eq('is_online', true);
    const { distanceMeters } = await import('./geo');
    return (stores ?? [])
      .map((s) => {
        const loc = parseLocation(s.location);
        if (!loc) return null;
        const d = distanceMeters(lat, lng, loc.lat, loc.lng);
        if (d > s.delivery_radius_m) return null;
        return { ...s, lat: loc.lat, lng: loc.lng, distance_m: d } as NearbyStore;
      })
      .filter(Boolean) as NearbyStore[];
  }
  const list = (data ?? []) as NearbyStore[];
  return attachStoreCoordinates(list);
}

// ─── Products ────────────────────────────────────────────

export async function fetchCatalog(search?: string, category?: string) {
  let q = supabase.from('catalog').select('*').order('name_en');
  if (category) q = q.eq('category', category);
  if (search) q = q.or(`name_en.ilike.%${search}%,name_hi.ilike.%${search}%,barcode.eq.${search}`);
  const { data, error } = await q.limit(100);
  return { data: (data ?? []) as CatalogItem[], error };
}

export async function fetchStoreProducts(storeId: string) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('name');
  return { data: (data ?? []) as Product[], error };
}

export async function upsertProduct(
  product: Partial<Product> & {
    store_id: string;
    name: string;
    mrp: number;
    selling_price: number;
  }
) {
  const { data, error } = await supabase
    .from('products')
    .upsert(product)
    .select()
    .single();
  return { data: data as Product | null, error };
}

export async function setStockStatus(productId: string, status: StockStatus) {
  const { data, error } = await supabase.rpc('owner_set_stock_status', {
    p_product_id: productId,
    p_status: status,
    p_note: null,
  });
  return { data: data as Product | null, error };
}

export async function adjustProductStock(
  productId: string,
  delta: number,
  note?: string
) {
  const { data, error } = await supabase.rpc('owner_adjust_stock', {
    p_product_id: productId,
    p_delta: delta,
    p_note: note ?? null,
  });
  return { data: data as Product | null, error };
}

export async function setProductStockQty(
  productId: string,
  newQty: number,
  note?: string
) {
  const { data, error } = await supabase.rpc('owner_set_stock_qty', {
    p_product_id: productId,
    p_new_qty: newQty,
    p_note: note ?? null,
  });
  return { data: data as Product | null, error };
}

export async function setProductReorderThreshold(productId: string, threshold: number) {
  const { data, error } = await supabase.rpc('owner_set_reorder_threshold', {
    p_product_id: productId,
    p_threshold: threshold,
  });
  return { data: data as Product | null, error };
}

export async function fetchInventoryMovements(productId: string, limit = 50) {
  const { data, error } = await supabase
    .from('inventory_movements')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return { data: (data ?? []) as InventoryMovement[], error };
}

export async function fetchLowStockProducts(storeId: string) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .in('stock_status', ['low_stock', 'out_of_stock'])
    .order('stock_status', { ascending: true })
    .order('name')
    .limit(20);
  return { data: (data ?? []) as Product[], error };
}

export async function bulkInsertProducts(
  rows: Array<{
    store_id: string;
    name: string;
    mrp: number;
    selling_price: number;
    unit?: string;
    category?: string;
    barcode?: string;
  }>
) {
  return supabase.from('products').insert(rows);
}

export async function findCatalogByBarcode(barcode: string) {
  const { data } = await supabase
    .from('catalog')
    .select('*')
    .eq('barcode', barcode)
    .maybeSingle();
  return data as CatalogItem | null;
}

// ─── Addresses ───────────────────────────────────────────

export async function fetchAddresses(userId: string) {
  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false });
  const list = ((data ?? []) as Address[]).map((a) => {
    const loc = parseLocation(a.location);
    return { ...a, ...loc };
  });
  return { data: list, error };
}

export async function createAddress(input: {
  user_id: string;
  label: string;
  house_no: string;
  landmark?: string;
  address_line: string;
  contact_phone: string;
  lat: number;
  lng: number;
  is_default?: boolean;
}) {
  if (input.is_default) {
    await supabase
      .from('addresses')
      .update({ is_default: false })
      .eq('user_id', input.user_id);
  }
  const { data, error } = await supabase
    .from('addresses')
    .insert({
      user_id: input.user_id,
      label: input.label,
      house_no: input.house_no,
      landmark: input.landmark ?? null,
      address_line: input.address_line,
      contact_phone: input.contact_phone,
      location: geoPoint(input.lat, input.lng),
      is_default: input.is_default ?? false,
    })
    .select()
    .single();
  return { data: data as Address | null, error };
}

// ─── Orders ──────────────────────────────────────────────

export async function previewOrderTotals(input: {
  store_id: string;
  address_id: string;
  items: Array<{ product_id: string; quantity: number }>;
}) {
  const { data, error } = await supabase.rpc('preview_order_totals', {
    p_store_id: input.store_id,
    p_address_id: input.address_id,
    p_items: input.items,
  });
  return { data, error };
}

/** Server-validated checkout — prices, fees, stock, serviceability, khata. */
export async function placeOrder(input: {
  store_id: string;
  address_id: string;
  payment_method: PaymentMethod;
  notes?: string;
  items: Array<{
    product_id: string;
    quantity: number;
  }>;
}) {
  const { data: order, error } = await supabase.rpc('place_order_secure', {
    p_store_id: input.store_id,
    p_address_id: input.address_id,
    p_payment_method: input.payment_method,
    p_notes: input.notes ?? null,
    p_items: input.items,
  });

  if (error || !order) return { data: null, error };

  const placed = order as Order;

  void supabase.functions.invoke('notify-order', {
    body: { order_id: placed.id, store_id: input.store_id },
  });

  return { data: placed, error: null };
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  rejection_reason?: string
) {
  const { data, error } = await supabase.rpc('owner_update_order_status', {
    p_order_id: orderId,
    p_status: status,
    p_rejection_reason: rejection_reason ?? null,
  });

  if (!error && data) {
    if (status !== 'pending') {
      void supabase.functions.invoke('notify-order-status', {
        body: { order_id: orderId, status },
      });
    }
    return { data: data as Order, error: null };
  }

  const patch: Record<string, unknown> = { status };
  if (status === 'accepted') patch.accepted_at = new Date().toISOString();
  if (status === 'out_for_delivery')
    patch.out_for_delivery_at = new Date().toISOString();
  if (status === 'delivered') {
    patch.delivered_at = new Date().toISOString();
    patch.payment_status = 'paid';
  }
  if (status === 'rejected') patch.rejection_reason = rejection_reason ?? null;

  const result = await supabase.from('orders').update(patch).eq('id', orderId).select().single();

  if (!result.error && status !== 'pending') {
    void supabase.functions.invoke('notify-order-status', {
      body: { order_id: orderId, status },
    });
  }

  return result;
}

export async function assignOrderDelivery(orderId: string, partnerId: string) {
  const { data, error } = await supabase.rpc('assign_order_delivery', {
    p_order_id: orderId,
    p_partner_id: partnerId,
  });
  if (!error) {
    void supabase.functions.invoke('notify-order-status', {
      body: { order_id: orderId, status: 'out_for_delivery' },
    });
  }
  return { data, error };
}

export async function registerDeliveryPartner(phone: string, displayName: string) {
  const { data, error } = await supabase.rpc('owner_register_delivery_partner', {
    p_phone: phone,
    p_display_name: displayName,
  });
  return { data: data as DeliveryPartner | null, error };
}

export async function fetchDeliveryPartners(storeId: string) {
  const { data, error } = await supabase
    .from('delivery_partners')
    .select('*')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .order('display_name');
  return { data: (data ?? []) as DeliveryPartner[], error };
}

export async function linkDeliveryPartnerUser() {
  return supabase.rpc('link_delivery_partner_user');
}

export async function fetchPartnerAssignments() {
  const { data, error } = await supabase
    .from('delivery_assignments')
    .select(
      '*, order:orders(*, items:order_items(*), address:addresses(*), store:stores(name, address_line))'
    )
    .order('assigned_at', { ascending: false })
    .limit(50);
  return { data: data ?? [], error };
}

export async function partnerMarkPickedUp(orderId: string) {
  return supabase.rpc('partner_mark_picked_up', { p_order_id: orderId });
}

export async function partnerVerifyDelivery(orderId: string, otp: string) {
  const { data, error } = await supabase.rpc('partner_verify_delivery', {
    p_order_id: orderId,
    p_otp: otp.replace(/\D/g, ''),
  });
  if (!error) {
    void supabase.functions.invoke('notify-order-status', {
      body: { order_id: orderId, status: 'delivered' },
    });
  }
  return { data: data as Order | null, error };
}

export async function fetchOrderStatusHistory(orderId: string) {
  const { data, error } = await supabase
    .from('order_status_history')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });
  return { data: data ?? [], error };
}

export async function fetchStoreOrders(storeId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('*, items:order_items(*)')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(100);
  return { data: (data ?? []) as Order[], error };
}

export async function fetchCustomerOrders(customerId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('*, items:order_items(*), store:stores(id,name,photo_url)')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(50);
  return { data: (data ?? []) as Order[], error };
}

export async function cancelCustomerOrder(orderId: string) {
  return supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', orderId)
    .eq('status', 'pending')
    .select()
    .single();
}

export async function fetchOrder(orderId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select(
      '*, items:order_items(*), store:stores(*), address:addresses(*), delivery:delivery_assignments(*)'
    )
    .eq('id', orderId)
    .single();
  if (error || !data) return { data: data as Order | null, error };

  const order = data as Order & { delivery?: DeliveryAssignment[] | DeliveryAssignment | null };
  const delivery = Array.isArray(order.delivery)
    ? order.delivery[0] ?? null
    : order.delivery ?? null;

  const { data: history } = await fetchOrderStatusHistory(orderId);
  return {
    data: { ...order, delivery, status_history: history ?? [] } as Order,
    error: null,
  };
}

export async function ownerDashboard(storeId: string) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const { data: orders } = await supabase
    .from('orders')
    .select('id,total,status,created_at')
    .eq('store_id', storeId)
    .gte('created_at', start.toISOString());

  const todayOrders = orders?.length ?? 0;
  const todaySales =
    orders
      ?.filter((o) =>
        ['accepted', 'preparing', 'packed', 'out_for_delivery', 'delivered'].includes(o.status)
      )
      .reduce((s, o) => s + Number(o.total), 0) ?? 0;
  const pending =
    orders?.filter((o) => o.status === 'pending').length ?? 0;

  const { data: khata } = await supabase
    .from('khata_accounts')
    .select('balance')
    .eq('store_id', storeId)
    .gt('balance', 0);

  const pendingKhata =
    khata?.reduce((s, k) => s + Number(k.balance), 0) ?? 0;

  const { data: lowStock } = await supabase
    .from('products')
    .select('id')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .in('stock_status', ['low_stock', 'out_of_stock']);

  return {
    todayOrders,
    todaySales,
    pending,
    pendingKhata,
    lowStockCount: lowStock?.length ?? 0,
  };
}

// ─── Khata ───────────────────────────────────────────────

export async function fetchStoreKhata(storeId: string) {
  const { data, error } = await supabase
    .from('khata_accounts')
    .select('*, customer:users(id,full_name,phone)')
    .eq('store_id', storeId)
    .order('balance', { ascending: false });
  return { data: (data ?? []) as KhataAccount[], error };
}

export async function fetchCustomerKhata(customerId: string) {
  const { data, error } = await supabase
    .from('khata_accounts')
    .select('*, store:stores(id,name,upi_id)')
    .eq('customer_id', customerId);
  return { data: (data ?? []) as KhataAccount[], error };
}

export async function upsertKhataAccount(input: {
  store_id: string;
  customer_id: string;
  credit_limit: number;
  is_enabled: boolean;
  reminder_cycle?: 'weekly' | 'monthly' | 'none';
}) {
  return supabase
    .from('khata_accounts')
    .upsert(input, { onConflict: 'store_id,customer_id' })
    .select()
    .single();
}

export async function recordKhataPayment(input: {
  account_id: string;
  store_id: string;
  customer_id: string;
  amount: number;
  method: PaymentMethod;
  note?: string;
  upi_txn_id?: string;
  created_by: string;
}) {
  const { data: acc } = await supabase
    .from('khata_accounts')
    .select('*')
    .eq('id', input.account_id)
    .single();
  if (!acc) return { error: { message: 'Account not found' } };

  const { data: payment, error: payErr } = await supabase
    .from('payments')
    .insert({
      khata_account_id: input.account_id,
      store_id: input.store_id,
      customer_id: input.customer_id,
      amount: input.amount,
      method: input.method,
      status: 'paid',
      upi_txn_id: input.upi_txn_id ?? null,
      note: input.note ?? null,
    })
    .select()
    .single();
  if (payErr) return { error: payErr };

  const balance = Math.max(0, Number(acc.balance) - input.amount);
  await supabase
    .from('khata_accounts')
    .update({ balance })
    .eq('id', input.account_id);

  await supabase.from('khata_ledger').insert({
    account_id: input.account_id,
    entry_type: 'credit',
    amount: input.amount,
    balance_after: balance,
    payment_id: payment.id,
    note: input.note ?? 'Payment received',
    created_by: input.created_by,
  });

  return { data: payment, error: null };
}

export async function fetchLedger(accountId: string) {
  const { data, error } = await supabase
    .from('khata_ledger')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });
  return { data: (data ?? []) as KhataLedgerEntry[], error };
}

export async function toggleFavourite(userId: string, storeId: string, on: boolean) {
  if (on) {
    return supabase.from('favourite_stores').insert({ user_id: userId, store_id: storeId });
  }
  return supabase
    .from('favourite_stores')
    .delete()
    .eq('user_id', userId)
    .eq('store_id', storeId);
}

export async function fetchFavourites(userId: string) {
  const { data } = await supabase
    .from('favourite_stores')
    .select('store_id, store:stores(*)')
    .eq('user_id', userId);
  const stores: Store[] = [];
  for (const row of data ?? []) {
    const s = row.store as unknown as Store | null;
    if (s) stores.push(s);
  }
  return stores;
}
