import { CanvasNodeType, SelectionKey } from '@refly/openapi-schema';

// Define background colors for different node types
export const NODE_COLORS: Record<CanvasNodeType | 'threadHistory' | SelectionKey, string> = {
  document: 'var(--refly-Colorful-Blue)',
  documentSelection: 'var(--refly-Colorful-Blue)',
  documentCursorSelection: 'var(--refly-Colorful-Blue)',
  documentBeforeCursorSelection: 'var(--refly-Colorful-Blue)',
  documentAfterCursorSelection: 'var(--refly-Colorful-Blue)',

  codeArtifact: 'var(--refly-Colorful-Blue)',
  website: 'var(--refly-Colorful-Blue)',

  resource: 'var(--refly-primary-default)',
  resourceSelection: 'var(--refly-primary-default)',

  skillResponse: 'var(--refly-Colorful-orange)',
  skillResponseSelection: 'var(--refly-Colorful-orange)',
  toolResponse: 'var(--refly-Colorful-orange)',
  memo: 'var(--refly-Colorful-orange)',

  skill: '#6172F3',
  mediaSkill: '#E93D82',
  mediaSkillResponse: '#E93D82',
  tool: '#2E90FA',
  group: 'var(--refly-primary-default)',
  threadHistory: '#64748b',
  image: '#02b0c7',

  video: 'var(--refly-Colorful-red)',
  audio: 'var(--refly-Colorful-red)',
  extensionWeblinkSelection: '#17B26A',
};
export const NODE_MINI_MAP_COLORS = {
  ...NODE_COLORS,
  resource: '#40df2b',
  group: '#bfc5bf',
  memo: 'transparent',
};
