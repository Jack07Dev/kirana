import { useCallback, useEffect } from 'react';
import { fetchOrder } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { Order } from '../types/database';

/** Realtime + periodic refetch so payment status stays in sync on both phones. */
export function useOrderLiveSync(orderId: string | undefined, setOrder: (order: Order | null) => void) {
  const reload = useCallback(() => {
    if (!orderId) return;
    void fetchOrder(orderId).then(({ data }) => {
      if (data) setOrder(data);
    });
  }, [orderId, setOrder]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!orderId) return;

    const channel = supabase
      .channel(`order-live-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        () => {
          reload();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orderId, reload]);

  useEffect(() => {
    if (!orderId) return;
    const poll = setInterval(reload, 4000);
    return () => clearInterval(poll);
  }, [orderId, reload]);

  return { reload };
}
