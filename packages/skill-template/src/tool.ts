export interface ToolInputSchema {
  type: string;
  title: string;
  description?: string;
  required?: string[];
  properties: Record<string, object>;
}

export interface ITool {
  id: string;
  serverId: string;
  serverName: string;
  name: string;
  description?: string;
  inputSchema: ToolInputSchema;
}
