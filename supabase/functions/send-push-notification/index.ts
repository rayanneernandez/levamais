import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📨 Iniciando envio de push notification (Web + Expo)...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();

    const notifTitle = body.notification?.title || body.title;
    const notifBody = body.notification?.body || body.body;
    const notifIcon = body.notification?.icon || '/pwa-icon-512.png';
    const notifBadge = body.notification?.badge || '/pwa-icon-512.png';
    const notifData = body.notification?.data || body.data || {};
    const notifActions = body.notification?.actions || [];
    const notifTag = body.notification?.tag || 'notification';

    const clientIds: string[] = body.clientIds || (body.clientId ? [body.clientId] : []);

    console.log('🎯 Client IDs:', clientIds.length > 0 ? clientIds.join(', ') : 'broadcast');

    if (!notifTitle || !notifBody) {
      throw new Error('title e body são obrigatórios');
    }

    // ========== WEB PUSH (VAPID) ==========
    let webSuccess = 0;
    let webFailure = 0;

    try {
      // Prefer VAPID keys from environment secrets (secure), fall back to DB (legacy)
      let vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
      let vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

      if (!vapidPublicKey || !vapidPrivateKey) {
        console.log('⚠️ VAPID keys not found in env, falling back to database (legacy)');
        const { data: vapidKeys } = await supabase.from('vapid_keys').select('*').single();
        if (vapidKeys) {
          vapidPublicKey = vapidKeys.public_key;
          vapidPrivateKey = vapidKeys.private_key;
        }
      }

      if (vapidPublicKey && vapidPrivateKey) {
        const webpush = await import('npm:web-push@3.6.7');
        webpush.setVapidDetails('mailto:contato@levamais.app', vapidPublicKey, vapidPrivateKey);

        let query = supabase.from('push_subscriptions').select('*').eq('is_active', true);
        if (clientIds.length > 0) query = query.in('client_id', clientIds);
        const { data: subscriptions } = await query;

        if (subscriptions && subscriptions.length > 0) {
          const payload = JSON.stringify({
            title: notifTitle,
            body: notifBody,
            icon: notifIcon,
            badge: notifBadge,
            data: notifData,
            actions: notifActions,
            tag: notifTag,
          });

          for (const sub of subscriptions) {
            try {
              await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
              await supabase.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', sub.id);
              webSuccess++;
            } catch (error: any) {
              webFailure++;
              if (error.statusCode === 410) {
                await supabase.from('push_subscriptions').update({ is_active: false }).eq('id', sub.id);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('⚠️ Web Push error (non-fatal):', e);
    }

    // ========== EXPO PUSH (via Convex a0) ==========
    let expoSuccess = 0;
    let expoFailure = 0;

    try {
      if (clientIds.length > 0) {
        console.log('📨 Enviando push via Convex a0 para', clientIds.length, 'clientes...');

        const convexRes = await fetch('https://whimsical-gnat-146.convex.site/send-push', {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_ids: clientIds,
            title: notifTitle,
            body: notifBody,
            data: notifData,
          }),
        });

        const result = await convexRes.json();
        console.log('📨 Convex Push API response:', JSON.stringify(result));

        if (convexRes.ok) {
          expoSuccess = result.sent || clientIds.length;
          expoFailure = result.failed || 0;
        } else {
          console.error('❌ Convex Push error:', result);
          expoFailure = clientIds.length;
        }
      }
    } catch (e) {
      console.error('⚠️ Expo/Convex Push error (non-fatal):', e);
    }

    console.log(`🎉 Web: ${webSuccess}/${webSuccess + webFailure} | Expo: ${expoSuccess}/${expoSuccess + expoFailure}`);

    return new Response(
      JSON.stringify({
        success: true,
        web: { sent: webSuccess, failed: webFailure },
        expo: { sent: expoSuccess, failed: expoFailure },
        totalSent: webSuccess + expoSuccess,
        totalFailed: webFailure + expoFailure,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
