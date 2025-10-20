import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { ActionStepMeta } from '@refly/openapi-schema';
import type { Response } from 'express';
import { ActionResult, ActionStatus } from '../../generated/client';
import { writeSSEResponse } from '../../utils/response';
import { PrismaService } from '../common/prisma.service';

export type ToolEventPayload = {
  run_id?: string;
  metadata?: { toolsetKey?: string; name?: string };
  data?: { input?: unknown; output?: unknown; error?: unknown };
};

// Tool call status
export enum ToolCallStatus {
  EXECUTING = 'executing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Injectable()
export class ToolCallService {
  private readonly logger = new Logger(ToolCallService.name);
  private readonly toolCallIdMap = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {}

  private buildToolCallKey(params: {
    resultId: string;
    version: number;
    runId?: string;
    toolsetId: string;
    toolName: string;
  }): string {
    const { resultId, version, runId, toolsetId, toolName } = params;
    if (runId) {
      return `${resultId}:${version}:${runId}`;
    }
    return `${resultId}:${version}:${toolsetId}:${toolName}`;
  }

  getOrCreateToolCallId(params: {
    resultId: string;
    version: number;
    toolName: string;
    toolsetId: string;
    runId?: string;
  }): string {
    const key = this.buildToolCallKey(params);
    const existing = this.toolCallIdMap.get(key);
    if (existing) {
      return existing;
    }
    const generated = this.generateToolCallId(params);
    this.toolCallIdMap.set(key, generated);
    return generated;
  }

  releaseToolCallId(params: {
    resultId: string;
    version: number;
    toolName: string;
    toolsetId: string;
    runId?: string;
  }): void {
    const key = this.buildToolCallKey(params);
    this.toolCallIdMap.delete(key);
  }

  // Generate tool use XML for tool call for frontend rendering and SSE streaming
  generateToolUseXML(params: {
    toolCallId: string;
    includeResult: boolean;
    errorMsg?: string;
    metadata?: { name?: string; type?: string; toolsetKey?: string; toolsetName?: string };
    input?: unknown;
    output?: unknown;
    startTs: number;
    updatedTs: number;
  }): string | null {
    const { toolCallId, includeResult, errorMsg, metadata, input, output, startTs, updatedTs } =
      params;
    const { name, type, toolsetKey, toolsetName } = metadata ?? {};

    if (!toolsetKey) return null;

    const codeBlockWrapper = (content: string) => {
      const body = content.endsWith('\n') ? content : `${content}\n`;
      return `\n\n\`\`\`tool_use\n${body}\`\`\`\n\n`;
    };

    const lines: string[] = [];
    lines.push('<tool_use>');
    lines.push(`<callId>${toolCallId}</callId>`);
    lines.push(`<name>${name ?? ''}</name>`);
    lines.push(`<type>${type ?? ''}</type>`);
    lines.push(`<toolsetKey>${toolsetKey}</toolsetKey>`);
    lines.push(`<toolsetName>${toolsetName ?? ''}</toolsetName>`);
    lines.push('<arguments>');
    lines.push(input ? (typeof input === 'string' ? input : JSON.stringify(input)) : '');
    lines.push('</arguments>');
    lines.push(`<createdAt>${startTs}</createdAt>`);

    if (errorMsg) {
      lines.push(
        `<result>${output ? (typeof output === 'string' ? output : JSON.stringify(output)) : ''}</result>`,
      );
      lines.push(
        `<error>${errorMsg ? (typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg)) : ''}</error>`,
      );
      lines.push(`<status>${ToolCallStatus.FAILED}</status>`);
      lines.push(`<updatedAt>${updatedTs}</updatedAt>`);
    } else if (includeResult) {
      lines.push(
        `<result>${output ? (typeof output === 'string' ? output : JSON.stringify(output)) : ''}</result>`,
      );
      lines.push(`<status>${ToolCallStatus.COMPLETED}</status>`);
      lines.push(`<updatedAt>${updatedTs}</updatedAt>`);
    } else {
      lines.push(`<status>${ToolCallStatus.EXECUTING}</status>`);
    }

    lines.push('</tool_use>');
    return codeBlockWrapper(lines.join('\n'));
  }

  // Emit tool use stream to the client
  emitToolUseStream(
    res: Response | undefined,
    args: {
      resultId: string;
      step?: ActionStepMeta;
      xmlContent: string;
      toolCallId: string;
      toolName?: string;
      event_name: 'tool_call' | 'stream';
    },
  ): void {
    if (!res) {
      return;
    }
    const { resultId, step, xmlContent, toolCallId, toolName } = args;
    writeSSEResponse(res, {
      event: args.event_name,
      resultId,
      content: xmlContent,
      step,
      structuredData: {
        toolCallId,
        name: toolName ?? '',
      },
    });
  }

