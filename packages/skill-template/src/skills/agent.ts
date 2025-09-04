import { START, END, StateGraphArgs, StateGraph, MessagesAnnotation } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { z } from 'zod';
import { BaseSkill, BaseSkillState, SkillRunnableConfig, baseStateGraphArgs } from '../base';
import { Icon, SkillTemplateConfigDefinition, User } from '@refly/openapi-schema';

// types
import { GraphState } from '../scheduler/types';
// utils
import { buildFinalRequestMessages, SkillPromptModule } from '../scheduler/utils/message';

// prompts
import * as commonQnA from '../scheduler/module/commonQnA';
import { buildSystemPrompt } from '../mcp/core/prompt';
import { MCPTool, MCPToolInputSchema } from '../mcp/core/prompt';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { AIMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import type { Runnable } from '@langchain/core/runnables';
import { type StructuredToolInterface } from '@langchain/core/tools'; // For MCP Tools
import { ToolCall } from '@langchain/core/messages/tool';

// Enhanced state interface for intelligent problem-solving
interface EnhancedGraphState extends GraphState {
  taskProgress: {
    completed: string[];
    pending: string[];
    failed: string[];
  };
  failureHistory: Array<{
    step: number;
    error: string;
    timestamp: Date;
    recoveryAction: string;
  }>;
  retryCount: number;
  maxRetries: number;
}

/**
 * Task decomposition and progress tracking for intelligent problem-solving
 */
const TaskTracker = {
  decomposeTask(userQuery: string): string[] {
    // Intelligent task decomposition based on user intent
    const tasks: string[] = [];

    if (userQuery.toLowerCase().includes('search') || userQuery.toLowerCase().includes('find')) {
      tasks.push('search_information');
    }
    if (
      userQuery.toLowerCase().includes('create') ||
      userQuery.toLowerCase().includes('generate')
    ) {
      tasks.push('create_content');
    }
    if (userQuery.toLowerCase().includes('send') || userQuery.toLowerCase().includes('email')) {
      tasks.push('send_communication');
    }
    if (
      userQuery.toLowerCase().includes('calculate') ||
      userQuery.toLowerCase().includes('compute')
    ) {
      tasks.push('perform_calculation');
    }

    // If no specific tasks identified, add a general task
    if (tasks.length === 0) {
      tasks.push('answer_question');
    }

    return tasks;
  },

  updateProgress(state: EnhancedGraphState, completedStep: string): void {
    if (state.taskProgress) {
      state.taskProgress.completed.push(completedStep);
      state.taskProgress.pending = state.taskProgress.pending.filter(
        (step) => step !== completedStep,
      );
    }
  },

  isTaskComplete(state: EnhancedGraphState): boolean {
    return state.taskProgress?.pending.length === 0 && state.taskProgress?.failed.length === 0;
  },
};

/**
 * Converts LangChain StructuredToolInterface array to MCPTool array.
 * This is used to prepare tools for the system prompt, matching the MCPTool interface.
 */
function convertToMCPTools(langchainTools: StructuredToolInterface[]): MCPTool[] {
  return langchainTools.map((tool) => {
    // tool.schema is expected to be a Zod schema object
    const zodSchema = tool.schema;
    // Convert Zod schema to JSON schema.
    // The `as any` is used because zodToJsonSchema returns a generic JSONSchema7Type,
    // and we need to access properties like title, description, etc., which might not be strictly typed.
    const jsonSchema = zodToJsonSchema(zodSchema as any) as any;

    const properties = (jsonSchema?.properties ?? {}) as Record<string, object>;
    const propertyKeys = Object.keys(properties);

    const inputSchema: MCPToolInputSchema = {
      type: jsonSchema.type || 'object',
      title: jsonSchema.title || tool.name,
      description: jsonSchema.description || tool.description || '',
      properties,
      // Azure OpenAI requires `required` to list every key in properties when present
      required: propertyKeys,
    };

    return {
      id: tool.name,
      serverId: '',
      serverName: '',
      name: tool.name,
      description: tool.description || '',
      inputSchema,
    };
  });
}

// Define a more specific type for the compiled graph
type CompiledGraphApp = {
  invoke: (
    input: { messages: BaseMessage[] },
    config?: any,
  ) => Promise<{ messages: BaseMessage[] }>;
};

interface AgentComponents {
  tools: StructuredToolInterface[];
  compiledLangGraphApp: CompiledGraphApp;
  mcpAvailable: boolean;
}

export class Agent extends BaseSkill {
  name = 'commonQnA';

  icon: Icon = { type: 'emoji', value: '💬' };

  configSchema: SkillTemplateConfigDefinition = {
    items: [],
  };

  description = 'Answer common questions';

  schema = z.object({
    query: z.string().optional().describe('The question to be answered'),
    images: z.array(z.string()).optional().describe('The images to be read by the skill'),
  });

  graphState: StateGraphArgs<BaseSkillState>['channels'] = {
    ...baseStateGraphArgs,
  };

  commonPreprocess = async (
    state: GraphState,
    config: SkillRunnableConfig,
    module: SkillPromptModule,
    customInstructions?: string,
  ) => {
    const { query, messages = [], images = [] } = state;
    const { locale = 'auto', preprocessResult } = config.configurable;
    const { optimizedQuery, rewrittenQueries, context, sources, usedChatHistory } =
      preprocessResult;

    const requestMessages = buildFinalRequestMessages({
      module,
      locale,
      chatHistory: usedChatHistory,
      messages,
      context,
      images,
      originalQuery: query,
      optimizedQuery,
      rewrittenQueries,
      modelInfo: config?.configurable?.modelConfigMap.chat,
      customInstructions,
    });

    return { requestMessages, sources };
  };

  private async initializeAgentComponents(
    user: User,
    config?: SkillRunnableConfig,
  ): Promise<AgentComponents> {
    const userId = user?.uid ?? user?.email ?? JSON.stringify(user);
    const { selectedTools = [] } = config?.configurable ?? {};

    this.engine.logger.log(`Initializing new agent components for user ${userId}`);
    let actualToolNodeInstance: ToolNode<typeof MessagesAnnotation.State> | null = null;

    // LLM and LangGraph Setup
    const baseLlm = this.engine.chatModel({ temperature: 0.1 });
    let llmForGraph: Runnable<BaseMessage[], AIMessage>;

    if (selectedTools.length > 0) {
      // Ensure tool definitions are valid before binding
      const validTools = selectedTools.filter(
        (tool) => tool.name && tool.description && tool.schema,
      );

      if (validTools.length > 0) {
        this.engine.logger.log(
          `Binding ${validTools.length} valid tools to LLM with tool_choice="auto"`,
        );
        // Use tool_choice="auto" to force LLM to decide when to use tools
        // This ensures proper tool_calls format generation
        llmForGraph = baseLlm.bindTools(validTools, { tool_choice: 'auto' });
        actualToolNodeInstance = new ToolNode(validTools);
      } else {
        this.engine.logger.warn('No valid tools found, using base LLM without tools');
        llmForGraph = baseLlm;
      }
    } else {
      this.engine.logger.log('No tools selected, using base LLM without tools');
      llmForGraph = baseLlm;
    }

    // Tool call format validation function
    const validateToolCalls = (message: AIMessage): boolean => {
      if (message.tool_calls) {
        for (const toolCall of message.tool_calls) {
          if (!toolCall.id || !toolCall.name || !toolCall.args) {
            this.engine.logger.warn('Invalid tool_call format detected:', toolCall);
            return false;
          }
        }
        return true;
      }
      return false;
    };

    // Detect and fix text-based tool call formats
    const detectAndFixToolCallFormat = (response: AIMessage): AIMessage => {
      // Only process if content is a string
      if (typeof response.content !== 'string') {
        return response;
      }

      const content = response.content;

      // Check for forbidden formats
      if (
        content &&
        (content.includes('<tool_use>') ||
          content.includes('<tool_call>') ||
          (content.includes('<name>') && content.includes('<arguments>')))
      ) {
        this.engine.logger.warn('Detected text-based tool call format, attempting to fix...');

        // Try to extract tool call information and convert to proper format
        try {
          const toolCalls = extractToolCallsFromText(content);
          if (toolCalls.length > 0) {
            this.engine.logger.log(
              `Successfully extracted ${toolCalls.length} tool calls from text format`,
            );
            return new AIMessage({
              content: content.replace(/<tool_use>[\s\S]*?<\/tool_use>/g, '').trim(),
              tool_calls: toolCalls,
            });
          }
        } catch (error) {
          this.engine.logger.error('Failed to extract tool calls from text format:', error);
        }
      }

      return response;
    };

    // Extract tool calls from text format (fallback mechanism)
    const extractToolCallsFromText = (text: string): ToolCall[] => {
      const toolCalls: ToolCall[] = [];
      const toolUseRegex =
        /<tool_use>\s*<name>([^<]+)<\/name>\s*<arguments>\s*([^<]+)\s*<\/arguments>\s*<\/tool_use>/g;

      let match: RegExpExecArray | null;
      // eslint-disable-next-line no-cond-assign
      // biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
      while ((match = toolUseRegex.exec(text)) !== null) {
        const [, name, argsStr] = match;
        try {
          const args = JSON.parse(argsStr);
          toolCalls.push({
            name: name.trim(),
            args,
            id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'tool_call',
          });
        } catch (error) {
          this.engine.logger.warn(`Failed to parse tool call arguments for ${name}:`, error);
        }
      }

      return toolCalls;
    };

    // Tool call parameter validation function
    const validateToolCallArgs = (
      toolCall: ToolCall,
      tools: StructuredToolInterface[],
    ): boolean => {
      const tool = tools.find((t) => t.name === toolCall.name);
      if (!tool) {
        this.engine.logger.warn(`Tool not found: ${toolCall.name}`);
        return false;
      }

      try {
        // Basic validation - check if required fields exist
        if (!toolCall.args || typeof toolCall.args !== 'object') {
          this.engine.logger.warn(
            `Invalid tool call arguments for ${toolCall.name}: args must be an object`,
          );
          return false;
        }

        // For now, we'll do basic validation since tool.schema.parse might not be available
        // This can be enhanced later with proper schema validation
        return true;
      } catch (error) {
        this.engine.logger.warn(`Invalid tool call arguments for ${toolCall.name}:`, error);
        return false;
      }
    };

    const llmNodeForCachedGraph = async (nodeState: typeof MessagesAnnotation.State) => {
      const maxRetries = 3;
      let attempts = 0;

      while (attempts <= maxRetries) {
        try {
          // Use llmForGraph, which is the (potentially tool-bound) LLM instance for the graph
          let response = await llmForGraph.invoke(nodeState.messages);

          // Add debug logging for tool calls
          const contentPreview =
            typeof response.content === 'string'
              ? `${response.content.substring(0, 200)}...`
              : 'Non-string content';

          this.engine.logger.log(`LLM response received (attempt ${attempts + 1}):`, {
            hasToolCalls: !!response.tool_calls,
            toolCallsCount: response.tool_calls?.length || 0,
            toolCalls: response.tool_calls,
            content: contentPreview, // Log first 200 chars
          });

          // Detect and fix text-based tool call formats
          response = detectAndFixToolCallFormat(response);

          // Validate tool calls format if present
          if (response.tool_calls) {
            const isValid = validateToolCalls(response);
            if (!isValid && attempts < maxRetries) {
              this.engine.logger.warn(
                `Invalid tool_calls format detected (attempt ${attempts + 1}), retrying with correction prompt...`,
              );

              // Add correction prompt and retry
              const correctionPrompt = new SystemMessage(
                'Your previous response contained incorrect tool call format. Please use the structured tool_calls format as specified in the system prompt. Generate tool calls in the exact JSON format that LangChain expects, with name, args, and id fields.',
              );

              nodeState.messages.push(correctionPrompt);
              attempts++;
              continue;
            } else if (!isValid) {
              this.engine.logger.error(
                'Invalid tool_calls format detected after all retry attempts, this may cause routing issues',
              );
            } else {
              this.engine.logger.log('Tool calls format validation passed');
            }
          }

          return { messages: [response] }; // Ensure response is treated as AIMessage
        } catch (error) {
          this.engine.logger.error(`LLM execution failed (attempt ${attempts + 1}):`, error);

          if (attempts < maxRetries) {
            // Add intelligent failure recovery prompt
            const recoveryPrompt = new SystemMessage(
              `I encountered an error: ${error.message}. As an intelligent problem-solving assistant, I need to analyze what went wrong and try a different approach. Please help me understand the issue and provide an alternative solution. Remember: I must continue working until the user's request is fully satisfied.`,
            );

            nodeState.messages.push(recoveryPrompt);
            attempts++;
            continue;
          }

          // Final failure recovery strategy with intelligent response
          const fallbackResponse = new AIMessage(
            `I apologize for the technical difficulty. As your persistent problem-solving assistant, I encountered an error but I'm committed to helping you. Let me try a different approach or suggest alternative ways to fulfill your request. Please let me know if you'd like me to try again or if you have any specific preferences for how to proceed.`,
          );

          return { messages: [fallbackResponse] };
        }
      }

      // This should never be reached, but just in case
      const fallbackResponse = new AIMessage(
        `I've encountered multiple technical difficulties, but as your dedicated assistant, I'm still here to help. Please try rephrasing your request or breaking it into smaller parts, and I'll do my best to assist you with a fresh approach.`,
      );
      return { messages: [fallbackResponse] };
    };

    // Initialize StateGraph with explicit generic arguments for State and all possible Node names
    // @ts-ignore - Suppressing persistent type error with StateGraph constructor and generics
    let workflow = new StateGraph(
      MessagesAnnotation, // This provides the schema and channel definitions
    );

    // Build the graph step-by-step, using 'as typeof workflow' to maintain the broad type.
    // @ts-ignore - Suppressing persistent type error with addNode and runnable type mismatch
    workflow = workflow.addNode('llm', llmNodeForCachedGraph);
    // @ts-ignore - Suppressing persistent type error with addEdge and node name mismatch
    workflow = workflow.addEdge(START, 'llm');

    if (actualToolNodeInstance) {
      // @ts-ignore - Suppressing persistent type error with addNode and runnable type mismatch
      workflow = workflow.addNode('tools', actualToolNodeInstance);
      // @ts-ignore - Suppressing persistent type error with addEdge and node name mismatch
      workflow = workflow.addEdge('tools', 'llm'); // Output of tools goes back to LLM

      // addConditionalEdges does not return the graph instance, so no 'as typeof workflow' needed here
      // if the 'workflow' variable already has the correct comprehensive type.
      // @ts-ignore - Suppressing persistent type error with addConditionalEdges and node name mismatch
      workflow.addConditionalEdges('llm', (graphState: typeof MessagesAnnotation.State) => {
        const lastMessage = graphState.messages[graphState.messages.length - 1] as AIMessage;

        if (lastMessage?.tool_calls && lastMessage?.tool_calls?.length > 0) {
          // Validate tool calls format before routing
          const isFormatValid = validateToolCalls(lastMessage);
          if (!isFormatValid) {
            this.engine.logger.warn(
              'Invalid tool calls format detected, routing back to LLM for correction',
            );
            return 'llm'; // Route back to LLM for correction
          }

          // Validate tool call arguments
          const validTools = selectedTools.filter(
            (tool) => tool.name && tool.description && tool.schema,
          );
          const areArgsValid = lastMessage.tool_calls.every((toolCall) =>
            validateToolCallArgs(toolCall, validTools),
          );

          if (areArgsValid) {
            this.engine.logger.log(
              `Valid tool calls detected (${lastMessage.tool_calls.length} calls), routing to tools node`,
            );
            return 'tools';
          } else {
            this.engine.logger.warn(
              'Invalid tool call arguments detected, routing back to LLM for correction',
            );
            return 'llm'; // Route back to LLM for correction
          }
        }

        // No tool calls detected, check if this is a final response
        // For intelligent problem-solving, we continue the conversation until the user is satisfied
        this.engine.logger.log('No tool calls detected, continuing intelligent problem-solving');
        return END; // End the current turn, but the conversation can continue
      });
    } else {
      this.engine.logger.log(
        'No tools initialized or available. LLM output will directly go to END.',
      );
      // @ts-ignore - Suppressing persistent type error with addEdge and node name mismatch
      workflow = workflow.addEdge('llm', END);
    }

    // Compile the graph
    const compiledGraph = workflow.compile();

    const components: AgentComponents = {
      tools: selectedTools, // Store the successfully initialized tools
      compiledLangGraphApp: compiledGraph, // Store the compiled graph
      mcpAvailable: selectedTools.length > 0,
    };

    this.engine.logger.log(`Agent components initialized and cached for user ${userId}`);
    return components;
  }

  agentNode = async (
    state: GraphState,
    config: SkillRunnableConfig,
  ): Promise<Partial<GraphState>> => {
    const { currentSkill, user } = config.configurable;
    const { locale = 'auto' } = config.configurable;

    const project = config.configurable?.project as
      | { projectId: string; customInstructions?: string }
      | undefined;
    const customInstructions = project?.projectId ? project?.customInstructions : undefined;

    // Initialize enhanced state with intelligent problem-solving tracking
    const enhancedState: EnhancedGraphState = {
      ...state,
      failureHistory: [],
      retryCount: 0,
      maxRetries: 5,
      taskProgress: {
        completed: [],
        pending: TaskTracker.decomposeTask(state.query || ''),
        failed: [],
      },
    };

    const {
      compiledLangGraphApp,
      mcpAvailable,
      tools: mcpTools,
    } = await this.initializeAgentComponents(user, config);

    const module: SkillPromptModule = {
      buildSystemPrompt: mcpAvailable
        ? () => {
            return buildSystemPrompt(
              "You are an advanced AI assistant with specialized expertise in leveraging the Model Context Protocol (MCP) to solve complex problems efficiently. You are a persistent problem-solver who never gives up until the user's request is fully satisfied. " +
                'Your intelligence manifests through precise tool orchestration, context-aware execution, and proactive optimization of MCP server capabilities. ' +
                'When a tool call is made, you will receive a ToolMessage with the result. ' +
                'If an MCP server call fails or returns malformed data, the ToolMessage will contain the error details. ' +
                'You MUST carefully analyze this error message and adapt your approach accordingly. ' +
                'If the error indicates incorrect arguments (e.g., missing parameters, invalid values, type mismatches), you MUST revise the arguments and attempt the tool call again. Do NOT repeat the previous mistake. ' +
                'If the error seems to be a transient issue (e.g., network error, temporary unavailability), you should retry the call, perhaps after a brief conceptual pause. ' +
                "You must continuously retry and adapt your approach to achieve the user's expected outcome. Never abandon the operation prematurely. " +
                'After several (e.g., 3-5) persistent failures for the same tool call despite your best efforts to correct it, and if no alternative tools or approaches are viable, you may then inform the user about the specific difficulty encountered and suggest a different course of action or ask for clarification. ' +
                "Remember: You are a continuous problem-solving assistant, not just a tool caller. You must persist until the user's request is fully satisfied.",
              convertToMCPTools(mcpTools), // Use the conversion function, mcpServerList removed
              locale,
            );
          }
        : commonQnA.buildCommonQnASystemPrompt,
      buildContextUserPrompt: commonQnA.buildCommonQnAContextUserPrompt,
      buildUserPrompt: commonQnA.buildCommonQnAUserPrompt,
    };

    const { requestMessages } = await this.commonPreprocess(
      enhancedState,
      config,
      module,
      customInstructions,
    );

    config.metadata.step = { name: 'intelligentProblemSolving' };

    try {
      this.engine.logger.log('Starting intelligent problem-solving agent execution:', {
        messagesCount: requestMessages.length,
        taskProgress: enhancedState.taskProgress,
        mcpAvailable,
      });

      // Add timeout control for agent execution with increased limit for complex problem-solving
      const executionPromise = compiledLangGraphApp.invoke(
        { messages: requestMessages },
        {
          ...config,
          recursionLimit: 25, // Increased for complex problem-solving
          metadata: {
            ...config.metadata,
            ...currentSkill,
          },
        },
      );

      // Set timeout to 90 seconds to allow for complex problem-solving
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Agent execution timeout after 90 seconds')), 90000);
      });

      const result = (await Promise.race([executionPromise, timeoutPromise])) as {
        messages: BaseMessage[];
      };

      // Add debug logging for the final result
      this.engine.logger.log('Intelligent problem-solving agent execution completed:', {
        messagesCount: result.messages?.length || 0,
        hasToolCalls:
          result.messages?.some((msg) => (msg as AIMessage).tool_calls?.length > 0) || false,
        lastMessageType:
          result.messages?.[result.messages.length - 1]?.constructor?.name || 'unknown',
        taskProgress: enhancedState.taskProgress,
      });

      return { messages: result.messages };
    } catch (error) {
      this.engine.logger.error('Intelligent problem-solving agent execution failed:', error);

      // Record failure in enhanced state
      enhancedState.failureHistory.push({
        step: enhancedState.taskProgress.completed.length,
        error: error.message || 'Unknown error',
        timestamp: new Date(),
        recoveryAction: 'fallback_response',
      });

      // Return intelligent error message
      const errorMessage = new AIMessage(
        `I apologize for the technical difficulty. As your persistent problem-solving assistant, I encountered an error but I'm committed to helping you. Let me try a different approach or suggest alternative ways to fulfill your request. Please let me know if you'd like me to try again or if you have any specific preferences for how to proceed.`,
      );

      return { messages: [errorMessage] };
    } finally {
      this.engine.logger.log('Intelligent problem-solving agent execution finished.');
      // Intentionally do not dispose globally here to preserve MCP connections.
    }
  };

  /**
   * Test method to verify tool call format functionality
   * This method can be used to test if the LLM is generating proper tool_calls format
   */
  async testToolCallFormat(user: User, config?: SkillRunnableConfig): Promise<void> {
    try {
      this.engine.logger.log('Testing tool call format...');

      const components = await this.initializeAgentComponents(user, config);

      if (!components.mcpAvailable) {
        this.engine.logger.log('No tools available for testing');
        return;
      }

      // Create a test message that should trigger tool calls
      const testMessage = new AIMessage(
        'Please search for information about AI developments and calculate 2+2',
      );

      const result = await components.compiledLangGraphApp.invoke(
        { messages: [testMessage] },
        { recursionLimit: 5 },
      );

      this.engine.logger.log('Tool call format test completed:', {
        messagesCount: result.messages?.length || 0,
        hasValidToolCalls:
          result.messages?.some((msg) => (msg as AIMessage).tool_calls?.length > 0) || false,
        lastMessageType:
          result.messages?.[result.messages.length - 1]?.constructor?.name || 'unknown',
      });
    } catch (error) {
      this.engine.logger.error('Tool call format test failed:', error);
    }
  }

  toRunnable() {
    const workflow = new StateGraph<GraphState>({
      channels: this.graphState,
    })
      .addNode('agent', this.agentNode)
      .addEdge(START, 'agent')
      .addEdge('agent', END);

    return workflow.compile();
  }
}
