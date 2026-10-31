import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type EventType = 'order_placed_customer' | 'payment_claimed' | 'payment_confirmed';

async function sendExpoPush(
  token: string,
  title: string,
  body: string,
  data: Record<string, string>
) {
  const pushRes = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: token,
      title,
      body,
      sound: 'default',
      priority: 'high',
      data,
    }),
  });
  return pushRes.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { event, order_id } = (await req.json()) as {
      event: EventType;
      order_id: string;
    };

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: order } = await admin
      .from('orders')
      .select('id, order_number, total, customer_id, store_id, payment_method')
      .eq('id', order_id)
      .single();

    if (!order) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: store } = await admin
      .from('stores')
      .select('name, owner_id')
      .eq('id', order.store_id)
      .single();

    if (event === 'order_placed_customer' || event === 'payment_claimed') {
      if (order.customer_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (event === 'payment_confirmed') {
      if (store?.owner_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    let targetUserId: string | undefined;
    let hi = false;

    if (event === 'order_placed_customer') {
      targetUserId = order.customer_id;
    } else if (event === 'payment_claimed') {
      targetUserId = store?.owner_id;
    } else if (event === 'payment_confirmed') {
      targetUserId = order.customer_id;
    }

    if (!targetUserId) {
      return new Response(JSON.stringify({ ok: true, pushed: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: target } = await admin
      .from('users')
      .select('push_token, preferred_lang')
      .eq('id', targetUserId)
      .single();

    if (!target?.push_token) {
      return new Response(JSON.stringify({ ok: true, pushed: false, reason: 'no_push_token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    hi = target.preferred_lang === 'hi';

    let title = '';
    let body = '';

    switch (event) {
      case 'order_placed_customer':
        title = hi ? 'ऑर्डर मिल गया' : 'Order received';
        body = hi
          ? `${order.order_number} · ${store?.name ?? ''} · ₹${order.total}`
          : `${order.order_number} · ${store?.name ?? ''} · ₹${order.total}`;
        break;
      case 'payment_claimed':
        title = hi ? 'भुगतान जाँचें' : 'Verify payment';
        body = hi
          ? `${order.order_number} · ग्राहक ने UPI भेजा होगा · ₹${order.total}`
          : `${order.order_number} · Customer marked paid · ₹${order.total}`;
        break;
      case 'payment_confirmed':
        title = hi ? 'भुगतान सफल' : 'Payment confirmed';
        body = hi
          ? `${order.order_number} · ₹${order.total} · ${store?.name ?? ''}`
          : `${order.order_number} · ₹${order.total} · ${store?.name ?? ''}`;
        break;
    }

    const expo = await sendExpoPush(target.push_token, title, body, {
      orderId: order_id,
      event,
    });

    return new Response(JSON.stringify({ ok: true, pushed: true, expo }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
