import type { ClassifiedField, FieldDescriptor, FillResult, FormSection } from './types';

/** Analysis result including classification (returned from content script) */
export interface AnalysisResponse {
  url: string;
  title: string;
  fields: FieldDescriptor[];
  sections: FormSection[];
  classified: ClassifiedField[];
  formCount: number;
  timestamp: string;
}

/** All message types used in the extension */
export type FauxMessage =
  | { type: 'ANALYZE_PAGE' }
  | { type: 'PAGE_ANALYSIS_RESULT'; payload: AnalysisResponse }
  | { type: 'GENERATE_VALUES'; sectionIds?: string[] }
  | { type: 'GENERATE_RESULT'; payload: ClassifiedField[] }
  | { type: 'FILL_FORM'; payload: ClassifiedField[] }
  | { type: 'FILL_RESULT'; payload: FillResult }
  | { type: 'SUBMIT_FORM'; sectionIds?: string[] }
  | { type: 'SUBMIT_RESULT'; payload: { success: boolean; error?: string; buttonText?: string } }
  | { type: 'GET_STATUS' }
  | { type: 'STATUS'; payload: { backendOnline: boolean; fieldsDetected: number } };

/** Send a typed message to the background service worker */
export function sendToBackground(msg: FauxMessage): Promise<FauxMessage> {
  return chrome.runtime.sendMessage(msg);
}

/** Send a typed message to a specific tab's content script */
export function sendToTab(tabId: number, msg: FauxMessage): Promise<FauxMessage> {
  return chrome.tabs.sendMessage(tabId, msg);
}
