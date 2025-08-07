# Workflow Module

This module implements a workflow execution system for canvas-based workflows. It manages the execution of nodes in a canvas based on their dependencies and relationships.

## Features

- **Dependency Management**: Automatically resolves node dependencies based on canvas edges
- **Queue-based Execution**: Uses BullMQ for reliable, distributed execution
- **State Persistence**: All workflow state is stored in the database
- **Error Handling**: Robust error handling with retry mechanisms
- **Progress Tracking**: Real-time progress tracking for each node

## Database Schema

### WorkflowExecution
Stores the overall workflow execution state:
- `executionId`: Unique identifier for the workflow execution
- `uid`: User ID who owns the workflow
- `canvasId`: Associated canvas ID
- `title`: Workflow title
- `status`: Current status (init, executing, finished, failed)
- `totalNodes`: Total number of nodes in the workflow
- `executedNodes`: Number of completed nodes
- `failedNodes`: Number of failed nodes

### WorkflowNodeExecution
Stores individual node execution state:
- `nodeExecutionId`: Unique identifier for the node execution
- `executionId`: Associated workflow execution ID
- `nodeId`: Canvas node ID
- `nodeType`: Type of the node (skillResponse, etc.)
- `entityId`: Entity ID for the node
- `title`: Node title
- `status`: Node status (waiting, executing, finished, failed)
- `progress`: Execution progress (0-100)
- `parentNodeIds`: JSON array of parent node IDs
- `childNodeIds`: JSON array of child node IDs
- `startTime`: When execution started
- `endTime`: When execution completed
- `errorMessage`: Error message if failed

## API Endpoints

### Initialize Workflow
```http
POST /v1/workflow/initialize
Content-Type: application/json

{
  "canvasId": "canvas-123"
}
```

Response:
```json
{
  "executionId": "we-abc123",
  "success": true
}
```

## Queue System

### QUEUE_SYNC_WORKFLOW
Handles workflow synchronization after skill execution:
- Triggered when a skill execution completes
- Updates node status to finished
- Checks child node dependencies
- Adds ready nodes to run queue

### QUEUE_RUN_WORKFLOW
Handles individual node execution:
- Executes nodes based on their type
- Currently supports skillResponse nodes
- Updates node progress and status
- Triggers sync workflow after completion

## Execution Flow

1. **Initialization**: User calls `/v1/workflow/initialize` with canvas ID
2. **Node Analysis**: System analyzes canvas nodes and edges to build dependency graph
3. **Database Setup**: Creates workflow execution and node execution records
4. **Queue Start**: Adds start nodes (nodes without parents) to run queue
5. **Node Execution**: Processes nodes from queue based on dependencies
6. **Sync Process**: After each node completes, sync process checks child nodes
7. **Completion**: Workflow completes when all nodes are finished

## Node Types

Currently supported node types:
- `skillResponse`: Executes skill tasks with proper context and history

Future node types to be implemented:
- `memo`: Text processing nodes
- `image`: Image processing nodes
- `website`: Web scraping nodes

## Error Handling

- Failed nodes are marked with error messages
- Workflow continues with other nodes
- Failed workflows can be retried
- Timeout handling for long-running nodes

## Monitoring

- Real-time progress tracking
- Detailed execution logs
- Error reporting and debugging
- Performance metrics

## Usage Example

```typescript
// Initialize a workflow
const response = await fetch('/v1/workflow/initialize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ canvasId: 'my-canvas-id' })
});

const { executionId } = await response.json();
console.log('Workflow started:', executionId);
```

## Configuration

The module supports desktop mode where queues are disabled:
- Desktop mode: Direct execution without queues
- Server mode: Full queue-based execution with Redis

## Dependencies

- PrismaService: Database operations
- CanvasSyncService: Canvas state management
- SkillService: Skill execution
- BullMQ: Queue management
- Redis: Queue storage (server mode only) 