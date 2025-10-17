export type MentionItemSource =
  | 'variables'
  | 'stepRecord'
  | 'resourceLibrary'
  | 'resultRecord'
  | 'myUpload'
  | 'toolsets'
  | 'tools';

export type MentionItemType = 'var' | 'step' | 'resource' | 'toolset' | 'tool';

export const mentionItemSourceToType: Record<MentionItemSource, MentionItemType> = {
  variables: 'var',
  stepRecord: 'step',
  resourceLibrary: 'resource',
  resultRecord: 'resource',
  myUpload: 'resource',
  toolsets: 'toolset',
  tools: 'tool',
};