  // Persist and emit tool call event to the database and SSE streaming
  async persistToolCallResult(
    _res: Response | undefined,
    userUid: string,
    ids: { resultId: string; version: number },
    toolsetId: string,
    toolName: string,
    input: string | undefined,
    output: string | undefined,
    status: ToolCallStatus,
    callId: string,
    stepName: string,
    createdAt: number,
    updatedAt: number,
    errorMessage: string,
  ): Promise<void> {
    await this.persistToolCall(ids, {
      callId,
      uid: userUid,
      toolsetId,
      toolName,
      stepName,
      input: input,
      output: output,
      error: errorMessage,
      status,
      createdAt: createdAt,
      updatedAt: updatedAt,
    });
  }

  async fetchToolCalls(resultId: string, version: number) {
    return this.prisma.toolCallResult.findMany({
      where: {
        resultId,
        version,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  groupToolCallsByStep(
    steps: Array<{ name: string }>,
    toolCalls: Array<{ stepName?: string | null }>,
  ): Map<string, any[]> {
    const existingStepNames = new Set(steps.map((step) => step.name));
    const fallbackStepName = steps.length > 0 ? steps[steps.length - 1].name : undefined;

    return toolCalls.reduce<Map<string, any[]>>((acc, call) => {
      let key = call.stepName ?? undefined;
      if (!key || !existingStepNames.has(key)) {
        key = fallbackStepName ?? key ?? '';
      }
      if (!key) {
        return acc;
      }
      if (!acc.has(key)) {
        acc.set(key, []);
      }
      acc.get(key)!.push(call);
      return acc;
    }, new Map());
  }

  attachToolCallsToSteps<T extends { name: string }>(
    steps: T[],
    toolCallsByStep: Map<string, any[]>,
  ): Array<T & { toolCalls?: any[] }> {
    return steps.map((step) => ({
      ...step,
      toolCalls: toolCallsByStep.get(step.name),
    }));
  }

  async deriveAndUpdateActionStatus(result: ActionResult, toolCalls: Array<{ status: string }>) {
    let actionStatus = result.status;

    if (toolCalls.length > 0) {
      const hasFailed = toolCalls.some((tc) => tc.status === 'failed');
      const hasExecuting = toolCalls.some((tc) => tc.status === 'executing');
      const allCompleted = toolCalls.every((tc) => tc.status === 'completed');

      if (hasFailed) {
        actionStatus = ActionStatus.failed;
      } else if (hasExecuting) {
        actionStatus = ActionStatus.executing;
      } else if (allCompleted) {
        actionStatus = ActionStatus.finish;
      }

      if (actionStatus !== result.status) {
        await this.prisma.actionResult.update({
          where: { pk: result.pk },
          data: { status: actionStatus },
        });
        result.status = actionStatus;
      }
    }

    return actionStatus;
  }

  generateToolCallId(params: {
    resultId: string;
    version: number;
    toolName: string;
    toolsetId: string;
  }): string {
    const prefix = `${params.resultId}:${params.version}:${params.toolsetId ?? 'toolset'}:${params.toolName ?? 'tool'}`;
    return `${prefix}:${randomUUID()}`;
  }

  private async persistToolCall(
    ids: { resultId: string; version: number },
    data: {
      callId: string;
      uid?: string;
      toolsetId: string;
      toolName: string;
      stepName?: string;
      input?: string;
      output?: string;
      error?: string;
      status: ToolCallStatus;
      createdAt: number;
      updatedAt: number;
      deletedAt?: number;
    },
  ): Promise<void> {
    const toJSONStr = (value: unknown): string => {
      if (value === undefined || value === null) return undefined;
      try {
        return typeof value === 'string' ? value : JSON.stringify(value);
      } catch {
        return '';
      }
    };

    const toDateOrNull = (ts?: number): Date | null => {
      return typeof ts === 'number' ? new Date(ts) : null;
    };

    await this.prisma.toolCallResult.upsert({
      where: { callId: data.callId },
      create: {
        resultId: ids.resultId,
        version: ids.version,
        callId: data.callId,
        uid: data.uid ?? '',
        toolsetId: data.toolsetId ?? '',
        toolName: data.toolName ?? '',
        stepName: data.stepName ?? undefined,
        // ensure non-null columns always receive a string
        input: data.input !== undefined ? toJSONStr(data.input) : '',
        output: data.output !== undefined ? toJSONStr(data.output) : '',
        status: data.status ?? ToolCallStatus.EXECUTING,
        error: data.error ?? undefined,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
        deletedAt: toDateOrNull(data.deletedAt),
      },
      update: {
        resultId: ids.resultId,
        version: ids.version,
        uid: data.uid ?? '',
        toolsetId: data.toolsetId ?? '',
        toolName: data.toolName ?? '',
        stepName: data.stepName ?? undefined,
        // only overwrite when a new value is provided
        ...(data.input !== undefined ? { input: toJSONStr(data.input) } : {}),
        ...(data.output !== undefined ? { output: toJSONStr(data.output) } : {}),
        status: data.status ?? ToolCallStatus.EXECUTING,
        error: data.error ?? undefined,
        updatedAt: new Date(data.updatedAt),
        deletedAt: toDateOrNull(data.deletedAt),
      },
    });
  }
}
