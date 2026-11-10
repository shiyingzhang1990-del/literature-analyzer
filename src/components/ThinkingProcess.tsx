import { ThinkingProcess } from '../types';

interface Props { process: ThinkingProcess; }

const labels: Record<string, string> = {
  initial_understanding: '初始理解',
  keyword_extraction_reasoning: '关键词提取推理',
  opinion_analysis_logic: '观点分析逻辑',
  summary_synthesis_process: '总结综合过程',
  structure_building_thought: '结构构建思考',
};

export default function ThinkingProcessView({ process }: Props) {
  const steps = ['initial_understanding', 'keyword_extraction_reasoning', 'opinion_analysis_logic', 'summary_synthesis_process', 'structure_building_thought'];

  return (
    <div className="thinking-process">
      <h3>🧠 EPIC 思维分析过程</h3>
      <div className="epic-steps">
        {steps.map((key, i) => {
          const content = (process as any)[key];
          if (!content) return null;
          return (
            <div key={key} className="epic-step">
              <div className="epic-step-header">
                <span className="epic-step-num">{i + 1}</span>
                <span className="epic-step-name">{labels[key] || key}</span>
                <span className="epic-step-icon">✨</span>
              </div>
              <div className="epic-step-body">{content}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
