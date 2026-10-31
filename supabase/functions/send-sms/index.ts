import { Webhook } from 'standardwebhooks';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, webhook-id, webhook-timestamp, webhook-signature',
};

type HookPayload = {
  user?: { phone?: string };
  sms?: { otp?: string };
};

function padBase64(input: string): string {
  const mod = input.length % 4;
  if (mod === 0) return input;
  return input + '='.repeat(4 - mod);
}

/** Derive Standard Webhooks secret bytes (Supabase uses v1,whsec_<base64>). */
function secretCandidatesFromRaw(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const out = new Set<string>();
  const add = (s: string) => {
    const t = s.trim();
    if (t) {
      out.add(t);
      out.add(padBase64(t));
    }
  };

  // Official Supabase doc: strip v1,whsec_ prefix once
  add(trimmed.replace(/^v1,whsec_/, '').replace(/^whsec_/, ''));

  const idx = trimmed.lastIndexOf('whsec_');
  if (idx !== -1) {
    add(trimmed.slice(idx + 'whsec_'.length));
  }

  return [...out];
}

function allHookSecretCandidates(): string[] {
  const combined =
    Deno.env.get('SEND_SMS_HOOK_SECRET') ??
    Deno.env.get('SEND_SMS_HOOK_SECRETS') ??
    '';
  const parts = combined.includes('|')
    ? combined.split('|').map((s) => s.trim()).filter(Boolean)
    : [combined.trim()].filter(Boolean);

  const candidates = new Set<string>();
  for (const part of parts) {
    for (const c of secretCandidatesFromRaw(part)) {
      candidates.add(c);
    }
  }
  return [...candidates];
}

function webhookHeaders(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

function verifyPayload(payload: string, req: Request): HookPayload {
  const skip = Deno.env.get('SKIP_SMS_HOOK_VERIFY') === 'true';
  if (skip) {
    console.warn('SKIP_SMS_HOOK_VERIFY=true — signature check disabled (debug only)');
    return JSON.parse(payload) as HookPayload;
  }

  const candidates = allHookSecretCandidates();
  if (candidates.length === 0) {
    throw new Error('Missing SEND_SMS_HOOK_SECRET (or set SKIP_SMS_HOOK_VERIFY=true for debug)');
  }

  const headers = webhookHeaders(req);
  if (!headers['webhook-signature'] || !headers['webhook-id'] || !headers['webhook-timestamp']) {
    throw new Error(
      'Missing webhook-id / webhook-timestamp / webhook-signature (is Send SMS Hook enabled in Auth?)'
    );
  }

  let lastErr = '';
  for (const secret of candidates) {
    const wh = new Webhook(secret);
    try {
      return wh.verify(payload, headers) as HookPayload;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }

  throw new Error(
    `Webhook signature invalid: ${lastErr}. Dashboard → Auth → Hooks → Send SMS secret must match SEND_SMS_HOOK_SECRET exactly (single v1,whsec_ prefix; use single quotes in CLI if secret contains +).`
  );
}

function indiaMobileTenDigits(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 10) return digits;
  return digits.slice(-10);
}

async function sendViaFast2sms(otp: string, phoneE164: string): Promise<void> {
  const apiKey = Deno.env.get('FAST2SMS_API_KEY');
  if (!apiKey) {
    throw new Error('FAST2SMS_API_KEY not set on Edge Function');
  }

  const numbers = indiaMobileTenDigits(phoneE164);
  if (numbers.length !== 10) {
    throw new Error(`Invalid mobile from ${phoneE164}`);
  }

  const message = encodeURIComponent(`Kirana OTP: ${otp}. Do not share.`);
  const url = `https://www.fast2sms.com/dev/bulkV2?route=q&message=${message}&language=english&numbers=${numbers}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { authorization: apiKey },
  });

  const text = await res.text();
  console.log('Fast2SMS response', res.status, text.slice(0, 500));

  if (!res.ok) {
    throw new Error(`Fast2SMS HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  let json: { return?: boolean; message?: string[] | string; status_code?: number };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Fast2SMS bad JSON: ${text.slice(0, 200)}`);
  }

  if (json.return === false || (json.status_code !== undefined && json.status_code !== 200)) {
    const msg = Array.isArray(json.message) ? json.message.join(', ') : String(json.message ?? text);
    if (json.status_code === 999 || msg.includes('100 INR')) {
      throw new Error(
        'Fast2SMS: Add at least ₹100 to your Fast2SMS wallet once (required before API route works).'
      );
    }
    if (json.status_code === 427 || msg.toLowerCase().includes('dnd')) {
      throw new Error(
        'Fast2SMS: This number is blocked (DND) or invalid for Quick SMS. Use your real +91 mobile, not a fake test number like 9876543210.'
      );
    }
    throw new Error(`Fast2SMS: ${msg}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const payload = await req.text();
    const data = verifyPayload(payload, req);

    const phone = data.user?.phone ?? '';
    const otp = data.sms?.otp ?? '';
    if (!phone || !otp) {
      throw new Error('Hook payload missing user.phone or sms.otp');
    }

    console.log('send-sms', { phone: phone.replace(/\d(?=\d{4})/g, '•'), otpLen: otp.length });

    await sendViaFast2sms(otp, phone);

    return new Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('send-sms hook error:', message);
    return new Response(
      JSON.stringify({
        error: {
          http_code: 500,
          message,
        },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
