import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { order_id, store_id } = (await req.json()) as {
      order_id: string;
      store_id: string;
    };

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select('id, order_number, total, customer_id, store_id')
      .eq('id', order_id)
      .single();

    if (orderErr || !order || order.store_id !== store_id) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (order.customer_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: store } = await admin
      .from('stores')
      .select('name, owner_id')
      .eq('id', store_id)
      .single();

    const { data: owner } = await admin
      .from('users')
      .select('push_token, preferred_lang')
      .eq('id', store?.owner_id)
      .single();

    if (!owner?.push_token) {
      return new Response(JSON.stringify({ ok: true, pushed: false, reason: 'no_push_token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const hi = owner.preferred_lang === 'hi';
    const title = hi ? 'नया ऑर्डर' : 'New order';
    const body = hi
      ? `${order.order_number} · ₹${order.total}`
      : `${order.order_number} · ₹${order.total}`;

    const pushRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: owner.push_token,
        title,
        body,
        sound: 'default',
        priority: 'high',
        data: { orderId: order_id, storeId: store_id },
      }),
    });

    const pushJson = await pushRes.json();

    return new Response(JSON.stringify({ ok: true, pushed: true, expo: pushJson }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
