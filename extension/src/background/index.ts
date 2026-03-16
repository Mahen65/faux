import type { FauxMessage } from '@shared/messages';
import { API_BASE_URL, API_TIMEOUT } from '@shared/constants';

/** Check if the Python backend is reachable */
async function checkBackendHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), API_TIMEOUT);
    const res = await fetch(`${API_BASE_URL}/health`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  }
}

/** Forward a message to the active tab's content script */
async function sendToActiveTab(message: FauxMessage): Promise<FauxMessage | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;
  return chrome.tabs.sendMessage(tab.id, message);
}

/** Handle messages from the popup */
chrome.runtime.onMessage.addListener(
  (message: FauxMessage, sender, sendResponse) => {
    // If message is from popup (no tab), forward to content script
    if (!sender.tab) {
      switch (message.type) {
        case 'ANALYZE_PAGE':
        case 'GENERATE_VALUES':
        case 'FILL_FORM':
        case 'SUBMIT_FORM':
          sendToActiveTab(message).then(sendResponse);
          return true; // async

        case 'GET_STATUS':
          // Combine backend status with content script status
          Promise.all([
            checkBackendHealth(),
            sendToActiveTab(message),
          ]).then(([backendOnline, contentResponse]) => {
            if (contentResponse?.type === 'STATUS') {
              contentResponse.payload.backendOnline = backendOnline;
              sendResponse(contentResponse);
            } else {
              sendResponse({
                type: 'STATUS',
                payload: { backendOnline, fieldsDetected: 0 },
              });
            }
          });
          return true; // async
      }
    }

    return false;
  }
);

console.log('[Faux] Background service worker loaded');
