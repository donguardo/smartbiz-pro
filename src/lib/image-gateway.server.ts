import { createClient } from "@supabase/supabase-js";

export async function generateStoreImage(request: Request) {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'] ?? process.env['SUPABASE_ANON_KEY'];
  const token = request.headers.get('Authorization');
  if (!url || !key) return new Response('Image service is not configured.', { status: 500 });
  if (!token?.startsWith('Bearer ')) return new Response('Sign in to create a logo.', { status: 401 });
  const client = createClient(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: token } } });
  const { data: user, error } = await client.auth.getUser(token.slice(7));
  if (error || !user.user) return new Response('Sign in to create a logo.', { status: 401 });
  const { data: shops } = await client.rpc('get_my_shop_context');
  if (shops?.[0]?.member_role !== 'owner') return new Response('Only a shop owner can create a store logo.', { status: 403 });
  const { z } = await import('zod');
  const parsed = z.object({ prompt: z.string().trim().min(3).max(1200), stream: z.boolean().default(true) }).safeParse(await request.json());
  if (!parsed.success) return new Response('Describe your image in 3–1200 characters.', { status: 400 });
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data: access, error: accessError } = await supabaseAdmin.from('image_generation_access_state').select('blocked,message,status').eq('id', 'store-logo').maybeSingle();
  if (accessError) return new Response('Unable to check image service access.', { status: 503 });
  if (access?.blocked) return new Response(access.message, { status: access.status ?? 403 });
  const apiKey = process.env['LOVABLE_API_KEY'];
  if (!apiKey) return new Response('Image generation is not configured.', { status: 500 });
  const upstream = await fetch('https://ai.gateway.lovable.dev/v1/images/generations', {
    method: 'POST',
    headers: { 'Lovable-API-Key': apiKey, 'X-Lovable-AIG-SDK': 'fetch', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai/gpt-image-2.5-sunburst',
      prompt: `Create an original square business profile image or store logo. Center the subject with generous margins so it remains recognizable at small sizes. Follow the user's requested colors, style and exact wording; do not add other text. User brief: ${parsed.data.prompt}`,
      size: '1024x1024', quality: 'medium',
      ...(parsed.data.stream ? { stream: true, partial_images: 1 } : {}),
    }),
  });
  if (upstream.status === 402 || upstream.status === 403) {
    const raw = await upstream.clone().text();
    let message = raw;
    try { const body = JSON.parse(raw); message = body.error?.message ?? body.message ?? raw; } catch {}
    await supabaseAdmin.from('image_generation_access_state').upsert({ id: 'store-logo', blocked: true, message, status: upstream.status, updated_at: new Date().toISOString() });
  }
  const headers = new Headers({ 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json', 'Cache-Control': 'no-store' });
  upstream.headers.forEach((value, name) => { if (name.toLowerCase().startsWith('x-lovable-aig-')) headers.set(name, value); });
  return new Response(upstream.body, { status: upstream.status, headers });
}