export type MentionItemSource =
  | 'variables'
  | 'stepRecord'
  | 'resourceLibrary'
  | 'resultRecord'
  | 'myUpload'
  | 'tools';

export type MentionItemType = 'var' | 'step' | 'resource' | 'tool';

export const mentionItemSourceToType: Record<MentionItemSource, MentionItemType> = {
  variables: 'var',
  stepRecord: 'step',
  resourceLibrary: 'resource',
  resultRecord: 'resource',
  myUpload: 'resource',
  tools: 'tool',
};
