import { useState, useCallback, useEffect } from 'react';
import { UploadedDoc, LiteratureAnalysis, AIProvider } from './types';
import Header from './components/Header';
import DocumentView from './components/DocumentView';
import ChatView from './components/ChatView';

type Tab = 'docs' | 'chat';

export default function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('la_api_key') || '');
  const [provider, setProvider] = useState<AIProvider>(() => (localStorage.getItem('la_provider') as AIProvider) || 'openai');
  const [docs, setDocs] = useState<UploadedDoc[]>(() => {
    try { const s = localStorage.getItem('la_docs'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [analyses, setAnalyses] = useState<Record<string, LiteratureAnalysis>>(() => {
    try { const s = localStorage.getItem('la_analyses'); return s ? JSON.parse(s) : {}; } catch { return {}; }
  });
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('docs');

  const activeDoc = docs.find(d => d.id === activeDocId) || null;
  const activeAnalysis = activeDocId ? (analyses[activeDocId] || null) : null;

  const handleApiKeyChange = useCallback((key: string) => {
    setApiKey(key); localStorage.setItem('la_api_key', key);
  }, []);
  const handleProviderChange = useCallback((p: AIProvider) => {
    setProvider(p); localStorage.setItem('la_provider', p);
  }, []);

  const handleDocAdd = useCallback((doc: UploadedDoc) => {
    const updated = [...docs, doc];
    setDocs(updated); localStorage.setItem('la_docs', JSON.stringify(updated));
  }, [docs]);

  const handleDocRemove = useCallback((id: string) => {
    const updated = docs.filter(d => d.id !== id);
    setDocs(updated); localStorage.setItem('la_docs', JSON.stringify(updated));
    const newAnalyses = { ...analyses };
    delete newAnalyses[id];
    setAnalyses(newAnalyses); localStorage.setItem('la_analyses', JSON.stringify(newAnalyses));
    if (activeDocId === id) setActiveDocId(updated[0]?.id || null);
  }, [docs, analyses, activeDocId]);

  const handleSelectDoc = useCallback((doc: UploadedDoc) => {
    setActiveDocId(doc.id);
  }, []);

  const handleAnalysisComplete = useCallback((docId: string, analysis: LiteratureAnalysis) => {
    const newAnalyses = { ...analyses, [docId]: analysis };
    setAnalyses(newAnalyses); localStorage.setItem('la_analyses', JSON.stringify(newAnalyses));
    setDocs(prev => prev.map(d => d.id === docId ? { ...d, analyzed: true } : d));
  }, [analyses]);

  // Sync analyzed flag
  useEffect(() => {
    const needsUpdate = docs.some(d => d.analyzed && !analyses[d.id]);
    if (needsUpdate) {
      setDocs(prev => prev.map(d => d.analyzed && !analyses[d.id] ? { ...d, analyzed: false } : d));
    }
  }, [docs, analyses]);

  return (
    <div className="app">
      <Header apiKey={apiKey} provider={provider} onApiKeyChange={handleApiKeyChange} onProviderChange={handleProviderChange} />

      <div className="app-body">
        <nav className="side-nav">
          <button className={`side-btn ${tab === 'docs' ? 'active' : ''}`} onClick={() => setTab('docs')}>
            <span className="side-icon">📂</span>
            <span className="side-label">文献管理</span>
            {docs.length > 0 && <span className="side-badge">{docs.length}</span>}
          </button>
          <button className={`side-btn ${tab === "chat" ? "active" : ""}`} onClick={() => setTab("chat")}>
            <span className="side-icon">💬</span>
            <span className="side-label">智能问答</span>
          </button>
        </nav>

        <main className="main-area">
          {!apiKey && (
            <div className="api-warning">
              ⚠️ 请先在上方输入 API Key（支持 OpenAI / Anthropic / DeepSeek）
            </div>
          )}
          {tab === 'docs' && (
            <DocumentView
              docs={docs} apiKey={apiKey} provider={provider}
              onDocAdd={handleDocAdd} onDocRemove={handleDocRemove}
              onAnalysisComplete={handleAnalysisComplete}
              activeDoc={activeDoc} onSelectDoc={handleSelectDoc}
            />
          )}
          {tab === 'chat' && (
            <ChatView apiKey={apiKey} provider={provider} activeDoc={activeDoc} analysis={activeAnalysis} />
          )}
        </main>
      </div>
    </div>
  );
}
