import { AIProvider } from '../types';
interface Props { apiKey: string; provider: AIProvider; onApiKeyChange: (k: string) => void; onProviderChange: (p: AIProvider) => void; }
export default function Header({ apiKey, provider, onApiKeyChange, onProviderChange }: Props) {
  return (
    <header className="header">
      <div className="header-left">
        <h1>📚 文献智能分析系统</h1>
        <span className="header-subtitle">上传文献 · AI 深度分析 · EPIC 思维模式 · 智能问答</span>
      </div>
      <div className="header-right">
        <div className="apikey-group">
          <input type="password" value={apiKey} onChange={e => onApiKeyChange(e.target.value)}
            placeholder="输入 API Key (sk-... / sk-ant-...)" className="api-input" />
        </div>
        <div className="provider-group">
          <span className="label">模型：</span>
          <select value={provider} onChange={e => onProviderChange(e.target.value as AIProvider)}>
            <option value="openai">OpenAI GPT-4o</option>
            <option value="anthropic">Anthropic Claude</option>
            <option value="deepseek">DeepSeek</option>
          </select>
        </div>
      </div>
    </header>
  );
}
