import { Logger } from '@nestjs/common';
import { BaseChatModel } from '@refly/providers';
import { extractJsonFromMarkdown } from '@refly/utils';
import { CanvasContentItem } from '../canvas/canvas.dto';
import { PilotSession, PilotStep, GenericToolset } from '@refly/openapi-schema';
import { multiStepSchema, PilotStepRawOutput } from './prompt/schema';
import {
  generatePlanningPrompt,
  generateFallbackPrompt,
  getRecommendedStageForEpoch,
} from './prompt';
import { MAX_EPOCH, MAX_STEPS_PER_EPOCH } from './pilot.service';

export class PilotEngine {
  private logger = new Logger(PilotEngine.name);

  constructor(
    private readonly model: BaseChatModel,
    private readonly session: PilotSession,
    private readonly steps: PilotStep[],
  ) {}

  async run(
    contentItems: CanvasContentItem[],
    toolsets: GenericToolset[],
    maxStepsPerEpoch = MAX_STEPS_PER_EPOCH,
    locale?: string,
  ): Promise<PilotStepRawOutput[]> {
    const sessionInput = this.session.input;
    const userQuestion = sessionInput.query;

    try {
      if (!userQuestion) {
        this.logger.warn('No user question provided for research planning');
        return [];
      }

      // Get the current epoch information
      const currentEpoch = this.session?.currentEpoch ?? 0;
      const totalEpochs = this.session?.maxEpoch ?? MAX_EPOCH;
      const recommendedStage = getRecommendedStageForEpoch(currentEpoch, totalEpochs);

      if (currentEpoch > totalEpochs) {
        this.logger.warn('Current epoch exceeds total epochs');
        return [];
      }

      this.logger.log(
        `Planning research steps for "${userQuestion}" with ${contentItems.length} content items. ` +
          `Current epoch: ${currentEpoch + 1}/${totalEpochs + 1}, recommended stage: ${recommendedStage}`,
      );

      // First attempt: Use LLM structured output capability
      try {
        const structuredLLM = this.model.withStructuredOutput(multiStepSchema);

        // Generate the full prompt with optimized guidelines
        const fullPrompt = generatePlanningPrompt({
          userQuestion,
          session: this.session,
          steps: this.steps,
          availableToolsets: toolsets,
          contentItems,
          maxStepsPerEpoch,
          locale,
        });

        const { steps } = await structuredLLM.invoke(fullPrompt);

        this.logger.log(`Generated research plan: ${JSON.stringify(steps)}`);

        if (recommendedStage === 'creation') {
          const creationSteps =
            steps
              .filter(
                (step) =>
                  step.skillName === 'generateDoc' ||
                  step.skillName === 'codeArtifacts' ||
                  step.skillName === 'generateMedia' ||
                  step.skillName === 'commonQnA',
              )
              .slice(0, 1) || [];
          return creationSteps?.length > 0
            ? creationSteps
            : steps?.length > 0
              ? [{ ...steps?.[0], skillName: 'commonQnA' }]
              : [];
        } else {
          return (
            steps
              .filter(
                (step) =>
                  step.skillName !== 'generateDoc' &&
                  step.skillName !== 'codeArtifacts' &&
                  step.skillName !== 'generateMedia',
              )
              .slice(0, MAX_STEPS_PER_EPOCH) || []
          );
        }
      } catch (structuredError) {
        this.logger.warn(
          `Structured output failed: ${structuredError.message}, trying fallback approach`,
        );
        // Continue to fallback
      }

      // Second attempt: Manual JSON parsing approach
      const fallbackPrompt = generateFallbackPrompt({
        userQuestion,
        session: this.session,
        steps: this.steps,
        contentItems,
        availableToolsets: toolsets,
        maxStepsPerEpoch,
        locale,
      });

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
}
