import { PilotSession, PilotStep } from '@refly/openapi-schema';

/**
 * Extended PilotSession for divergent mode
 */
export interface DivergentSession extends PilotSession {
  mode: 'divergent';
  maxDivergence: number;
  maxDepth: number;
  currentDepth: number;
}

/**
 * Extended PilotStep with node metadata for tree structure
 */
export interface DivergentStep extends PilotStep {
  nodeType: 'summary' | 'execution';
  depth: number;
  parentStepId?: string;
  convergenceGroup?: string;
  completionScore?: number;
}

/**
 * Result of convergence operation
 */
export interface ConvergenceResult {
  summary: string;
  completionScore: number;
  confidenceScore: number;
  shouldContinue: boolean;
  readyForFinalOutput: boolean;
  missingAreas?: string[];
}

/**
 * Next action decision from orchestrator
 */
export interface NextActionDecision {
  action: 'continue_divergence' | 'generate_final_output' | 'force_final_output';
  reason: string;
  nextDepth?: number;
  recommendedSkill?: 'generateDoc' | 'codeArtifacts';
  focusAreas?: string[];
}

/**
 * Quality metrics for convergence assessment
 */
export interface QualityMetrics {
  contentLength: number;
  skillDiversity: number;
  informationDensity: number;
}

/**
 * Interface for canvas context
 */
export interface CanvasContext {
  nodes: CanvasNode[];
  connections: CanvasConnection[];
}

export interface CanvasNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface CanvasConnection {
  id: string;
  source: string;
  target: string;
  type?: string;
}

/**
 * Interface for task result from executed step
 */
export interface TaskResult {
  stepId: string;
  skill: string;
  result: Record<string, unknown> | string | null;
}

/**
 * Interface for generated divergent task
 */
export interface DivergentTask {
  name: string;
  skillName: string;
  parameters: Record<string, unknown>;
  query?: string; // Task query for skill execution
  description: string; // Task description
  contextItemIds?: string[]; // Canvas context items for this task
  depth: number;
  priority?: number;
}

/**
 * Interface for divergent session status response
 */
export interface DivergentSessionStatus {
  sessionId: string;
  status: string;
  mode: string;
  currentDepth: number;
  maxDepth: number;
  maxDivergence: number;
  progress: {
    totalSteps: number;
    executionSteps: number;
    summarySteps: number;
    completedSteps: number;
  };
  title: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Interface for divergent session list item
 */
export interface DivergentSessionListItem {
  sessionId: string;
  title: string;
  status: string;
  mode: string;
  currentDepth: number;
  maxDepth: number;
  stepCount: number;
  createdAt: string;
  updatedAt: string;
}
