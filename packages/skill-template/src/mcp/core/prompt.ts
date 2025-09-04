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

## 🚨 CRITICAL FORMAT REQUIREMENT 🚨
You MUST generate tool calls in the EXACT format that LangChain expects. 
NEVER use <tool_use> tags, XML-like formats, or any text-based tool call formats.

REQUIRED FORMAT (JSON-like structure that LangChain can parse):
{
  "tool_calls": [
    {
      "name": "tool_name",
      "args": {"param1": "value1", "param2": "value2"},
      "id": "call_unique_id"
    }
  ]
}

FORBIDDEN FORMATS:
❌ <tool_use><name>tool_name</name><arguments>...</arguments></tool_use>
❌ Any XML-like tags
❌ Text descriptions of tool calls
❌ Markdown code blocks with tool calls

The system will automatically parse your structured tool calls into the proper format.

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

## Special Instructions for Builtin Tools
When using builtin tools, pay special attention to these requirements:

### Builtin Tool Names (Use EXACTLY as shown):
- library_search - Search within Refly knowledge base
- web_search - Search the web for current information  
- generate_media - Generate images, audio, or video content
- generate_doc - Create or save content to a document
- generate_code_artifact - Create code artifacts (React, HTML, etc.)
- send_email - Send emails with HTML content
- get_time - Get current date and time information

### Critical Parameter Requirements:
- library_search: Always include query (required), optionally domains, mode, limit, projectId
- web_search: Always include query (required) and num_results (default: 5)
- generate_media: Always include mediaType (image/audio/video) and prompt (required)
- generate_doc: Always include title and content (both required)
- generate_code_artifact: Always include title, type, and content (all required)
- send_email: Always include subject and html (required), optionally to and attachments
- get_time: No parameters required, use empty args object {}

## General Rules
1. Always use formats that LangChain can parse into tool_calls - never use <tool_use> tags or similar text-based formats.
2. Carefully check the input schema for each tool and ensure your arguments are valid.
3. Only use tools when they are necessary to answer the user's request or perform a required action. If you can answer directly, please do so.
4. You can request multiple tool calls in a single turn if it's efficient to do so.
5. Avoid re-running a tool with the exact same arguments if you've already received a satisfactory result, unless the context has significantly changed or the previous attempt failed.
6. For builtin tools, ensure you use the exact tool names and parameter names as specified above.

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
Example 3: Builtin Tools - Library Search
User: Search for information about React components in my knowledge base.

Assistant: I'll search your knowledge base for React component information.

