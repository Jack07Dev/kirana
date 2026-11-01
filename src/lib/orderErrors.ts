import type { TFunction } from 'i18next';

const ERROR_KEYS: Record<string, string> = {
  unauthorized: 'orderErrorUnauthorized',
  empty_cart: 'orderErrorEmptyCart',
  store_not_found: 'orderErrorStoreNotFound',
  store_offline: 'orderErrorStoreOffline',
  store_closed: 'orderErrorStoreClosed',
  address_not_found: 'orderErrorAddressNotFound',
  address_not_serviceable: 'orderErrorNotServiceable',
  invalid_product: 'orderErrorInvalidProduct',
  invalid_quantity: 'orderErrorInvalidQuantity',
  out_of_stock: 'orderErrorOutOfStock',
  insufficient_stock: 'orderErrorInsufficientStock',
  khata_not_enabled: 'orderErrorKhataNotEnabled',
  khata_limit_exceeded: 'orderErrorKhataLimitExceeded',
  inventory_use_rpc: 'orderErrorInventoryRpc',
};

const MESSAGE_PATTERNS: Array<{ match: RegExp; key: string }> = [
  { match: /place_order_secure|preview_order_totals|could not find the function/i, key: 'orderErrorMigrations' },
  { match: /reorder_threshold|inventory_movements|approval_status/i, key: 'orderErrorMigrations' },
];

/** Map Postgres RPC / RAISE EXCEPTION messages to translated copy. */
export function resolveOrderError(t: TFunction, message: string | undefined): string {
  if (!message) return t('error');
  const code = message.split(':')[0]?.trim().toLowerCase();
  for (const { match, key } of MESSAGE_PATTERNS) {
    if (match.test(message)) return t(key);
  }
  const key = ERROR_KEYS[code] ?? ERROR_KEYS[message.trim().toLowerCase()];
  if (key) return t(key);
  return message;
}

export interface CheckoutPreview {
  ok: boolean;
  subtotal?: number;
  platform_fee?: number;
  delivery_fee?: number;
  total?: number;
  error?: string;
}

export function parseCheckoutPreview(raw: unknown): CheckoutPreview {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'unknown' };
  const o = raw as Record<string, unknown>;
  return {
    ok: o.ok === true,
    subtotal: o.subtotal != null ? Number(o.subtotal) : undefined,
    platform_fee: o.platform_fee != null ? Number(o.platform_fee) : undefined,
    delivery_fee: o.delivery_fee != null ? Number(o.delivery_fee) : undefined,
    total: o.total != null ? Number(o.total) : undefined,
    error: typeof o.error === 'string' ? o.error : undefined,
  };
}
