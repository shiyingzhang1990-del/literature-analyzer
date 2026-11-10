import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, UploadedDoc, LiteratureAnalysis, AIProvider } from '../types';
import { chatWithContext } from '../utils/api';

let msgId = 0; function uid() { return 'm_' + (msgId++); }

interface Props {
  apiKey: string; provider: AIProvider;
  activeDoc: UploadedDoc | null;
  analysis: LiteratureAnalysis | null;
}

export default function ChatView({ apiKey, provider, activeDoc, analysis }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streamContent]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;
    if (!apiKey) { setError('请先输入 API Key'); return; }
    if (!activeDoc) { setError('请先上传并选择一篇文献'); return; }
    setError('');

    const userMsg: Message = { id: uid(), role: 'user', content: text, timestamp: Date.now() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setStreaming(true);
    setStreamContent('');

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      let full = '';
      await chatWithContext(text, activeDoc.content, analysis, apiKey, (chunk) => {
        full += chunk; setStreamContent(full);
      }, provider, abort.signal);

      setMessages(prev => [...prev, { id: uid(), role: 'assistant', content: full, timestamp: Date.now() }]);
      setStreamContent('');
    } catch (err: any) {
      if (err.name !== 'AbortError') setError(err.message || '请求失败');
    }
    setStreaming(false);
    abortRef.current = null;
  }

  function handleStop() {
    abortRef.current?.abort(); setStreaming(false);
    if (streamContent) {
      setMessages(prev => [...prev, { id: uid(), role: 'assistant', content: streamContent, timestamp: Date.now() }]);
      setStreamContent('');
    }
  }

  function handleClear() {
    if (messages.length === 0) return;
    setMessages([]); setStreamContent('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  const allMessages = streamContent
    ? [...messages, { id: 'streaming', role: 'assistant' as const, content: streamContent, timestamp: Date.now() }]
    : messages;

  return (
    <div className="chat-view">
      {!activeDoc ? (
        <div className="welcome-screen">
          <div className="welcome-icon">📚</div>
          <h2>欢迎使用文献智能分析系统</h2>
          <p>请先在左侧上传一篇文献，AI 将进行深度分析</p>
          <p className="welcome-hint">支持 PDF / DOCX / TXT 格式 · 最大 20MB</p>
          {!apiKey && <p className="welcome-key-warn">⚠️ 请先在顶部输入 API Key</p>}
        </div>
      ) : (
        <>
          <div className="chat-header-bar">
            <span className="chat-doc-badge">📄 {activeDoc.name}</span>
            {analysis && <span className="chat-ana-badge">✅ 已分析</span>}
            {messages.length > 0 && <button className="btn-clear-chat" onClick={handleClear}>🗑️ 清空</button>}
          </div>

          <div className="chat-messages">
            {allMessages.length === 0 && !streaming && (
              <div className="welcome-small">
                <p>已选择「{activeDoc.name}」，你可以问：</p>
                <div className="suggestions">
                  <button onClick={() => setInput('这篇文献的核心观点是什么？')}>核心观点</button>
                  <button onClick={() => setInput('这篇文献用了什么研究方法？')}>研究方法</button>
                  <button onClick={() => setInput('这篇文献的主要贡献和局限性是什么？')}>贡献与局限</button>
                  <button onClick={() => setInput('请帮我总结这篇文献的主要内容')}>文献总结</button>
                </div>
              </div>
            )}
            {allMessages.map(m => (
              <div key={m.id} className={`msg ${m.role}`}>
                <div className="msg-avatar">{m.role === 'user' ? '👤' : '🤖'}</div>
                <div className="msg-bubble">
                  <div className="msg-name">{m.role === 'user' ? '你' : 'AI 助手'}</div>
                  {m.role === 'assistant' ? (
                    <div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown></div>
                  ) : (
                    <pre className="msg-text">{m.content}</pre>
                  )}
                  {m.id === 'streaming' && <span className="cursor blink">▊</span>}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {error && <div className="chat-error"><span>{error}</span><button onClick={() => setError('')}>✕</button></div>}

          <div className="chat-input-area">
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown} placeholder="输入关于文献的问题..." rows={1}
              disabled={streaming} className="chat-input" />
            {streaming ? (
              <button className="btn-stop" onClick={handleStop}>⏹ 停止</button>
            ) : (
              <button className="btn-send" onClick={handleSend} disabled={!input.trim() || !apiKey}>发送</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
