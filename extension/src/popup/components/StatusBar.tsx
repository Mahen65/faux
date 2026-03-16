import { useState, useEffect } from 'preact/hooks';
import { sendToBackground } from '@shared/messages';

export function StatusBar() {
  const [backendOnline, setBackendOnline] = useState(false);

  useEffect(() => {
    async function checkStatus() {
      try {
        const response = await sendToBackground({ type: 'GET_STATUS' });
        if (response?.type === 'STATUS') {
          setBackendOnline(response.payload.backendOnline);
        }
      } catch {
        setBackendOnline(false);
      }
    }
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div class="status-bar">
      <span>
        <span class={`status-dot ${backendOnline ? 'online' : 'offline'}`} />
        Backend: {backendOnline ? 'Online' : 'Offline (using local classifier)'}
      </span>
    </div>
  );
}
