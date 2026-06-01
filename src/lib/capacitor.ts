/**
 * Utilitários para integração com Capacitor (app nativo iOS/Android)
 */

/**
 * Detecta se o app está rodando dentro do Capacitor (app nativo)
 * vs. navegador web normal
 */
export const isCapacitor = (): boolean => {
  return (
    typeof (window as any).Capacitor !== 'undefined' &&
    (window as any).Capacitor.isNativePlatform()
  );
};

/**
 * Detecta a plataforma atual
 */
export const getPlatform = (): 'ios' | 'android' | 'web' => {
  if (typeof (window as any).Capacitor === 'undefined') return 'web';
  return (window as any).Capacitor.getPlatform() as 'ios' | 'android' | 'web';
};

/**
 * Inicializa plugins do Capacitor necessários
 * Chame isso no entry point do app
 */
export const initCapacitor = async (): Promise<void> => {
  if (!isCapacitor()) return;

  try {
    // StatusBar — esconde barra de status ou define cor
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Default });
    await StatusBar.setBackgroundColor({ color: '#FFFFFF' });

    // Keyboard — evita que teclado cubra inputs
    const { Keyboard } = await import('@capacitor/keyboard');
    Keyboard.setAccessoryBarVisible({ isVisible: false });
  } catch (e) {
    // Plugins opcionais — ignora se não disponíveis
    console.warn('[Capacitor] Plugin init error:', e);
  }
};
