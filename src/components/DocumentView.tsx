import { useState, useRef } from 'react';
import { UploadedDoc, AIProvider, LiteratureAnalysis } from '../types';
import { parseFile } from '../utils/fileParser';
import { analyzeLiterature } from '../utils/api';
import ThinkingProcessView from './ThinkingProcess';

interface Props {
  docs: UploadedDoc[];
  apiKey: string;
  provider: AIProvider;
  onDocAdd: (doc: UploadedDoc) => void;
  onDocRemove: (id: string) => void;
  onAnalysisComplete: (docId: string, analysis: LiteratureAnalysis) => void;
  activeDoc: UploadedDoc | null;
  onSelectDoc: (doc: UploadedDoc) => void;
}

export default function DocumentView({ docs, apiKey, provider, onDocAdd, onDocRemove, onAnalysisComplete, activeDoc, onSelectDoc }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [batchAnalyzing, setBatchAnalyzing] = useState(false);
  const [analysisDocId, setAnalysisDocId] = useState<string | null>(null);
  const [thinkingSteps, setThinkingSteps] = useState<{step: string; content: string}[]>([]);
  const [analysisResult, setAnalysisResult] = useState<LiteratureAnalysis | null>(null);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, docName: '' });

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setError('');
    setUploading(true);
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 20 * 1024 * 1024) { setError(`「${file.name}」文件大小不能超过 20MB，已跳过`); continue; }
      try {
        const content = await parseFile(file);
        const doc: UploadedDoc = {
          id: 'doc_' + Date.now() + '_' + i, name: file.name, content,
          type: file.name.split('.').pop()?.toLowerCase() || 'txt',
          size: file.size, uploadedAt: Date.now(), analyzed: false,
        };
        onDocAdd(doc);
        if (i === 0) { setAnalysisDocId(doc.id); onSelectDoc(doc); }
      } catch (err: any) {
        setError(`「${file.name}」解析失败: ${err.message}`);
      }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleAnalyze(doc: UploadedDoc) {
    if (!apiKey) { setError('请先输入 API Key'); return; }
    setAnalyzing(true); setError('');
    setAnalysisDocId(doc.id);
    setThinkingSteps([]);
    setAnalysisResult(null);
    onSelectDoc(doc);

    try {
      const result = await analyzeLiterature(
        doc.content, doc.name, apiKey,
        (step, content) => { setThinkingSteps(prev => [...prev, { step, content }]); },
        provider
      );
      setAnalysisResult(result);
      onAnalysisComplete(doc.id, result);
    } catch (err: any) {
      setError(err.message || '分析失败');
    }
    setAnalyzing(false);
  }

  async function handleBatchAnalyze() {
    const unanalyzed = docs.filter(d => !d.analyzed);
    if (unanalyzed.length === 0) { setError('所有文献已分析完毕'); return; }
    if (!apiKey) { setError('请先输入 API Key'); return; }
    
    setBatchAnalyzing(true);
    setError('');
    setAnalysisResult(null);
    setThinkingSteps([]);

    for (let i = 0; i < unanalyzed.length; i++) {
      const doc = unanalyzed[i];
      setBatchProgress({ current: i + 1, total: unanalyzed.length, docName: doc.name });
      setAnalysisDocId(doc.id);
      onSelectDoc(doc);
      
      try {
        const result = await analyzeLiterature(
          doc.content, doc.name, apiKey,
          (step, content) => { setThinkingSteps(prev => [...prev, { step, content }]); },
          provider
        );
        onAnalysisComplete(doc.id, result);
        setAnalysisResult(result);
      } catch (err: any) {
        setError(doc.name + ': ' + (err.message || '分析失败'));
      }
    }
    
    setBatchAnalyzing(false);
    setBatchProgress({ current: 0, total: 0, docName: '' });
  }

  const stepLabels: Record<string, string> = {
    initial_understanding: '初始理解',
    keyword_extraction_reasoning: '关键词提取推理',
    opinion_analysis_logic: '观点分析逻辑',
    summary_synthesis_process: '总结综合过程',
    structure_building_thought: '结构构建思考',
  };

  const unanalyzedCount = docs.filter(d => !d.analyzed).length;
  const analyzedCount = docs.filter(d => d.analyzed).length;

  return (
    <div className="doc-view">
      <div className="doc-upload-card">
        <h3>上传文献</h3>
        <p className="form-desc">支持 PDF、DOCX、TXT 格式（最大 20MB，可一次选择多个文件）</p>
        <div className="upload-area" onClick={() => fileInputRef.current?.click()}>
          <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" onChange={handleFileSelect} multiple hidden />
          <div className="upload-icon">📤</div>
          <p>点击上传文件或拖拽文件到此区域</p>
          <p className="upload-hint">支持同时选择多个文件一起上传</p>
        </div>
        {uploading && <div className="loading-bar"><div className="loading-fill" /></div>}
        {error && <div className="error-msg">{error}</div>}
      </div>

      {docs.length > 0 && (
        <div className="doc-list-section">
          <div className="section-title-row">
            <h3>已上传文献 ({docs.length})</h3>
            <div className="section-actions">
              <span className="analysis-stats">已分析 {analyzedCount}/{docs.length}</span>
              {unanalyzedCount > 0 && !batchAnalyzing && (
                <button className="btn-batch" onClick={handleBatchAnalyze} disabled={!apiKey}>
                  🔄 批量分析剩余 {unanalyzedCount} 篇
                </button>
              )}
              {batchAnalyzing && (
                <span className="batch-progress">
                  ⏳ 正在分析 ({batchProgress.current}/{batchProgress.total}): {batchProgress.docName}
                </span>
              )}
            </div>
          </div>
          {docs.map(doc => (
            <div key={doc.id} className={`doc-card ${activeDoc?.id === doc.id ? 'active' : ''}`}
                 onClick={() => { setAnalysisDocId(doc.id); setAnalysisResult(null); setThinkingSteps([]); onSelectDoc(doc); }}>
              <div className="doc-info">
                <span className="doc-icon">{doc.type === 'pdf' ? '📕' : doc.type === 'docx' ? '📘' : '📄'}</span>
                <div className="doc-meta">
                  <span className="doc-name">{doc.name}</span>
                  <span className="doc-size">{(doc.size / 1024).toFixed(1)} KB · {(doc.content.length / 1000).toFixed(1)}K 字</span>
                </div>
              </div>
              <div className="doc-actions">
                {doc.analyzed ? <span className="badge-done">✅ 已分析</span> : (
                  <button className="btn-analyze" onClick={e => { e.stopPropagation(); handleAnalyze(doc); }}
                    disabled={(analyzing || batchAnalyzing) && analysisDocId === doc.id}>
                    {(analyzing && analysisDocId === doc.id) || (batchAnalyzing && analysisDocId === doc.id) ? '⏳...' : '🔍 分析'}
                  </button>
                )}
                <button className="btn-del" onClick={e => { e.stopPropagation(); onDocRemove(doc.id); }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Thinking Process & Analysis Results */}
      {(analyzing || batchAnalyzing || analysisResult) && docs.find(d => d.id === analysisDocId) && (
        <div className="analysis-section">
          <h3>📊 分析结果 - {docs.find(d => d.id === analysisDocId)?.name}</h3>
          <ThinkingProcessView process={(analysisResult?.thinkingProcess || {}) as any} />
          {analysisResult && (
            <div className="analysis-result">
              <div className="ana-grid">
                <div className="ana-item"><label>文献标题</label><div className="ana-val">{analysisResult.title}</div></div>
                <div className="ana-item">
                  <label>关键词</label>
                  <div className="tags">{analysisResult.keywords.map((k, i) => <span key={i} className="tag">{k}</span>)}</div>
                </div>
                <div className="ana-item full"><label>摘要</label><div className="ana-val">{analysisResult.summary}</div></div>
                <div className="ana-item full"><label>研究方法</label><div className="ana-val">{analysisResult.methodology}</div></div>
                <div className="ana-item full">
                  <label>核心要点</label>
                  <ul>{analysisResult.keyPoints.map((p, i) => <li key={i}>{p}</li>)}</ul>
                </div>
                <div className="ana-item full">
                  <label>贡献</label>
                  <ul>{analysisResult.contributions.map((c, i) => <li key={i}>{c}</li>)}</ul>
                </div>
                <div className="ana-item full">
                  <label>局限性</label>
                  <ul>{analysisResult.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
