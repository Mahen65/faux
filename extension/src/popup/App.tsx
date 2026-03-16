import { useState, useEffect, useRef } from 'preact/hooks';
import { sendToBackground } from '@shared/messages';
import type { AnalysisResponse } from '@shared/messages';
import type { ClassifiedField, FillResult, FormSection } from '@shared/types';
import { FieldList } from './components/FieldList';
import { SectionList } from './components/SectionList';
import { StatusBar } from './components/StatusBar';
import { TabBar } from './components/TabBar';
import type { TabId } from './components/TabBar';
import { SettingsTab } from './components/SettingsTab';
import { AccountTab } from './components/AccountTab';

/** Serializable state that persists across popup open/close */
interface PersistedState {
  analysis: AnalysisResponse | null;
  classifiedCache: [string, ClassifiedField][];
  sections: FormSection[];
  selectedSections: string[];
}

const STORAGE_KEY = 'faux_popup_state';

function saveState(state: PersistedState) {
  chrome.storage.session?.set({ [STORAGE_KEY]: state }).catch(() => {
    // Fallback: session storage not available
  });
}

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('main');
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [filling, setFilling] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [classifiedCache, setClassifiedCache] = useState<Map<string, ClassifiedField>>(new Map());
  const [fillResult, setFillResult] = useState<FillResult | null>(null);
  const [sections, setSections] = useState<FormSection[]>([]);
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  // Restore state on popup open
  useEffect(() => {
    chrome.storage.session?.get(STORAGE_KEY).then((data) => {
      const saved = data?.[STORAGE_KEY] as PersistedState | undefined;
      if (saved) {
        setAnalysis(saved.analysis);
        setClassifiedCache(new Map(saved.classifiedCache));
        setSections(saved.sections);
        setSelectedSections(new Set(saved.selectedSections));
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  // Persist state on every change
  const stateRef = useRef({ analysis, classifiedCache, sections, selectedSections });
  stateRef.current = { analysis, classifiedCache, sections, selectedSections };

  useEffect(() => {
    if (!loaded) return;
    saveState({
      analysis: stateRef.current.analysis,
      classifiedCache: Array.from(stateRef.current.classifiedCache.entries()),
      sections: stateRef.current.sections,
      selectedSections: Array.from(stateRef.current.selectedSections),
    });
  }, [loaded, analysis, classifiedCache, sections, selectedSections]);

  /** Merge new results into the cache */
  function mergeIntoCache(newFields: ClassifiedField[]): ClassifiedField[] {
    const next = new Map(classifiedCache);
    for (const f of newFields) {
      next.set(f.fieldId, f);
    }
    setClassifiedCache(next);
    return Array.from(next.values());
  }

  /** Step 1: Scrape the page — no LLM */
  async function handleAnalyze() {
    setAnalyzing(true);
    setFillResult(null);
    try {
      const response = await sendToBackground({ type: 'ANALYZE_PAGE' });
      if (response?.type === 'PAGE_ANALYSIS_RESULT') {
        setAnalysis(response.payload);
        setSections(response.payload.sections);
        setSelectedSections(new Set(response.payload.sections.map(s => s.id)));
      }
    } catch (err) {
      console.error('[Faux] Analysis error:', err);
    } finally {
      setAnalyzing(false);
    }
  }

  /** Step 2: Generate values via LLM for selected sections */
  async function handleGenerate() {
    if (selectedSections.size === 0) return;
    setGenerating(true);
    setFillResult(null);
    try {
      const sectionIds = Array.from(selectedSections);
      const response = await sendToBackground({ type: 'GENERATE_VALUES', sectionIds });
      if (response?.type === 'GENERATE_RESULT') {
        mergeIntoCache(response.payload);
      }
    } catch (err) {
      console.error('[Faux] Generate error:', err);
    } finally {
      setGenerating(false);
    }
  }

  /** Step 3: Fill the page using cached values */
  async function handleFill() {
    const fieldsToFill = getSelectedClassified();
    if (fieldsToFill.length === 0) return;
    setFilling(true);
    setFillResult(null);
    try {
      const response = await sendToBackground({ type: 'FILL_FORM', payload: fieldsToFill });
      if (response?.type === 'FILL_RESULT') {
        setFillResult(response.payload);
      }
    } catch (err) {
      console.error('[Faux] Fill error:', err);
    } finally {
      setFilling(false);
    }
  }

  /** Submit the form by clicking the submit button in selected sections */
  async function handleSubmit() {
    setFillResult(null);
    try {
      const sectionIds = Array.from(selectedSections);
      const response = await sendToBackground({ type: 'SUBMIT_FORM', sectionIds });
      if (response?.type === 'SUBMIT_RESULT') {
        if (!response.payload.success) {
          console.warn('[Faux] Submit failed:', response.payload.error);
        }
      }
    } catch (err) {
      console.error('[Faux] Submit error:', err);
    }
  }

  /** Convenience: Generate + Fill in one click */
  async function handleGenerateAndFill() {
    if (selectedSections.size === 0) return;
    setGenerating(true);
    setFilling(true);
    setFillResult(null);
    try {
      const sectionIds = Array.from(selectedSections);
      const response = await sendToBackground({ type: 'GENERATE_VALUES', sectionIds });
      if (response?.type === 'GENERATE_RESULT') {
        const allCached = mergeIntoCache(response.payload);
        setGenerating(false);

        const selectedFieldIds = new Set(
          sections.filter(s => selectedSections.has(s.id)).flatMap(s => s.fieldIds)
        );
        const fieldsToFill = allCached.filter(c => selectedFieldIds.has(c.fieldId));
        if (fieldsToFill.length > 0) {
          const fillResponse = await sendToBackground({ type: 'FILL_FORM', payload: fieldsToFill });
          if (fillResponse?.type === 'FILL_RESULT') {
            setFillResult(fillResponse.payload);
          }
        }
      }
    } catch (err) {
      console.error('[Faux] Generate & Fill error:', err);
    } finally {
      setGenerating(false);
      setFilling(false);
    }
  }

  function handleRescan() {
    setSections([]);
    setSelectedSections(new Set());
    setClassifiedCache(new Map());
    setAnalysis(null);
    setFillResult(null);
  }

  function toggleSection(sectionId: string) {
    setSelectedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  function selectAllSections() {
    setSelectedSections(new Set(sections.map(s => s.id)));
  }

  function selectNoSections() {
    setSelectedSections(new Set());
  }

  function getSelectedClassified(): ClassifiedField[] {
    const selectedFieldIds = new Set(
      sections.filter(s => selectedSections.has(s.id)).flatMap(s => s.fieldIds)
    );
    return Array.from(classifiedCache.values()).filter(c => selectedFieldIds.has(c.fieldId));
  }

  // Don't render until state is restored
  if (!loaded) return null;

  const visibleClassified = getSelectedClassified();
  const selectedFieldIds = new Set(visibleClassified.map(c => c.fieldId));
  const visibleFields = analysis?.fields.filter(f => selectedFieldIds.has(f.id)) ?? [];
  const hasAnalysis = sections.length > 0;
  const hasValues = classifiedCache.size > 0;
  const busy = analyzing || generating || filling;

  return (
    <div>
      <div class="header">
        <span class="logo">⚗️</span>
        <h1>Faux</h1>
      </div>

      <TabBar active={activeTab} onChange={setActiveTab} />

      {activeTab === 'settings' && <SettingsTab />}
      {activeTab === 'account' && <AccountTab />}

      {activeTab === 'main' && <>

      <StatusBar />

      {/* Step 1: Analyze */}
      <div class="actions">
        <button class="btn btn-primary" onClick={handleAnalyze} disabled={busy}>
          {analyzing ? 'Scanning...' : hasAnalysis ? '↺ Rescan Page' : 'Analyze Page'}
        </button>
      </div>

      {/* Sections */}
      {hasAnalysis && (
        <SectionList
          sections={sections}
          selected={selectedSections}
          onToggle={toggleSection}
          onSelectAll={selectAllSections}
          onSelectNone={selectNoSections}
        />
      )}

      {/* Step 2 & 3: Generate + Fill */}
      {hasAnalysis && selectedSections.size > 0 && (
        <div class="actions" style={{ paddingTop: 0 }}>
          <button class="btn btn-primary" onClick={handleGenerate} disabled={busy}>
            {generating ? 'Generating...' : hasValues ? 'Regenerate' : 'Generate Values'}
          </button>
          <button class="btn btn-success" onClick={handleGenerateAndFill} disabled={busy}>
            {generating || filling ? '...' : 'Generate & Fill'}
          </button>
        </div>
      )}

      {/* Fill + Submit */}
      {visibleClassified.length > 0 && (
        <div class="actions" style={{ paddingTop: 0 }}>
          <button class="btn btn-secondary" onClick={handleFill} disabled={busy}>
            {filling ? 'Filling...' : 'Fill Selected'}
          </button>
          <button class="btn btn-secondary" onClick={handleSubmit} disabled={busy}>
            Submit
          </button>
        </div>
      )}

      {/* Stats */}
      {analysis && (
        <div class="stats">
          <div class="stat">
            <div class="stat-value">{analysis.fields.length}</div>
            <div class="stat-label">Total Fields</div>
          </div>
          <div class="stat">
            <div class="stat-value">{classifiedCache.size}</div>
            <div class="stat-label">Generated</div>
          </div>
          {fillResult && (
            <>
              <div class="stat">
                <div class="stat-value">{fillResult.filled}</div>
                <div class="stat-label">Filled</div>
              </div>
              <div class="stat">
                <div class="stat-value">{fillResult.skipped}</div>
                <div class="stat-label">Skipped</div>
              </div>
            </>
          )}
        </div>
      )}

      {fillResult && (
        <div class={`fill-result ${fillResult.errors > 0 ? 'error' : 'success'}`}>
          {fillResult.errors > 0
            ? `Filled ${fillResult.filled} fields with ${fillResult.errors} errors`
            : `Successfully filled ${fillResult.filled} fields!`
          }
        </div>
      )}

      {/* Field list */}
      {visibleFields.length > 0 ? (
        <FieldList fields={visibleFields} classified={visibleClassified} />
      ) : !analysis ? (
        <div class="empty-state">
          <div class="icon">🔍</div>
          <div>Click "Analyze Page" to detect form fields</div>
        </div>
      ) : selectedSections.size === 0 ? (
        <div class="empty-state">
          <div class="icon">☑️</div>
          <div>Select sections to generate values for</div>
        </div>
      ) : !hasValues ? (
        <div class="empty-state">
          <div class="icon">⚡</div>
          <div>Click "Generate Values" to create test data</div>
        </div>
      ) : null}

      </>}
    </div>
  );
}
