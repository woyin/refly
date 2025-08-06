# Canvas Common Workflow Architecture

This directory contains the workflow execution system for Refly's canvas functionality. The system has been split into two main components for better separation of concerns and uses synchronous execution for simplicity and reliability.

## File Structure

### `workflow.ts` - Main Workflow Orchestrator
Handles the overall workflow execution logic:

- **WorkflowExecutor**: Main class that orchestrates the entire workflow execution
- **Workflow orchestration**: Manages node dependencies and execution order
- **Graph building**: Constructs the workflow graph from canvas nodes and edges
- **Status tracking**: Monitors overall workflow progress and status
- **Error handling**: Manages workflow-level errors and timeouts
- **Synchronous execution**: Uses simple queue-based execution for reliability

### `node-executor.ts` - Node Execution Engine
Handles individual node execution logic:

- **NodeExecutor**: Class responsible for executing individual nodes
- **Node type handling**: Supports different node types (skill, generic, etc.)
- **Progress tracking**: Manages node-level progress updates
- **Context building**: Creates skill contexts for AI operations
- **Timeout management**: Handles node-level timeouts
- **Synchronous execution**: Each node executes to completion before moving to the next

## Architecture Benefits

### Separation of Concerns
- **Workflow logic**: Focuses on orchestration, dependencies, and flow control
- **Node logic**: Focuses on individual node execution and progress tracking

### Simplicity and Reliability
- **Synchronous execution**: Each node completes before the next starts
- **Predictable behavior**: No complex polling or concurrency issues
- **Easier debugging**: Clear execution order and error propagation
- **Reduced complexity**: No need for complex state management

### Maintainability
- Easier to modify node execution logic without affecting workflow orchestration
- Simpler to add new node types or execution strategies
- Clear boundaries between workflow and node responsibilities

### Testability
- Node execution can be tested independently
- Workflow orchestration can be tested with mocked node execution
- Better isolation for unit testing

### Extensibility
- New node types can be added to NodeExecutor without changing WorkflowExecutor
- Different execution strategies can be implemented in NodeExecutor
- Workflow orchestration can be enhanced without affecting node execution

## Execution Model

The system uses a **synchronous queue-based execution model**:

1. **Graph Construction**: Builds dependency graph from canvas nodes and edges
2. **Start Node Identification**: Finds nodes without dependencies
3. **Queue Processing**: Processes nodes in dependency order
4. **Node Execution**: Each node executes to completion before moving to the next
5. **Child Node Addition**: Completed nodes add their children to the queue
6. **Error Propagation**: Errors stop the entire workflow execution

## Usage

```typescript
import { executeCanvasWorkflow } from './workflow';
import { NodeExecutor } from './node-executor';

// Execute a complete workflow
const result = await executeCanvasWorkflow(canvasState);

// Or use components separately
const workflowExecutor = new WorkflowExecutor();
const nodeExecutor = new NodeExecutor();
```

## Key Interfaces

### WorkflowExecutionResult
```typescript
interface WorkflowExecutionResult {
  success: boolean;
  executedNodes: string[];
  error?: string;
}
```

### WorkflowNode
```typescript
interface WorkflowNode {
  id: string;
  type: string;
  entityId: string;
  title: string;
  status: 'waiting' | 'executing' | 'finished' | 'failed';
  children: string[];
  parents: string[];
  progress?: number;
  startTime?: number;
}
```

## Testing

The system includes comprehensive tests that verify:
- Workflow orchestration and dependency management
- Node execution and progress tracking
- Error handling and timeout management
- Different node types and execution strategies
- Complex workflow scenarios with multiple paths

Run tests with:
```bash
npm run test:workflow:unit
```

## Performance Characteristics

- **Execution Time**: Linear with the number of nodes
- **Memory Usage**: Minimal, no polling overhead
- **Error Handling**: Immediate propagation of errors
- **Debugging**: Clear execution trace and error stack
- **Predictability**: Deterministic execution order 