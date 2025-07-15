// Common types that were previously imported from @refly/ai-workspace-common

// Canvas related types
export enum CanvasNodeType {
  Document = 'document',
  Resource = 'resource',
  Skill = 'skill',
  Note = 'note',
  Memo = 'memo',
  Folder = 'folder',
  Project = 'project',
  Query = 'query',
  Response = 'response',
  Tool = 'tool',
  Action = 'action',
}

// Navigation context for copilot
export interface NavigationContext {
  type: 'canvas' | 'document' | 'project' | 'global';
  id?: string;
  title?: string;
  metadata?: Record<string, any>;
}

// Locale types
export type OutputLocale = 'en' | 'zh' | 'ja' | 'ko' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ru';

// Project directory types
export interface SourceObject {
  id: string;
  type: string;
  name: string;
  path?: string;
  children?: SourceObject[];
  metadata?: Record<string, any>;
}

// Message intent source for chat
export enum MessageIntentSource {
  Canvas = 'canvas',
  Document = 'document',
  Project = 'project',
  Global = 'global',
  Search = 'search',
}