[Model generates response that LangChain's bindTools mechanism can parse into tool_calls format:]
{
  "tool_calls": [
    {
      "name": "library_search",
      "args": {
        "query": "React components",
        "domains": ["resource", "document"],
        "mode": "vector",
        "limit": 10
      },
      "id": "call_library_${Date.now()}"
    }
  ]
}

System: [Tool result returned as ToolMessage]

Assistant: I found several resources about React components in your knowledge base...

---
Example 4: Builtin Tools - Web Search
User: Search for the latest information about AI developments.

Assistant: I'll search the web for the latest AI developments.

[Model generates response that LangChain's bindTools mechanism can parse into tool_calls format:]
{
  "tool_calls": [
    {
      "name": "web_search",
      "args": {
        "query": "latest AI developments 2024",
        "num_results": 5
      },
      "id": "call_web_${Date.now()}"
    }
  ]
}

System: [Tool result returned as ToolMessage]

Assistant: Based on the web search results, here are the latest AI developments...

---
Example 5: Builtin Tools - Generate Media
User: Generate an image of a futuristic city.

Assistant: I'll generate an image of a futuristic city for you.

[Model generates response that LangChain's bindTools mechanism can parse into tool_calls format:]
{
  "tool_calls": [
    {
      "name": "generate_media",
      "args": {
        "mediaType": "image",
        "prompt": "A futuristic city with tall buildings, flying cars, and neon lights",
        "targetType": "mediaResult"
      },
      "id": "call_media_${Date.now()}"
    }
  ]
}

System: [Tool result returned as ToolMessage]

Assistant: I've generated a futuristic city image for you. The image shows...

---
Example 6: Builtin Tools - Generate Document
User: Create a document about machine learning basics.

Assistant: I'll create a document about machine learning basics for you.

[Model generates response that LangChain's bindTools mechanism can parse into tool_calls format:]
{
  "tool_calls": [
    {
      "name": "generate_doc",
      "args": {
        "title": "Machine Learning Basics",
        "content": "# Machine Learning Basics\n\nMachine learning is a subset of artificial intelligence..."
      },
      "id": "call_doc_${Date.now()}"
    }
  ]
}

System: [Tool result returned as ToolMessage]

Assistant: I've created a document titled "Machine Learning Basics" with comprehensive content...

---
Example 7: Builtin Tools - Generate Code Artifact
User: Create a React component for a todo list.

Assistant: I'll create a React component for a todo list.

[Model generates response that LangChain's bindTools mechanism can parse into tool_calls format:]
{
  "tool_calls": [
    {
      "name": "generate_code_artifact",
      "args": {
        "title": "TodoList React Component",
        "type": "application/refly.artifacts.react",
        "content": "import React, { useState } from 'react';\n\nconst TodoList = () => {\n  const [todos, setTodos] = useState([]);\n  // ... component code"
      },
      "id": "call_code_${Date.now()}"
    }
  ]
}

System: [Tool result returned as ToolMessage]

Assistant: I've created a React TodoList component with state management...

---
Example 8: Builtin Tools - Send Email
User: Send an email to john@example.com about the project update.

Assistant: I'll send an email to john@example.com about the project update.

[Model generates response that LangChain's bindTools mechanism can parse into tool_calls format:]
{
  "tool_calls": [
    {
      "name": "send_email",
      "args": {
        "subject": "Project Update",
        "html": "<h2>Project Update</h2><p>Here's the latest update on our project...</p>",
        "to": "john@example.com"
      },
      "id": "call_email_${Date.now()}"
    }
  ]
}

System: [Tool result returned as ToolMessage]

Assistant: I've sent the project update email to john@example.com...

---
Example 9: Builtin Tools - Get Time
User: What time is it now?

Assistant: I'll get the current time for you.

[Model generates response that LangChain's bindTools mechanism can parse into tool_calls format:]
{
  "tool_calls": [
    {
      "name": "get_time",
      "args": {},
      "id": "call_time_${Date.now()}"
    }
  ]
}

System: [Tool result returned as ToolMessage]

Assistant: The current time is 2024-01-15T10:30:00.000Z (Monday, January 15, 2024)...

---
Example 10: Multiple Builtin Tools
User: Search for AI news, create a document about it, and send me an email summary.

Assistant: I'll search for AI news, create a document, and send you an email summary.

[Model generates response that LangChain's bindTools mechanism can parse into tool_calls format:]
{
  "tool_calls": [
    {
      "name": "web_search",
      "args": {
        "query": "AI news 2024",
        "num_results": 5
      },
      "id": "call_web_${Date.now()}"
    },
    {
      "name": "generate_doc",
      "args": {
        "title": "AI News Summary 2024",
        "content": "# AI News Summary 2024\n\nBased on recent web search results..."
      },
      "id": "call_doc_${Date.now() + 1}"
    },
    {
      "name": "send_email",
      "args": {
        "subject": "AI News Summary",
        "html": "<h2>AI News Summary</h2><p>Here's a summary of the latest AI news...</p>"
      },
      "id": "call_email_${Date.now() + 2}"
    }
  ]
}

System: [Tool results returned as ToolMessage objects]

Assistant: I've completed all three tasks: searched for AI news, created a document summary, and sent you an email...

---
🚨 CRITICAL REMINDER FOR BUILTIN TOOLS 🚨
- ALWAYS use the structured tool_calls format shown above
- NEVER use <tool_use> tags or XML-like formats
- Each tool call MUST have: name, args, and id
- The id should be unique (use timestamp or random string)
- The args must match the tool's input schema exactly
- For builtin tools, use the exact tool names: library_search, web_search, generate_media, generate_doc, generate_code_artifact, send_email, get_time
- Pay special attention to required vs optional parameters in each tool's schema
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
