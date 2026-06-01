// Service Worker para Push Notifications
const CACHE_NAME = 'leva-mais-v1';

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(self.clients.claim());
});

// Push event - recebe notificações do servidor
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);

  let data = {
    title: 'Nova Notificação',
    body: 'Você tem uma nova mensagem',
    icon: '/pwa-icon-512.png',
    badge: '/pwa-icon-512.png',
    data: {}
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/pwa-icon-512.png',
    badge: data.badge || '/pwa-icon-512.png',
    vibrate: [200, 100, 200], // Padrão de vibração
    data: data.data || {},
    actions: data.actions || [],
    tag: data.tag || 'notification',
    requireInteraction: false,
    silent: false
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event - quando usuário clica na notificação
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();

  // Abrir ou focar a janela do app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Se já existe uma janela aberta, focar nela
        for (const client of clientList) {
          if (client.url.includes(self.registration.scope) && 'focus' in client) {
            return client.focus();
          }
        }
        // Caso contrário, abrir nova janela
        if (clients.openWindow) {
          return clients.openWindow('/levacliente');
        }
      })
  );
});

// Notification close event
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event);
});
