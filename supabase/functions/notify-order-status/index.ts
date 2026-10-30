import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STATUS_HI: Record<string, string> = {
  pending: 'लंबित',
  accepted: 'स्वीकृत',
  rejected: 'अस्वीकृत',
  out_for_delivery: 'डिलीवरी पर',
  delivered: 'पहुँचा दिया',
  cancelled: 'रद्द',
};

const STATUS_EN: Record<string, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
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

    const { order_id, status } = (await req.json()) as {
      order_id: string;
      status: string;
    };

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: order } = await admin
      .from('orders')
      .select('id, order_number, customer_id, store_id')
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
      .select('owner_id')
      .eq('id', order.store_id)
      .single();

    if (store?.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: customer } = await admin
      .from('users')
      .select('push_token, preferred_lang')
      .eq('id', order.customer_id)
      .single();

    if (!customer?.push_token) {
      return new Response(JSON.stringify({ ok: true, pushed: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const hi = customer.preferred_lang === 'hi';
    const label = hi ? STATUS_HI[status] ?? status : STATUS_EN[status] ?? status;
    const title = hi ? 'ऑर्डर अपडेट' : 'Order update';
    const body = `${order.order_number}: ${label}`;

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: customer.push_token,
        title,
        body,
        sound: 'default',
        data: { orderId: order_id, status },
      }),
    });

    return new Response(JSON.stringify({ ok: true, pushed: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
