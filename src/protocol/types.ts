import type { Part, SourceRef, ToolOutcome } from './parts';

export type Provider =
  | 'auto'
  | 'ollama'
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'perplexity'
  | 'groq'
  | 'cohere'
  | 'xai'
  | 'deepseek';

// ── Message Types ───────────────────────────────────────────────────────────

export interface ToolCallInfo {
  tool: string;
  status: 'calling' | 'done' | 'error';
  args?: unknown;
  result?: unknown;
  error?: string;
  durationMs?: number;
}

export interface ThinkingData {
  mood?: string;
  approach?: string;
  keyMemory?: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface TokenBreakdown {
  systemPrompt: { personality: number; thinking: number; lorebook: number };
  memory: {
    userProfile: number;
    retrievedMemories: number;
    conversationSummary: number;
    recentMessages: number;
  };
  tools: { count: number; estimated: number };
  userMessage: number;
  total: number;
}

export interface DebugInfo {
  provider: string;
  requestedProvider?: string;
  model: string;
  tier: number;
  isDegraded: boolean;
  degradationReason?: string;
  isPrivate?: boolean;
  maxTokens?: number;
  personalityDepth?: string;
  thinking?: ThinkingData;
  usage?: TokenUsage;
  tokenBreakdown?: TokenBreakdown;
  durationMs?: number;
  memoryContext?: {
    workingMemorySize: number;
    retrievedMemories: Array<{
      id: string;
      type: string;
      preview: string;
    }>;
  };
  systemPromptSections?: Array<{
    name: string;
    category: string;
    content: string;
    tokens: number;
  }>;
  toolCalls?: Array<{
    tool: string;
    args: unknown;
    result: unknown;
    durationMs: number;
    success: boolean;
  }>;
}

// ── Request / Response ──────────────────────────────────────────────────────
// ── Streaming ───────────────────────────────────────────────────────────────

export interface StreamTextEvent {
  type: 'text';
  delta: string;
}

export interface StreamToolEvent {
  type: 'tool_call';
  tool: string;
  status: string;
  /** rem-core R2 (#2091). Absent from older rem-core and some tiers: match by name then. */
  toolCallId?: string;
  category?: string;
  args?: unknown;
  result?: unknown;
  error?: string;
  media?: Array<{ url: string; mediaType: string; width?: number; height?: number; alt?: string }>;
  /** rem-core R3b: the call's real outcome; absent from older rem-core. */
  outcome?: ToolOutcome;
  errorText?: string;
  /** rem-core #2140: a card for this call; validated in the reducer. */
  card?: unknown;
}

/** rem-core R4 (#2091): one web_search call's results, numbered [1]..[n] in that call's order. */
export interface StreamSourcesEvent {
  type: 'sources';
  /** The call these belong to; absent from the voice-path event. */
  toolCallId?: string;
  /** Raw from the wire: `n` may be missing (older rem-core); the reducer validates. */
  sources: Array<Partial<SourceRef>>;
}

export interface StreamDoneEvent {
  type: 'done';
  debug: DebugInfo;
}

export interface StreamErrorEvent {
  type: 'error';
  message: string;
}

export type StreamEvent =
  | StreamTextEvent
  | StreamToolEvent
  | StreamSourcesEvent
  | StreamDoneEvent
  | StreamErrorEvent;

// ── Conversation / Session ──────────────────────────────────────────────────

/** The fields the protocol reads/writes. Apps extend it (RemHub's Message adds compare/private). */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  provider?: Provider;
  debug?: DebugInfo;
  isLoading?: boolean;
  error?: string;
  toolCalls?: ToolCallInfo[];
  /** The user pressed Stop before the reply finished. */
  stopped?: boolean;
  /** Ordered reply parts; `toParts` derives them for older messages. */
  parts?: Part[];
}
