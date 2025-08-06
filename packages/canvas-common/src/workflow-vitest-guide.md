# Workflow Vitest 测试指南 / Workflow Vitest Testing Guide

## 概述 / Overview

我们为workflow功能创建了完整的vitest单元测试，参考了现有的 `diff.test.ts` 和 `sync.test.ts` 的结构和风格。

We have created comprehensive vitest unit tests for the workflow functionality, following the structure and style of existing `diff.test.ts` and `sync.test.ts`.

## 测试文件结构 / Test File Structure

### workflow.test.ts
标准的vitest单元测试文件，包含以下测试套件：

Standard vitest unit test file containing the following test suites:

1. **executeWorkflow** - 测试主要执行功能 / Test main execution functionality
2. **WorkflowExecutor class methods** - 测试类方法 / Test class methods
3. **Error handling** - 测试错误处理 / Test error handling
4. **Execution order** - 测试执行顺序 / Test execution order

## 运行测试 / Running Tests

### 运行所有workflow测试 / Run All Workflow Tests
```bash
cd packages/canvas-common
npm run test:workflow:unit
```

### 运行特定测试文件 / Run Specific Test Files
```bash
# 运行workflow单元测试 / Run workflow unit tests
npm run test src/workflow.test.ts

# 运行所有测试 / Run all tests
npm run test
```

### 在开发模式下运行测试 / Run Tests in Development Mode
```bash
# 监听模式 / Watch mode
npm run test -- --watch

# 只运行workflow测试的监听模式 / Watch mode for workflow tests only
npm run test src/workflow.test.ts -- --watch
```

## 测试场景 / Test Scenarios

### 1. 线性Workflow测试 / Linear Workflow Test
```typescript
it('should execute a simple linear workflow', async () => {
  const nodes = [
    createNode('A', { title: 'Start Node' }),
    createNode('B', { title: 'Process Node' }),
    createNode('C', { title: 'End Node' }),
  ];
  const edges = [
    createEdge('e1', 'A', 'B'),
    createEdge('e2', 'B', 'C'),
  ];
  
  const result = await executeCanvasWorkflow(canvasState);
  
  expect(result.success).toBe(true);
  expect(result.executedNodes).toEqual(['A', 'B', 'C']);
});
```

### 2. 并行Workflow测试 / Parallel Workflow Test
```typescript
it('should execute a parallel workflow', async () => {
  // 测试多个分支可以并行执行 / Test that multiple branches can execute in parallel
  const result = await executeCanvasWorkflow(canvasState);
  
  expect(result.success).toBe(true);
  expect(result.executedNodes).toContain('start');
  expect(result.executedNodes).toContain('branch1');
  expect(result.executedNodes).toContain('branch2');
  expect(result.executedNodes).toContain('end');
});
```

### 3. 错误处理测试 / Error Handling Test
```typescript
it('should handle workflow with no start nodes', async () => {
  // 测试循环依赖的情况 / Test circular dependency scenarios
  const result = await executeCanvasWorkflow(canvasState);
  
  expect(result.success).toBe(false);
  expect(result.error).toBe('No start nodes found');
});
```

### 4. 执行顺序测试 / Execution Order Test
```typescript
it('should execute nodes in correct dependency order', async () => {
  // 测试依赖关系正确执行 / Test correct dependency execution
  const result = await executeCanvasWorkflow(canvasState);
  
  expect(result.success).toBe(true);
  expect(result.executedNodes).toEqual(['A', 'B', 'C', 'D']);
});
```

## 测试辅助函数 / Test Helper Functions

### createNode
创建测试用的CanvasNode / Create CanvasNode for testing:
```typescript
const createNode = (id: string, metadata: Record<string, any> = {}): CanvasNode => ({
  id,
  type: TEST_NODE_TYPE,
  position: { x: 0, y: 0 },
  data: { title: `Node ${id}`, entityId: id, metadata },
});
```

### createEdge
创建测试用的CanvasEdge / Create CanvasEdge for testing:
```typescript
const createEdge = (
  id: string,
  source: string,
  target: string,
  extra: Partial<CanvasEdge> = {},
): CanvasEdge => ({
  id,
  source,
  target,
  type: 'default',
  ...extra,
});
```

### createCanvasState
创建测试用的CanvasState / Create CanvasState for testing:
```typescript
const createCanvasState = (nodes: CanvasNode[], edges: CanvasEdge[]): CanvasState => ({
  nodes,
  edges,
  transactions: [],
});
```

## 测试最佳实践 / Testing Best Practices

### 1. 测试覆盖 / Test Coverage
- ✅ 正常流程测试 / Normal flow tests
- ✅ 边界条件测试 / Boundary condition tests
- ✅ 错误情况测试 / Error scenario tests
- ✅ 执行顺序测试 / Execution order tests

### 2. 测试数据 / Test Data
- 使用辅助函数创建测试数据 / Use helper functions to create test data
- 保持测试数据的简洁性 / Keep test data concise
- 确保测试数据的有效性 / Ensure test data validity

### 3. 断言 / Assertions
- 使用明确的断言 / Use explicit assertions
- 测试返回值的结构 / Test return value structure
- 验证执行顺序 / Verify execution order

### 4. 异步测试 / Async Testing
- 使用 `async/await` 处理异步操作 / Use `async/await` for async operations
- 正确处理Promise的rejection / Properly handle Promise rejections

## 调试测试 / Debugging Tests

### 运行单个测试 / Run Single Test
```bash
# 运行特定的测试 / Run specific test
npm run test src/workflow.test.ts -t "should execute a simple linear workflow"
```

### 查看详细输出 / View Detailed Output
```bash
# 显示详细输出 / Show verbose output
npm run test src/workflow.test.ts -- --verbose
```

### 调试模式 / Debug Mode
```bash
# 在调试模式下运行 / Run in debug mode
npm run test src/workflow.test.ts -- --inspect-brk
```

## 持续集成 / Continuous Integration

这些测试可以集成到CI/CD流程中：

These tests can be integrated into CI/CD workflows:

```yaml
# 示例 GitHub Actions 配置 / Example GitHub Actions configuration
- name: Run Workflow Tests
  run: |
    cd packages/canvas-common
    npm run test:workflow:unit
```

## 扩展测试 / Extending Tests

要添加新的测试场景，可以：

To add new test scenarios, you can:

1. 在现有的 `describe` 块中添加新的 `it` 测试 / Add new `it` tests in existing `describe` blocks
2. 创建新的 `describe` 块来组织相关测试 / Create new `describe` blocks to organize related tests
3. 使用现有的辅助函数创建测试数据 / Use existing helper functions to create test data
4. 遵循现有的测试模式和风格 / Follow existing test patterns and styles 