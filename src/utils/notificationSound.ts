// Utility para reproduzir som de notificação
export const playNotificationSound = () => {
  try {
    // Verificar se som está habilitado
    const soundEnabled = localStorage.getItem('notification-sound-enabled');
    if (soundEnabled === 'false') {
      return;
    }

    // Criar contexto de áudio
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Criar oscilador para gerar um som de notificação agradável
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Configurar frequência e tipo de onda
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime); // Frequência inicial
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1); // Frequência final (descendo)
    oscillator.type = 'sine'; // Onda senoidal para som suave
    
    // Envelope de volume (fade in/out rápido)
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.05); // Fade in
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.2); // Fade out
    
    // Tocar o som
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
    
  } catch (error) {
    console.error('Erro ao reproduzir som de notificação:', error);
  }
};

export const isNotificationSoundEnabled = (): boolean => {
  const enabled = localStorage.getItem('notification-sound-enabled');
  return enabled !== 'false'; // Default é true
};

export const setNotificationSoundEnabled = (enabled: boolean) => {
  localStorage.setItem('notification-sound-enabled', enabled.toString());
};
