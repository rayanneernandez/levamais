import { supabase } from "@/integrations/supabase/client";

// Buscar VAPID public key do backend
async function getVapidPublicKey(): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke('initialize-vapid-keys');
    
    if (error) {
      console.error('Erro ao obter VAPID key:', error);
      throw error;
    }

    if (!data?.publicKey) {
      throw new Error('VAPID public key não encontrada');
    }

    return data.publicKey;
  } catch (error) {
    console.error('Erro ao buscar VAPID key:', error);
    throw error;
  }
}

// Converter base64 para Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Verificar se é iOS
const isIOS = (): boolean => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

// Verificar se push notifications são suportadas
export const isPushNotificationSupported = (): boolean => {
  // iOS não suporta Web Push API nativamente
  if (isIOS()) {
    return false;
  }
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
};

// Verificar se já tem permissão
export const isPushNotificationPermissionGranted = (): boolean => {
  return Notification.permission === 'granted';
};

// Verificar se está inscrito
export const isPushNotificationSubscribed = async (): Promise<boolean> => {
  if (!isPushNotificationSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await (registration as any).pushManager.getSubscription();
    return subscription !== null;
  } catch (error) {
    console.error('Erro ao verificar inscrição:', error);
    return false;
  }
};

// Solicitar permissão e registrar para push notifications
export const subscribeToPushNotifications = async (clientId: string): Promise<boolean> => {
  if (!isPushNotificationSupported()) {
    console.warn('Push notifications não suportadas neste navegador');
    return false;
  }

    try {
      console.log('🔔 Iniciando processo de inscrição de push notifications...');
      console.log('🌐 Navegador:', navigator.userAgent);
      console.log('📱 Plataforma:', navigator.platform);
      console.log('🔐 Permissão atual:', Notification.permission);
      
      // PASSO 1: Registrar service worker PRIMEIRO
      console.log('📝 Registrando service worker...');
      let registration = await navigator.serviceWorker.getRegistration('/');
      
      if (!registration) {
        console.log('🆕 Criando novo registro de service worker...');
        registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });
        console.log('⏳ Aguardando service worker ficar pronto...');
        await navigator.serviceWorker.ready;
        console.log('✅ Service worker registrado com sucesso!');
      } else {
        console.log('✅ Service worker já registrado');
        console.log('📊 Estado:', registration.active?.state);
      }

      // PASSO 2: Solicitar permissão DEPOIS do service worker estar pronto
      console.log('🔐 Solicitando permissão de notificação...');
      console.log('📱 Permissão atual:', Notification.permission);
      
      // Verificar se já foi negada antes
      if (Notification.permission === 'denied') {
        console.warn('❌ Permissão de notificação já foi negada anteriormente');
        console.log('💡 Usuário precisa ir nas configurações do navegador para reativar');
        throw new Error('Permissão de notificação negada. Por favor, ative nas configurações do navegador.');
      }
      
      // Se já concedida, pular solicitação
      let permission: NotificationPermission = Notification.permission;
      
      if (permission === 'default') {
        console.log('📢 Exibindo prompt de permissão ao usuário...');
        try {
          permission = await Notification.requestPermission();
          console.log('🔐 Resposta do usuário:', permission);
        } catch (error) {
          console.error('❌ Erro ao solicitar permissão:', error);
          throw new Error('Erro ao solicitar permissão de notificação. Tente novamente.');
        }
      } else {
        console.log('✅ Permissão já concedida:', permission);
      }
      
      if (permission !== 'granted') {
        console.warn('❌ Permissão de notificação negada pelo usuário');
        throw new Error('Permissão de notificação negada.');
      }

      // PASSO 3: Buscar VAPID public key
      console.log('🔑 Buscando VAPID public key...');
      const vapidPublicKey = await getVapidPublicKey();
      console.log('✅ VAPID key obtida:', vapidPublicKey.substring(0, 20) + '...');

      // PASSO 4: Verificar se já existe uma inscrição
      console.log('🔍 Verificando inscrições existentes...');
      let subscription = await (registration as any).pushManager.getSubscription();

      if (subscription) {
        console.log('🗑️ Removendo inscrição antiga...');
        await subscription.unsubscribe();
      }

      // PASSO 5: Criar nova inscrição
      console.log('🆕 Criando nova inscrição push...');
      try {
        subscription = await (registration as any).pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource
        });
        console.log('✅ Inscrição push criada com sucesso!');
        console.log('📍 Endpoint:', subscription.endpoint);
      } catch (error) {
        console.error('❌ Erro ao criar inscrição:', error);
        throw new Error('Erro ao criar inscrição de notificação. Verifique sua conexão e tente novamente.');
      }

      // PASSO 6: Salvar no banco de dados
      console.log('💾 Salvando inscrição no banco de dados...');
      const subscriptionData = subscription.toJSON();
      
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          client_id: clientId,
          endpoint: subscriptionData.endpoint!,
          p256dh: subscriptionData.keys!.p256dh,
          auth: subscriptionData.keys!.auth,
          user_agent: navigator.userAgent,
          is_active: true,
          last_used_at: new Date().toISOString()
        }, {
          onConflict: 'client_id,endpoint'
        });

      if (error) {
        console.error('❌ Erro ao salvar inscrição:', error);
        throw new Error('Erro ao salvar inscrição no banco de dados.');
      }

      console.log('🎉 Push notification inscrita com sucesso!');
      return true;

    } catch (error) {
      console.error('❌ Erro ao inscrever para push notifications:', error);
      console.error('Detalhes do erro:', error);
      if (error instanceof Error) {
        throw error; // Re-throw para mostrar mensagem específica no toast
      }
      return false;
    }
  };

// Cancelar inscrição de push notifications
export const unsubscribeFromPushNotifications = async (clientId: string): Promise<boolean> => {
  if (!isPushNotificationSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await (registration as any).pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      
      // Remover do banco de dados
      const { error } = await supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('client_id', clientId)
        .eq('endpoint', subscription.endpoint);

      if (error) {
        console.error('Erro ao remover inscrição:', error);
      }
    }

    console.log('Push notification cancelada com sucesso!');
    return true;

  } catch (error) {
    console.error('Erro ao cancelar push notifications:', error);
    return false;
  }
};

// Enviar notificação de teste
export const sendTestPushNotification = async () => {
  if (!isPushNotificationSupported() || !isPushNotificationPermissionGranted()) {
    console.warn('Push notifications não suportadas ou sem permissão');
    return;
  }

  try {
    console.log('📨 Enviando notificação de teste via edge function...');
    
    // Buscar client_id do usuário logado
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('❌ Usuário não autenticado');
      return;
    }

    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!client) {
      console.error('❌ Cliente não encontrado');
      return;
    }

    // Chamar edge function para enviar a notificação
    const { data, error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        clientId: client.id,
        notification: {
          title: 'Notificação de Teste 🎉',
          body: 'As notificações push estão funcionando perfeitamente!',
          icon: '/pwa-icon-512.png',
          badge: '/pwa-icon-512.png',
          tag: 'test-notification'
        }
      }
    });

    if (error) {
      console.error('❌ Erro ao enviar notificação:', error);
      return;
    }

    console.log('✅ Notificação enviada com sucesso:', data);
  } catch (error) {
    console.error('❌ Erro ao enviar notificação de teste:', error);
  }
};
