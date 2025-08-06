import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { User, InvokeSkillRequest, Entity, EntityType, ActionResult } from '@refly/openapi-schema';
import { CanvasNode, ResponseNodeMeta } from '@refly/canvas-common';
import { SkillService } from '../skill/skill.service';
import { convertContextItemsToInvokeParams } from '@refly/canvas-common';
import { CanvasService } from '../canvas/canvas.service';

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly skillService: SkillService,
    private readonly canvasService: CanvasService,
  ) {}

  /**
   * Process a skillResponse node and invoke the skill task
   * @param user - The user to process the node for
   * @param node - The CanvasNode to process
   * @param canvasId - The canvas ID
   * @returns Promise<void>
   */
  async processSkillResponseNode(
    user: User,
    node: CanvasNode & { data: { metadata?: ResponseNodeMeta } },
    canvasId: string,
  ): Promise<void> {
    // Check if the node is a skillResponse type
    if (node.type !== 'skillResponse') {
      this.logger.warn(`Node type ${node.type} is not skillResponse, skipping processing`);
      return;
    }

    const { data } = node;
    const { metadata } = data;

    if (!metadata) {
      this.logger.warn('Node metadata is missing, skipping processing');
      return;
    }

    // Extract required parameters from ResponseNodeMeta
    const {
      selectedSkill,
      contextItems = [],
      tplConfig = {},
      runtimeConfig = {},
      modelInfo,
    } = metadata;

    // Get query from title
    const query = data.title || '';

    // Get resultId from entityId
    const resultId = data.entityId;

    if (!resultId) {
      this.logger.warn('Node entityId is missing, skipping processing');
      return;
    }

    // Get all canvas nodes to build proper context and history
    const canvasData = await this.canvasService.getCanvasRawData(user, canvasId);
    const allNodes = canvasData.nodes || [];

    // Convert contextItems to invoke parameters with proper data lookup
    const { context, resultHistory, images } = convertContextItemsToInvokeParams(
      contextItems,
      // History function - find skillResponse nodes and convert to ActionResult
      (item) => {
        if (item.type === 'skillResponse') {
          const skillNode = allNodes.find((n) => n.data?.entityId === item.entityId);
          if (skillNode) {
            return [
              {
                resultId: skillNode.data?.entityId || '',
                title: skillNode.data?.title || '',
              } as ActionResult,
            ];
          }
        }
        return [];
      },
      // Memo function - find memo nodes and extract content
      (item) => {
        if (item.type === 'memo') {
          const memoNode = allNodes.find((n) => n.data?.entityId === item.entityId);
          if (memoNode) {
            return [
              {
                content: memoNode.data?.contentPreview || memoNode.data?.title || '',
                title: memoNode.data?.title || 'Memo',
              },
            ];
          }
        }
        return [];
      },
      // Images function - find image nodes and extract storage keys
      (item) => {
        if (item.type === 'image') {
          const imageNode = allNodes.find((n) => n.data?.entityId === item.entityId);
          if (imageNode) {
            return [
              {
                storageKey: String(imageNode.data?.metadata?.storageKey || ''),
                title: imageNode.data?.title || 'Image',
                entityId: imageNode.data?.entityId || '',
                metadata: imageNode.data?.metadata || {},
              },
            ];
          }
        }
        return [];
      },
      // Website function - find website nodes and extract URL info
      (item) => {
        if (item.type === 'website') {
          const websiteNode = allNodes.find((n) => n.data?.entityId === item.entityId);
          if (websiteNode) {
            return [
              {
                url: String(websiteNode.data?.metadata?.url || ''),
                title: websiteNode.data?.title || 'Website',
              },
            ];
          }
        }
        return [];
      },
    );

    // Prepare the target entity
    const target: Entity = {
      entityType: 'canvas' as EntityType,
      entityId: canvasId,
    };

    // Prepare the invoke skill request
    const invokeRequest: InvokeSkillRequest = {
      resultId,
      input: {
        query,
        images,
      },
      target,
      modelName: modelInfo?.name,
      modelItemId: modelInfo?.providerItemId,
      context,
      resultHistory,
      skillName: selectedSkill?.name || 'commonQnA',
      selectedMcpServers: [], // Empty array as mentioned in requirements
      tplConfig,
      runtimeConfig,
    };

    // Send the invoke skill task
    await this.skillService.sendInvokeSkillTask(user, invokeRequest);

    this.logger.log(`Successfully sent invoke skill task for resultId: ${resultId}`);
  }
}
