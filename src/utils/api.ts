import { AIProvider, LiteratureAnalysis } from '../types';

function detectProvider(apiKey: string): AIProvider {
  if (apiKey.startsWith('sk-ant-')) return 'anthropic';
  if (apiKey.startsWith('sk-')) return 'openai';
  return 'openai';
}

async function callLLMStream(
  messages: { role: string; content: string }[],
  apiKey: string,
  onChunk: (text: string) => void,
  provider?: AIProvider,
  signal?: AbortSignal
): Promise<string> {
  const p = provider || detectProvider(apiKey);
  let url = '/api/openai/v1/chat/completions';
  let headers: Record<string, string> = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
  let body: any = { model: 'gpt-4o', max_tokens: 8192, stream: true, messages, temperature: 0.7 };

  if (p === 'anthropic') {
    url = '/api/anthropic/v1/messages';
    headers = { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
    body = { model: 'claude-sonnet-4-6', max_tokens: 8192, stream: true, messages: messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })) };
  } else if (p === 'deepseek') {
    body = { model: 'deepseek-chat', max_tokens: 8192, stream: true, messages, temperature: 0.7 };
  }

  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal });
  if (!response.ok) {
    let errDetail = '';
    try {
      const errText = await response.text();
      try { const j = JSON.parse(errText); errDetail = j.error?.message || j.error?.type || errText.substring(0, 200); }
      catch { errDetail = errText.substring(0, 200); }
    } catch { errDetail = '无法读取错误详情'; }
    throw new Error(`API 调用失败 (${response.status}): ${errDetail}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('无法读取响应流');
  const decoder = new TextDecoder();

  if (p === 'anthropic') {
    let buffer = '', full = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n'); buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          try {
            const json = JSON.parse(data);
            if (json.type === 'content_block_delta' && json.delta?.text) {
              full += json.delta.text; onChunk(json.delta.text);
            }
          } catch {}
        }
      }
    }
    return full;
  } else {
    let buffer = '', full = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n'); buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const json = JSON.parse(data);
            const content = json.choices?.[0]?.delta?.content || '';
            if (content) { full += content; onChunk(content); }
          } catch {}
        }
      }
    }
    return full;
  }
}

function extractJSON(text: string): any {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI 返回格式异常');
  return JSON.parse(match[0]);
}

// ===== 文献分析（带 EPIC 思维过程）=====
export async function analyzeLiterature(
  docContent: string,
  docName: string,
  apiKey: string,
  onThinkingStep?: (step: string, content: string) => void,
  provider?: AIProvider,
  signal?: AbortSignal
): Promise<LiteratureAnalysis> {
  const truncated = docContent.substring(0, 12000);
  
  const prompt = `你是一位专业的学术文献分析专家。请对以下文献进行深度分析，并使用 EPIC 思维模式展示你的分析过程。

## EPIC 思维模式要求
你的思考必须严格按照以下五个步骤展开，每个步骤都要输出具体的思考内容：

1. **initial_understanding**（初始理解）：描述你第一次阅读文献时的整体印象。包括文档主题领域、内容结构、信息密度的初步判断。用第一人称描述你的理解过程。

2. **keyword_extraction_reasoning**（关键词提取推理）：详细描述你提取关键词的推理过程。说明你如何识别核心概念、专业术语和重要实体，以及为什么选择这些关键词。

3. **opinion_analysis_logic**（观点分析逻辑）：描述你如何分析文献中的核心观点和论证。说明你识别的逻辑结构、论证链条和核心论断。

4. **summary_synthesis_process**（总结综合过程）：描述你生成文献总结的综合过程。说明你如何整合各个部分的信息，形成有洞察力的总结。

5. **structure_building_thought**（结构构建思考）：描述你构建分析结构的思路。说明你如何组织分析结果，使之层次分明、逻辑清晰。

## 文献内容
文件名：${docName}
内容：
${truncated}

## 输出格式
请严格按照以下JSON格式输出（不要有任何其他文字）：

\`\`\`json
{
  "title": "文献标题（根据内容推断）",
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "summary": "200-300字的专业文献总结",
  "keyPoints": ["核心要点1", "核心要点2", "核心要点3"],
  "methodology": "研究方法分析",
  "contributions": ["理论贡献1", "实践贡献2"],
  "limitations": ["局限1", "局限2"],
  "thinkingProcess": {
    "initial_understanding": "...",
    "keyword_extraction_reasoning": "...",
    "opinion_analysis_logic": "...",
    "summary_synthesis_process": "...",
    "structure_building_thought": "..."
  }
}
\`\`\`

注意：thinkingProcess 中的每一步都要真实反映你的分析思考过程。`;

  let fullResponse = '';
  await callLLMStream(
    [{ role: 'user', content: prompt }],
    apiKey,
    (chunk) => { fullResponse += chunk; },
    provider,
    signal
  );

  const result = extractJSON(fullResponse);
  
  if (onThinkingStep && result.thinkingProcess) {
    const tp = result.thinkingProcess;
    const steps = ['initial_understanding', 'keyword_extraction_reasoning', 'opinion_analysis_logic', 'summary_synthesis_process', 'structure_building_thought'];
    for (const step of steps) {
      if (tp[step]) {
        onThinkingStep(step, tp[step]);
        await new Promise(r => setTimeout(r, 400));
      }
    }
  }

  return result;
}

// ===== 基于文献的问答（带 EPIC 思维过程）=====
export async function chatWithContext(
  question: string,
  docContent: string,
  analysis: LiteratureAnalysis | null,
  apiKey: string,
  onChunk: (text: string) => void,
  provider?: AIProvider,
  signal?: AbortSignal
): Promise<string> {
  const truncated = docContent.substring(0, 6000);
  let contextInfo = '## 文献内容\n' + truncated;
  
  if (analysis) {
    contextInfo += `\n\n## 文献分析结果\n摘要：${analysis.summary}\n关键词：${analysis.keywords.join(', ')}\n核心要点：${analysis.keyPoints.join('; ')}\n方法：${analysis.methodology}`;
  }

  const prompt = `你是一位学术文献分析专家。请使用 EPIC 思维模式回答用户关于文献的问题。

## 回答要求
你必须在回答中展示完整的 EPIC 思维过程，然后给出最终答案。请按以下结构组织你的回答：

### 🧠 EPIC 思维分析过程

**1. 初始理解 (Initial Understanding)**
思考：用户问的是什么问题？这个问题涉及文献的哪个方面？我需要从文献中哪些部分寻找答案？

**2. 信息提取推理 (Information Extraction Reasoning)**
思考：我需要从文献中提取哪些关键信息来回答这个问题？这些信息在文献中的上下文和关联是什么？

**3. 逻辑分析 (Logic Analysis)**
思考：如何整合提取的信息来回答用户的问题？信息之间的逻辑关系是什么？我需要做出什么判断或推论？

**4. 综合回答构建 (Answer Synthesis)**
思考：如何组织我的回答，使其既有深度又易于理解？回答的结构应该如何安排？

### 💡 最终回答
（在这里给出完整、专业的回答）

## 文献信息
${contextInfo}

## 用户问题
${question}

注意：必须展示你的 EPIC 思考过程，然后给出最终回答。思考过程要真实、具体，不能是空泛的描述。最终回答要引用文献中的具体内容作为依据。`;

  return await callLLMStream(
    [{ role: 'user', content: prompt }],
    apiKey,
    onChunk,
    provider,
    signal
  );
}
