import { WorkflowVariable } from '@refly/openapi-schema';

export interface TextSegment {
  type: 'text' | 'variable';
  content: string;
  id?: string;
  placeholder?: string;
  variable?: WorkflowVariable;
}

export interface MixedTextEditorProps {
  templateContent: string;
  variables?: WorkflowVariable[];
  onVariablesChange?: (variables: WorkflowVariable[]) => void;
  className?: string;
  disabled?: boolean;
}

export interface VariableInputProps {
  id: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}
