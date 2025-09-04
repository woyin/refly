export interface MCPToolInputSchema {
  type: string;
  title: string;
  description?: string;
  required?: string[];
  properties: Record<string, object>;
}

export interface MCPTool {
  id: string;
  serverId: string;
  serverName: string;
  name: string;
  description?: string;
  inputSchema: MCPToolInputSchema;
}

export const SYSTEM_PROMPT = `You have access to a set of tools to help you answer the user's question.

## CRITICAL: Tool Call Format Requirements
You MUST use the structured tool_calls format that LangChain can parse. DO NOT use text-based formats like <tool_use> tags or similar formats.

When you need to call a tool, generate your response in a way that LangChain's bindTools mechanism can parse into tool_calls format. The system will automatically convert your tool calls into the proper format.

## Tool Usage Guide
- **Identify Need**: Determine if a tool can help you gather information or perform an action to fulfill the user's request.
- **Generate Structured Call**: Create tool calls that LangChain can parse into tool_calls format.
- **Provide Arguments**: Supply the arguments for the selected tool, making sure they match the tool's defined input schema.
- **Receive Result**: After the tool is executed by the system, its output will be provided back to you as ToolMessage objects.
- **Continue**: Use the tool's result to formulate your response or decide on the next step.

## Tool Use Examples
{{ TOOL_USE_EXAMPLES }}

## Available Tools
Here are the tools you can use. For each tool, an input schema describes the arguments it expects. You MUST provide arguments that conform to this schema.
{{ AVAILABLE_TOOLS }}

## General Rules
1. Always use formats that LangChain can parse into tool_calls - never use <tool_use> tags or similar text-based formats.
2. Carefully check the input schema for each tool and ensure your arguments are valid.
3. Only use tools when they are necessary to answer the user's request or perform a required action. If you can answer directly, please do so.
4. You can request multiple tool calls in a single turn if it's efficient to do so.
5. Avoid re-running a tool with the exact same arguments if you've already received a satisfactory result, unless the context has significantly changed or the previous attempt failed.

# User Instructions
{{ USER_SYSTEM_PROMPT }}

Now Begin!
`;

export const ToolUseExamples = `
Here are examples of how to use tools correctly with LangChain's bindTools mechanism:

---
Example 1: Weather and News Query
User: What's the weather like in Paris and what's the main news headline there?

Assistant: I'll help you get both the weather and news information for Paris.

[Model generates response that LangChain's bindTools mechanism can parse into tool_calls format. The response should be structured so that LangChain can extract tool calls like:]
{
  "tool_calls": [
    {
      "name": "weather_tool",
      "args": {"city": "Paris"},
      "id": "call_weather_123"
    },
    {
      "name": "news_tool", 
      "args": {"city": "Paris", "max_headlines": 1},
      "id": "call_news_456"
    }
  ]
}

System: [Tool results are returned as ToolMessage objects]

Assistant: The weather in Paris is 15°C and cloudy. The main news headline is: "Major art exhibition opens at the Louvre."

---
Example 2: Calculator Tool
User: Calculate the square root of 144 and then tell me a joke about numbers.

Assistant: I'll calculate the square root of 144 for you.

[Model generates response that LangChain's bindTools mechanism can parse into tool_calls format:]
{
  "tool_calls": [
    {
      "name": "calculator",
      "args": {"operation": "sqrt", "number": 144},
      "id": "call_calc_789"
    }
  ]
}

System: [Tool result returned as ToolMessage]

Assistant: The square root of 144 is 12. Now for a joke: Why was the number six afraid of seven? Because seven, eight (ate), nine!

---
IMPORTANT: Generate responses that LangChain's bindTools mechanism can parse. Avoid text-based formats like <tool_use> tags or similar formats. The system will automatically convert your tool calls into the proper tool_calls format.
`;

export const AvailableTools = (tools: MCPTool[]) => {
  const availableTools = tools
    .map((tool) => {
      return `
Tool Name: ${tool.id}
Description: ${tool.description || tool.inputSchema.title || 'No description available.'}
Input Schema: ${JSON.stringify(tool.inputSchema, null, 2)}

CRITICAL: When calling this tool, use the tool_calls format that LangChain can parse with:
- name: "${tool.id}"
- args: object matching the input schema above
- id: unique identifier for the call
`;
    })
    .join('');
  return `You have access to the following tools:\n${availableTools}`;
};

export const buildSystemPrompt = (userSystemPrompt: string, tools: MCPTool[]): string => {
  if (tools && tools.length > 0) {
    const systemPrompt = SYSTEM_PROMPT.replace('{{ USER_SYSTEM_PROMPT }}', userSystemPrompt)
      .replace('{{ TOOL_USE_EXAMPLES }}', ToolUseExamples)
      .replace('{{ AVAILABLE_TOOLS }}', AvailableTools(tools));

    return systemPrompt;
  }

  return userSystemPrompt;
};
