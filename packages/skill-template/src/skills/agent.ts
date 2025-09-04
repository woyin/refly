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
      const maxRetries = 3; // Increased retry count for better persistence
      let attempts = 0;
      let lastError: Error | null = null;

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
                `Invalid tool_calls format detected (attempt ${attempts + 1}), retrying with intelligent correction...`,
              );

              // Enhanced correction prompt with specific guidance
              const correctionPrompt = new SystemMessage(`
Your previous response contained incorrect tool call format. This is attempt ${attempts + 1} of ${maxRetries + 1}.

Please analyze and correct the following issues:
1. **Format Error**: Use the structured tool_calls format as specified in the system prompt
2. **Parameter Validation**: Ensure all required parameters are provided correctly
3. **Tool Selection**: Verify the tool name exists and is available
4. **Argument Structure**: Use proper JSON format for tool arguments

Remember: You must NEVER give up. Try alternative approaches if the current method fails.
Generate tool calls in the exact JSON format that LangChain expects, with name, args, and id fields.
              `);

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
          lastError = error as Error;
          this.engine.logger.error(`LLM node execution failed (attempt ${attempts + 1}):`, error);

          if (attempts < maxRetries) {
            // Intelligent retry strategy based on error analysis
            const retryStrategy = this.analyzeErrorAndGetRetryStrategy(error as Error, attempts);
            const retryPrompt = new SystemMessage(`
${retryStrategy}

Remember: You are a persistent AI assistant that NEVER gives up. Analyze the error, adapt your approach, and try again with a different strategy.
            `);

            nodeState.messages.push(retryPrompt);
            attempts++;
            this.engine.logger.log(
              `Retrying LLM invocation with intelligent strategy (attempt ${attempts + 1}/${maxRetries + 1})`,
            );
          }
        }
      }

      // All retry attempts failed - use intelligent fallback
      return await this.handleFinalFailure(lastError, nodeState, attempts);
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
      // Enhanced tool node with result analysis and retry context
      const enhancedToolNode = async (toolState: typeof MessagesAnnotation.State) => {
        try {
          this.engine.logger.log('Executing tool node with enhanced result analysis');

          // Execute the original tool node
          const result = await actualToolNodeInstance.invoke(toolState);

          // Analyze tool execution results
          const lastToolMessage = result.messages[result.messages.length - 1];
          if (lastToolMessage && typeof lastToolMessage.content === 'string') {
            const toolResult = lastToolMessage.content;

            // Check if tool execution was successful
            if (this.isToolExecutionSuccessful(toolResult)) {
              this.engine.logger.log('Tool execution successful, proceeding with results');
            } else {
              this.engine.logger.warn('Tool execution may have failed, adding retry context');

              // Add intelligent retry context
              const retryContext = new SystemMessage(`
Tool execution result analysis: ${toolResult}

Please analyze this result and determine next steps:
1. **Success Assessment**: Did the tool achieve the expected outcome?
2. **Error Analysis**: If there were issues, what went wrong?
3. **Alternative Strategy**: What other approaches could work?
4. **Parameter Adjustment**: Should we try different parameters?
5. **Tool Substitution**: Are there alternative tools we could use?

Remember: You are a persistent assistant that NEVER gives up. If one approach fails, try another. Break down complex tasks into simpler steps if needed.
              `);

              result.messages.push(retryContext);
            }
          }

          return result;
        } catch (error) {
          this.engine.logger.error('Enhanced tool node execution failed:', error);

          // Handle tool execution failure with intelligent recovery
          const errorAnalysis = this.analyzeErrorAndGetRetryStrategy(error as Error, 0);
          const errorMessage = new AIMessage(`
Tool execution failed with error: ${error.message}

**Error Analysis**: ${errorAnalysis}

**Recovery Strategy**:
1. **Immediate Retry**: Try the same tool with adjusted parameters
2. **Alternative Tools**: Use different tools with similar functionality  
3. **Task Decomposition**: Break the task into smaller, simpler steps
4. **Parameter Simplification**: Use more basic parameters
5. **Different Approach**: Try a completely different method

Remember: You must NEVER give up. Analyze the failure, adapt your strategy, and try again with a different approach.
          `);

          return { messages: [...toolState.messages, errorMessage] };
        }
      };

      // @ts-ignore - Suppressing persistent type error with addNode and runnable type mismatch
      workflow = workflow.addNode('tools', enhancedToolNode);
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
            this.engine.logger.warn('Invalid tool calls format detected, routing to END');
            return END;
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
            this.engine.logger.warn('Invalid tool call arguments detected, routing to END');
            return END;
          }
        }

        // Enhanced: Check if execution should be retried based on current state
        if (this.shouldRetryExecution(graphState)) {
          this.engine.logger.log('Retry conditions met, continuing execution with LLM node');
          return 'llm'; // Re-route to LLM node for retry
        }

        this.engine.logger.log('No tool calls detected and no retry needed, routing to END');
        return END;
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

    const {
      compiledLangGraphApp,
      mcpAvailable,
      tools: mcpTools,
    } = await this.initializeAgentComponents(user, config);

    const module: SkillPromptModule = {
      buildSystemPrompt: mcpAvailable
        ? () => {
            return buildSystemPrompt(
              'You are an advanced AI assistant with specialized expertise in leveraging the Model Context Protocol (MCP) to solve complex problems efficiently. Your intelligence manifests through precise tool orchestration, context-aware execution, and proactive optimization of MCP server capabilities. ' +
                'When a tool call is made, you will receive a ToolMessage with the result. ' +
                'If an MCP server call fails or returns malformed data, the ToolMessage will contain the error details. ' +
                'You MUST carefully analyze this error message. ' +
                'If the error indicates incorrect arguments (e.g., missing parameters, invalid values, type mismatches), you MUST revise the arguments and attempt the tool call again. Do NOT repeat the previous mistake. ' +
                'If the error seems to be a transient issue (e.g., network error, temporary unavailability), you should retry the call, perhaps after a brief conceptual pause. ' +
                "You must continuously retry and adapt your approach to achieve the user's expected outcome. Never abandon the operation prematurely. " +
                'After several (e.g., 3-5) persistent failures for the same tool call despite your best efforts to correct it, and if no alternative tools or approaches are viable, you may then inform the user about the specific difficulty encountered and suggest a different course of action or ask for clarification.',
              convertToMCPTools(mcpTools), // Use the conversion function, mcpServerList removed
              locale,
            );
          }
        : commonQnA.buildCommonQnASystemPrompt,
      buildContextUserPrompt: commonQnA.buildCommonQnAContextUserPrompt,
      buildUserPrompt: commonQnA.buildCommonQnAUserPrompt,
    };

    const { requestMessages } = await this.commonPreprocess(
      state,
      config,
      module,
      customInstructions,
    );

    config.metadata.step = { name: 'answerQuestion' };

    try {
      const startTime = Date.now();
      this.engine.logger.log(
        'Starting enhanced agent execution with messages:',
        requestMessages.length,
      );

      // Enhanced timeout control with dynamic timeout based on task complexity
      const dynamicTimeout = this.calculateDynamicTimeout(requestMessages, mcpAvailable);

      const executionPromise = compiledLangGraphApp.invoke(
        { messages: requestMessages },
        {
          ...config,
          recursionLimit: 25, // Increased for better persistence
          timeout: dynamicTimeout,
          metadata: {
            ...config.metadata,
            ...currentSkill,
            startTime,
            mcpAvailable,
            toolCount: mcpTools?.length || 0,
            enhancedMode: true,
          },
        },
      );

      // Set dynamic timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error(`Agent execution timeout after ${dynamicTimeout / 1000} seconds`)),
          dynamicTimeout,
        );
      });

      const result = (await Promise.race([executionPromise, timeoutPromise])) as {
        messages: BaseMessage[];
      };

      // Enhanced execution statistics and monitoring
      const executionTime = Date.now() - startTime;
      const finalToolCallCount =
        result.messages?.filter((msg) => (msg as AIMessage).tool_calls?.length > 0).length || 0;

      const retryCount =
        result.messages?.filter(
          (msg) =>
            msg.content?.toString().includes('retry') ||
            msg.content?.toString().includes('attempt') ||
            msg.content?.toString().includes('failed'),
        ).length || 0;

      const success = !result.messages?.some(
        (msg) =>
          msg.content?.toString().includes('error') ||
          msg.content?.toString().includes('failed') ||
          msg.content?.toString().includes('timeout'),
      );

      // Comprehensive execution logging
      this.engine.logger.log('Enhanced Agent execution completed:', {
        executionTime: `${executionTime}ms`,
        messagesCount: result.messages?.length || 0,
        toolCallCount: finalToolCallCount,
        retryCount,
        success,
        mcpAvailable,
        toolCount: mcpTools?.length || 0,
        timeout: `${dynamicTimeout / 1000}s`,
        recursionLimit: 25,
        lastMessageType:
          result.messages?.[result.messages.length - 1]?.constructor?.name || 'unknown',
        hasToolCalls: finalToolCallCount > 0,
        persistenceLevel: retryCount > 0 ? 'high' : 'normal',
      });

      return { messages: result.messages };
    } catch (error) {
      this.engine.logger.error('Enhanced Agent execution failed:', error);

      // Enhanced error handling with intelligent fallback
      const errorMessage = new AIMessage(`
I encountered technical difficulties while processing your request. Here's what happened and how we can proceed:

**Error Details**: ${error.message}
**Execution Context**: Enhanced Agent with persistent retry capabilities

**What I attempted**:
- Multiple retry strategies with intelligent error analysis
- Tool execution with result validation
- Dynamic timeout and recursion management
- Comprehensive error recovery mechanisms

**Next Steps**:
1. **Try rephrasing** your request in simpler terms
2. **Break down** complex tasks into smaller steps
3. **Try again** - this might be a temporary issue
4. **Provide more context** about what you're trying to achieve

I'm designed to never give up, so let's work together to find a solution!
      `);

      return { messages: [errorMessage] };
    } finally {
      this.engine.logger.log('Enhanced agentNode execution finished.');
      // Intentionally do not dispose globally here to preserve MCP connections.
    }
  };

  /**
   * Intelligent error analysis and retry strategy generation
   */
  private analyzeErrorAndGetRetryStrategy(error: Error, attemptCount: number): string {
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
      return `Network or timeout error detected. This is attempt ${attemptCount + 1}. Please:
1. Check network connectivity and try again
2. Use simpler tools with fewer parameters
3. Break the task into smaller, more manageable steps
4. Consider using alternative tools that might be more reliable`;
    }

    if (errorMessage.includes('tool') || errorMessage.includes('function')) {
      return `Tool execution error detected. This is attempt ${attemptCount + 1}. Please:
1. Verify tool name and parameter correctness
2. Try using alternative tools with similar functionality
3. Simplify tool call parameters
4. Check if the tool is available and properly configured`;
    }

    if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
      return `API rate limit or quota exceeded. This is attempt ${attemptCount + 1}. Please:
1. Wait a moment before retrying
2. Use fewer tool calls or batch operations
3. Try processing the task in smaller chunks
4. Consider using different tools that might have different rate limits`;
    }

    if (errorMessage.includes('permission') || errorMessage.includes('unauthorized')) {
      return `Permission or authorization error. This is attempt ${attemptCount + 1}. Please:
1. Check if you have the necessary permissions
2. Try using tools that don't require special permissions
3. Simplify the request to avoid permission issues
4. Consider alternative approaches that don't require restricted access`;
    }

    return `Unknown error encountered. This is attempt ${attemptCount + 1}. Please:
1. Re-analyze the task requirements and approach
2. Try a completely different method or strategy
3. Break the task into simpler, more basic steps
4. Consider using more fundamental tools or approaches
5. Think about alternative ways to achieve the same goal`;
  }

  /**
   * Handle final failure with intelligent fallback response
   */
  private async handleFinalFailure(
    error: Error | null,
    _nodeState: typeof MessagesAnnotation.State,
    attempts: number,
  ): Promise<{ messages: BaseMessage[] }> {
    this.engine.logger.error('All retry attempts failed, providing intelligent fallback response');

    const errorAnalysis = error
      ? this.analyzeErrorAndGetRetryStrategy(error, attempts)
      : 'Unknown error';

    // Provide intelligent fallback response with actionable suggestions
    const fallbackResponse = new AIMessage(`
I encountered technical difficulties while processing your request. Here's what I attempted and some alternative approaches:

**Attempts Made**: ${attempts} retry attempts
**Primary Error**: ${error?.message || 'Unknown error'}
**Error Analysis**: ${errorAnalysis}

**Alternative Solutions**:
1. **Rephrase your request**: Try breaking it down into smaller, more specific questions
2. **Simplify the task**: Remove complex requirements and focus on the core objective
3. **Try again later**: This might be a temporary technical issue
4. **Use different approach**: Consider alternative methods to achieve your goal

**What I can still help with**:
- Answering questions that don't require external tools
- Providing general guidance and information
- Helping you break down complex tasks into simpler steps
- Suggesting alternative approaches to your problem

Please provide more specific details about what you're trying to achieve, and I'll do my best to help you find a solution.
    `);

    return { messages: [fallbackResponse] };
  }

  /**
   * Check if tool execution was successful based on result analysis
   */
  private isToolExecutionSuccessful(toolResult: string): boolean {
    const result = toolResult.toLowerCase();

    // Check for error indicators
    if (
      result.includes('error') ||
      result.includes('failed') ||
      result.includes('exception') ||
      result.includes('timeout') ||
      result.includes('unauthorized') ||
      result.includes('not found') ||
      result.includes('invalid')
    ) {
      return false;
    }

    // Check for success indicators
    if (
      result.includes('success') ||
      result.includes('completed') ||
      result.includes('found') ||
      result.length > 20
    ) {
      // Has substantial content
      return true;
    }

    // Default to success if no clear error indicators
    return true;
  }

  /**
   * Calculate dynamic timeout based on task complexity and available tools
   */
  private calculateDynamicTimeout(requestMessages: BaseMessage[], mcpAvailable: boolean): number {
    const baseTimeout = 60000; // 1 minute base timeout

    // Increase timeout based on message complexity
    const messageComplexity = requestMessages.reduce((complexity, msg) => {
      if (typeof msg.content === 'string') {
        return complexity + msg.content.length;
      }
      return complexity;
    }, 0);

    // Increase timeout if tools are available (more complex execution)
    const toolMultiplier = mcpAvailable ? 1.5 : 1.0;

    // Calculate final timeout with reasonable bounds
    const calculatedTimeout = Math.floor(
      baseTimeout * toolMultiplier * (1 + messageComplexity / 10000),
    );

    // Ensure reasonable bounds (30 seconds to 5 minutes)
    return Math.min(Math.max(calculatedTimeout, 30000), 300000);
  }

  /**
   * Check if execution should be retried based on current state
   */
  private shouldRetryExecution(graphState: typeof MessagesAnnotation.State): boolean {
    const messages = graphState.messages;
    const lastMessage = messages[messages.length - 1];

    // Check if last message contains retry-related keywords
    if (lastMessage && typeof lastMessage.content === 'string') {
      const content = lastMessage.content.toLowerCase();

      // Look for retry indicators
      if (
        content.includes('retry') ||
        content.includes('try again') ||
        content.includes('alternative') ||
        content.includes('different approach') ||
        content.includes('failed') ||
        content.includes('error')
      ) {
        return true;
      }
    }

    // Prevent infinite loops by checking message count
    if (messages.length > 25) {
      this.engine.logger.warn('Message limit reached, stopping retry to prevent infinite loop');
      return false;
    }

    return false;
  }

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
