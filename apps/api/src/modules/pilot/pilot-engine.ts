import { Logger } from '@nestjs/common';
import { BaseChatModel } from '@refly/providers';
import { extractJsonFromMarkdown } from '@refly/utils';
import { CanvasContentItem } from '../canvas/canvas.dto';
import { PilotSession, PilotStep } from '@refly/openapi-schema';
import {
  multiStepSchema,
  generatePlanningPrompt,
  generateBootstrapPrompt,
  generateFallbackPrompt,
  PilotStepRawOutput,
} from './prompt';

export class PilotEngine {
  private logger = new Logger(PilotEngine.name);

  constructor(
    private readonly model: BaseChatModel,
    private readonly session: PilotSession,
    private readonly steps: PilotStep[],
  ) {}

  async run(
    contentItems: CanvasContentItem[],
    maxStepsPerEpoch = 3,
  ): Promise<PilotStepRawOutput[]> {
    const sessionInput = this.session.input;
    const userQuestion = sessionInput.query;

    try {
      if (!userQuestion) {
        this.logger.warn('No user question provided for research planning');
        return [];
      }

      // If no content is available, bootstrap with just the user question
      if (!contentItems?.length) {
        this.logger.log(
          `No canvas content available. Bootstrapping research planning based solely on user question: "${userQuestion}"`,
        );
        return this.generateResearchWithoutContent(userQuestion, maxStepsPerEpoch);
      }

      this.logger.log(
        `Planning research steps for "${userQuestion}" with ${contentItems.length} content items`,
      );

      // First attempt: Use LLM structured output capability
      try {
        const structuredLLM = this.model.withStructuredOutput(multiStepSchema);

        // Generate the full prompt with optimized guidelines
        const fullPrompt = generatePlanningPrompt(
          userQuestion,
          this.session,
          this.steps,
          contentItems,
          maxStepsPerEpoch,
        );

        const { steps } = await structuredLLM.invoke(fullPrompt);

        this.logger.log(`Generated research plan: ${JSON.stringify(steps)}`);

        return steps;
      } catch (structuredError) {
        this.logger.warn(
          `Structured output failed: ${structuredError.message}, trying fallback approach`,
        );
        // Continue to fallback
      }

      // Second attempt: Manual JSON parsing approach
      const fallbackPrompt = generateFallbackPrompt(userQuestion, maxStepsPerEpoch);

      const response = await this.model.invoke(fallbackPrompt);
      const responseText = response.content.toString();

      // Extract and parse JSON
      const extraction = extractJsonFromMarkdown(responseText);

      if (extraction.error) {
        throw new Error(
          `JSON extraction failed: ${extraction.error.message}, using final fallback`,
        );
      }

      const { steps } = await multiStepSchema.parseAsync(extraction.result);

      this.logger.log(`Successfully generated research plan with ${steps?.length} steps`);
      return steps;
    } catch (error) {
      this.logger.error(`Error generating research plan: ${error.message}`);
      return [];
    }
  }

  /**
   * Generates research steps based solely on the user question when no canvas content is available
   * @param userQuestion The user's research question
   * @param maxStepsPerEpoch The maximum number of steps to generate
   */
  private async generateResearchWithoutContent(
    userQuestion: string,
    maxStepsPerEpoch = 3,
  ): Promise<PilotStepRawOutput[]> {
    try {
      // First attempt: Use LLM structured output capability with empty context
      try {
        const structuredLLM = this.model.withStructuredOutput(multiStepSchema);

        // Use the bootstrap prompt with optimized guidelines
        const fullPrompt = generateBootstrapPrompt(userQuestion, maxStepsPerEpoch);

        const { steps } = await structuredLLM.invoke(fullPrompt);

        this.logger.log(`Generated bootstrap research plan: ${JSON.stringify(steps)}`);

        return steps;
      } catch (structuredError) {
        this.logger.warn(
          `Structured output for bootstrap plan failed: ${structuredError.message}, trying fallback approach`,
        );
        // Continue to fallback
      }

      // Second attempt: Manual JSON parsing approach
      const fallbackPrompt = generateFallbackPrompt(userQuestion, maxStepsPerEpoch);

      const response = await this.model.invoke(fallbackPrompt);
      const responseText = response.content.toString();

      // Extract and parse JSON
      const extraction = extractJsonFromMarkdown(responseText);

      if (extraction.error) {
        throw new Error(`JSON extraction failed for bootstrap plan: ${extraction.error.message}`);
      }

      const { steps } = await multiStepSchema.parseAsync(extraction.result);

      this.logger.log(`Successfully generated bootstrap research plan with ${steps?.length} steps`);
      return steps;
    } catch (error) {
      this.logger.error(`Error generating bootstrap research plan: ${error.message}`);
      return [];
    }
  }
}
