export type AIProvider = 'openai' | 'anthropic' | 'deepseek';

export interface UploadedDoc {
  id: string; name: string; content: string; type: string; size: number; uploadedAt: number; analyzed: boolean;
}

export interface ThinkingProcess {
  initial_understanding: string;
  keyword_extraction_reasoning: string;
  opinion_analysis_logic: string;
  summary_synthesis_process: string;
  structure_building_thought: string;
}

export interface LiteratureAnalysis {
  title: string;
  keywords: string[];
  summary: string;
  keyPoints: string[];
  methodology: string;
  contributions: string[];
  limitations: string[];
  thinkingProcess: ThinkingProcess;
  rawAnalysis: string;
}

export interface Message {
  id: string; role: 'user' | 'assistant'; content: string;
  thinkingProcess?: ThinkingProcess; docContext?: string; timestamp: number;
}

export interface ChatSession {
  id: string; title: string; messages: Message[]; createdAt: number; docId?: string;
}
