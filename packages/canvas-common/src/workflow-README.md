# Canvas Workflow 执行器 / Canvas Workflow Executor

这是一个最简单的workflow执行器，用于执行画布中的节点workflow。

This is a simple workflow executor for executing node workflows in canvas.

## 功能特性 / Features

- ✅ 自动识别开始节点（没有父节点的节点）
- ✅ 按序执行节点（父节点完成后才执行子节点）
- ✅ 支持并行处理（多个子节点可以同时执行）
- ✅ 利用现有的CanvasState、CanvasNode和Edge数据结构
- ✅ 无需前端，纯service层实现

- ✅ Automatically identify start nodes (nodes without parents)
- ✅ Execute nodes in order (child nodes only execute after parent nodes complete)
- ✅ Support parallel processing (multiple child nodes can execute simultaneously)
- ✅ Utilize existing CanvasState, CanvasNode and Edge data structures
- ✅ No frontend required, pure service layer implementation

## 使用方法 / Usage

### 基本使用 / Basic Usage

```typescript
import { executeCanvasWorkflow } from '@refly/canvas-common';

// 获取画布状态 / Get canvas state
const canvasState: CanvasState = {
  title: 'My Workflow',
  nodes: [...], // 节点数组 / Node array
  edges: [...], // 边数组 / Edge array
  transactions: []
};

// 执行workflow / Execute workflow
const result = await executeCanvasWorkflow(canvasState);

if (result.success) {
  console.log('执行成功，已执行节点:', result.executedNodes);
  // Execution successful, executed nodes:
} else {
  console.error('执行失败:', result.error);
  // Execution failed:
}
```

### 在API Service中使用 / Using in API Service

```typescript
import { WorkflowService } from '@refly/canvas-common';

class CanvasController {
  private workflowService = new WorkflowService();

  async executeWorkflow(canvasId: string, canvasState: CanvasState) {
    return await this.workflowService.executeWorkflowByCanvasId(canvasId, canvasState);
  }
}
```

## 执行逻辑 / Execution Logic

1. **构建图结构 / Build Graph Structure**: 根据nodes和edges构建父子关系
   Build parent-child relationships based on nodes and edges

2. **找到开始节点 / Find Start Nodes**: 识别没有父节点的节点作为开始节点
   Identify nodes without parents as start nodes

3. **队列执行 / Queue Execution**: 使用队列管理节点执行顺序
   Use queue to manage node execution order

4. **依赖检查 / Dependency Check**: 确保父节点完成后才执行子节点
   Ensure child nodes only execute after parent nodes complete

5. **并行处理 / Parallel Processing**: 多个子节点可以同时执行
   Multiple child nodes can execute simultaneously

## 数据结构 / Data Structures

### WorkflowExecutionResult
```typescript
interface WorkflowExecutionResult {
  success: boolean;
  executedNodes: string[]; // 已执行的节点ID列表 / List of executed node IDs
  error?: string; // 错误信息（如果有）/ Error message (if any)
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
  children: string[]; // 子节点ID列表 / List of child node IDs
  parents: string[]; // 父节点ID列表 / List of parent node IDs
}
```

## 注意事项 / Notes

- 目前只是模拟执行，实际使用时需要在`executeNode`方法中实现具体的节点执行逻辑
- 假设不会出现错误情况，所以没有复杂的错误处理
- 依赖现有的`getCanvasDataFromState`方法来获取画布数据
- 支持React Flow的节点和边数据结构

- Currently only simulates execution, actual usage requires implementing specific node execution logic in the `executeNode` method
- Assumes no error scenarios, so no complex error handling
- Depends on existing `getCanvasDataFromState` method to get canvas data
- Supports React Flow node and edge data structures

## 扩展建议 / Extension Suggestions

1. 根据节点类型实现具体的执行逻辑 / Implement specific execution logic based on node types
2. 添加执行状态回调 / Add execution status callbacks
3. 支持条件分支和循环 / Support conditional branches and loops
4. 添加执行超时和重试机制 / Add execution timeout and retry mechanisms
5. 支持参数传递 between nodes / Support parameter passing between nodes 