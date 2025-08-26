import React, { useState, useCallback, useMemo } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Select,
  message,
  Space,
  Typography,
  Alert,
  Spin,
  Tabs,
} from 'antd';
import {
  PlayCircleOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import {
  useExtractVariables,
  useGenerateAppTemplate,
} from '@refly-packages/ai-workspace-common/queries/queries';

const { TextArea } = Input;
const { Option } = Select;
const { Title, Text } = Typography;
const { TabPane } = Tabs;

// Import types from the generated types
import type {
  VariableExtractionResult,
  AppTemplateResult,
} from '@refly-packages/ai-workspace-common/requests/types.gen';

// Test page component
const VariableExtractionTestPage: React.FC = React.memo(() => {
  const [form] = Form.useForm();
  const [appTemplateForm] = Form.useForm();

  // Use the mutation hooks
  const extractVariablesMutation = useExtractVariables();
  const generateAppTemplateMutation = useGenerateAppTemplate();

  // State management
  const [result, setResult] = useState<VariableExtractionResult | null>(null);
  const [appTemplateResult, setAppTemplateResult] = useState<AppTemplateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appTemplateError, setAppTemplateError] = useState<string | null>(null);
  const [testHistory, setTestHistory] = useState<
    Array<{
      timestamp: string;
      type: 'extract' | 'generateTemplate';
      request: any;
      response: VariableExtractionResult | AppTemplateResult;
    }>
  >([]);

  // Form values
  const [formValues, setFormValues] = useState({
    prompt: '',
    canvasId: '',
    mode: 'candidate' as 'direct' | 'candidate',
    sessionId: '',
  });

  const [appTemplateFormValues, setAppTemplateFormValues] = useState({
    canvasId: '',
  });

  // Sample test data
  const samplePrompts = useMemo(
    () => [
      '创建一个用户注册表单，包含用户名、邮箱和密码字段',
      '生成一个电商产品列表页面，支持分页和搜索功能',
      '设计一个任务管理系统，包含任务创建、分配和状态跟踪',
      '构建一个数据可视化仪表板，展示销售数据和用户行为分析',
    ],
    [],
  );

  const sampleCanvasIds = useMemo(
    () => ['canvas-001', 'canvas-002', 'canvas-003', 'test-canvas-123'],
    [],
  );

  // Handle variable extraction form submission
  const handleSubmit = useCallback(
    async (values: any) => {
      setError(null);

      try {
        const response = await extractVariablesMutation.mutateAsync({
          body: {
            prompt: values.prompt,
            canvasId: values.canvasId,
            mode: values.mode,
            sessionId: values.sessionId || undefined,
          },
        });

        const data: VariableExtractionResult = response.data;
        setResult(data);

        // Add to test history
        setTestHistory((prev) => [
          {
            timestamp: new Date().toLocaleString(),
            type: 'extract',
            request: values,
            response: data,
          },
          ...prev.slice(0, 9),
        ]); // Keep last 10 tests

        message.success('变量提取成功！');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '未知错误';
        setError(errorMessage);
        message.error(`请求失败: ${errorMessage}`);
      }
    },
    [extractVariablesMutation],
  );

  // Handle app template generation form submission
  const handleAppTemplateSubmit = useCallback(
    async (values: any) => {
      setAppTemplateError(null);

      try {
        const response = await generateAppTemplateMutation.mutateAsync({
          body: {
            canvasId: values.canvasId,
          },
        });

        const data: AppTemplateResult = response.data;
        setAppTemplateResult(data);

        // Add to test history
        setTestHistory((prev) => [
          {
            timestamp: new Date().toLocaleString(),
            type: 'generateTemplate',
            request: values,
            response: data,
          },
          ...prev.slice(0, 9),
        ]); // Keep last 10 tests

        message.success('APP发布模板生成成功！');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '未知错误';
        setAppTemplateError(errorMessage);
        message.error(`请求失败: ${errorMessage}`);
      }
    },
    [generateAppTemplateMutation],
  );

  // Handle sample data selection
  const handleSampleSelect = useCallback(
    (type: 'prompt' | 'canvasId', value: string) => {
      form.setFieldsValue({ [type]: value });
      setFormValues((prev) => ({ ...prev, [type]: value }));
    },
    [form],
  );

  // Handle app template sample data selection
  const handleAppTemplateSampleSelect = useCallback(
    (canvasId: string) => {
      appTemplateForm.setFieldsValue({ canvasId });
      setAppTemplateFormValues((prev) => ({ ...prev, canvasId }));
    },
    [appTemplateForm],
  );

  // Handle form reset
  const handleReset = useCallback(() => {
    form.resetFields();
    setFormValues({
      prompt: '',
      canvasId: '',
      mode: 'candidate',
      sessionId: '',
    });
    setResult(null);
    setError(null);
  }, [form]);

  // Handle app template form reset
  const handleAppTemplateReset = useCallback(() => {
    appTemplateForm.resetFields();
    setAppTemplateFormValues({
      canvasId: '',
    });
    setAppTemplateResult(null);
    setAppTemplateError(null);
  }, [appTemplateForm]);

  // Handle clear history
  const handleClearHistory = useCallback(() => {
    setTestHistory([]);
    message.info('测试历史已清空');
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Page Header */}
        <div className="mb-8 text-center">
          <Title level={2} className="mb-2">
            变量提取与APP模板生成测试页面
          </Title>
          <Text type="secondary" className="text-lg">
            测试 VariableExtraction API 的各种功能和参数组合
          </Text>
        </div>

        {/* API Information */}
        <Alert
          message="API 接口信息"
          description={
            <div>
              <p>
                <strong>变量提取接口:</strong> POST /v1/variable-extraction/extract
              </p>
              <p>
                <strong>APP模板生成接口:</strong> POST /v1/variable-extraction/generate-template
              </p>
              <p>
                <strong>功能说明:</strong> 统一的变量提取接口，支持 'direct'（直接更新Canvas变量）和
                'candidate'（返回候选方案）两种模式；APP模板生成接口基于Canvas所有原始prompt和变量生成用户意图模板
              </p>
              <p>
                <strong>认证要求:</strong> 需要 JWT 认证
              </p>
            </div>
          }
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          className="mb-6"
        />

        <Tabs defaultActiveKey="extract" className="mb-6">
          <TabPane
            tab={
              <span>
                <PlayCircleOutlined />
                变量提取测试
              </span>
            }
            key="extract"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Variable Extraction Test Form */}
              <Card title="变量提取测试参数配置" className="h-fit">
                <Form
                  form={form}
                  layout="vertical"
                  onFinish={handleSubmit}
                  initialValues={formValues}
                  onValuesChange={(_, allValues) => setFormValues(allValues)}
                >
                  <Form.Item
                    label="原始提示词 (Prompt)"
                    name="prompt"
                    rules={[{ required: true, message: '请输入提示词' }]}
                  >
                    <TextArea
                      rows={4}
                      placeholder="请输入自然语言提示，描述您想要实现的功能..."
                      showCount
                      maxLength={500}
                    />
                  </Form.Item>

                  {/* Sample Prompts */}
                  <div className="mb-4">
                    <Text type="secondary" className="text-sm mb-2 block">
                      示例提示词:
                    </Text>
                    <Space wrap>
                      {samplePrompts.map((prompt, index) => (
                        <Button
                          key={index}
                          size="small"
                          type="dashed"
                          onClick={() => handleSampleSelect('prompt', prompt)}
                        >
                          示例 {index + 1}
                        </Button>
                      ))}
                    </Space>
                  </div>

                  <Form.Item
                    label="画布ID (Canvas ID)"
                    name="canvasId"
                    rules={[{ required: true, message: '请输入画布ID' }]}
                  >
                    <Input placeholder="请输入画布ID，用于获取现有变量上下文" />
                  </Form.Item>

                  {/* Sample Canvas IDs */}
                  <div className="mb-4">
                    <Text type="secondary" className="text-sm mb-2 block">
                      示例画布ID:
                    </Text>
                    <Space wrap>
                      {sampleCanvasIds.map((id, index) => (
                        <Button
                          key={index}
                          size="small"
                          type="dashed"
                          onClick={() => handleSampleSelect('canvasId', id)}
                        >
                          {id}
                        </Button>
                      ))}
                    </Space>
                  </div>

                  <Form.Item
                    label="处理模式 (Mode)"
                    name="mode"
                    rules={[{ required: true, message: '请选择处理模式' }]}
                  >
                    <Select>
                      <Option value="candidate">候选模式 (candidate) - 返回候选方案</Option>
                      <Option value="direct">直接模式 (direct) - 直接更新Canvas变量</Option>
                    </Select>
                  </Form.Item>

                  <Form.Item
                    label="会话ID (Session ID)"
                    name="sessionId"
                    extra="可选，直接模式时检查是否有候选记录"
                  >
                    <Input placeholder="可选，直接模式时检查是否有候选记录" />
                  </Form.Item>

                  <Form.Item className="mb-0">
                    <Space>
                      <Button
                        type="primary"
                        htmlType="submit"
                        loading={extractVariablesMutation.isPending}
                        icon={<PlayCircleOutlined />}
                        size="large"
                      >
                        执行变量提取测试
                      </Button>
                      <Button onClick={handleReset} icon={<ReloadOutlined />}>
                        重置表单
                      </Button>
                    </Space>
                  </Form.Item>
                </Form>
              </Card>

              {/* Variable Extraction Test Results */}
              <Card title="变量提取测试结果" className="h-fit">
                {extractVariablesMutation.isPending && (
                  <div className="text-center py-8">
                    <Spin size="large" />
                    <div className="mt-4 text-gray-500">正在处理变量提取请求...</div>
                  </div>
                )}

                {error && (
                  <Alert
                    message="请求失败"
                    description={error}
                    type="error"
                    showIcon
                    className="mb-4"
                  />
                )}

                {result && (
                  <div className="space-y-4">
                    {/* Original Prompt */}
                    <div>
                      <Text strong>原始提示词:</Text>
                      <div className="mt-1 p-3 bg-gray-50 rounded border">
                        {result.originalPrompt}
                      </div>
                    </div>

                    {/* Processed Prompt */}
                    <div>
                      <Text strong>处理后的提示词:</Text>
                      <div className="mt-1 p-3 bg-blue-50 rounded border">
                        {result.processedPrompt}
                      </div>
                    </div>

                    {/* Extracted Variables */}
                    <div>
                      <Text strong>提取的变量 ({result.variables.length}):</Text>
                      <div className="mt-2 space-y-2">
                        {result.variables.map((variable, index) => (
                          <div key={index} className="p-3 bg-green-50 rounded border">
                            <div className="flex justify-between items-start">
                              <div>
                                <Text strong>{variable.name}</Text>
                                <div className="text-sm text-gray-600 mt-1">
                                  值:{' '}
                                  {Array.isArray(variable.value)
                                    ? variable.value.join(', ')
                                    : variable.value}
                                </div>
                                {variable.description && (
                                  <div className="text-sm text-gray-500 mt-1">
                                    描述: {variable.description}
                                  </div>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-gray-500">
                                  类型: {variable.variableType}
                                </div>
                                <div className="text-xs text-gray-500">
                                  类型: {variable.variableType || 'string'}
                                </div>
                                <div className="text-xs text-gray-500">来源: {variable.source}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Reused Variables */}
                    {result.reusedVariables && result.reusedVariables.length > 0 && (
                      <div>
                        <Text strong>复用的变量 ({result.reusedVariables.length}):</Text>
                        <div className="mt-2 space-y-2">
                          {result.reusedVariables.map((reuse, index) => (
                            <div key={index} className="p-3 bg-yellow-50 rounded border">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="text-sm text-gray-600">
                                    检测文本: {reuse.detectedText}
                                  </div>
                                  <div className="text-sm text-gray-500 mt-1">
                                    复用变量: {reuse.reusedVariableName}
                                  </div>
                                  <div className="text-sm text-gray-500 mt-1">
                                    原因: {reuse.reason}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs text-gray-500">
                                    置信度: {(reuse.confidence * 100).toFixed(1)}%
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Session ID */}
                    {result.sessionId && (
                      <div>
                        <Text strong>会话ID:</Text>
                        <div className="mt-1 p-2 bg-gray-100 rounded font-mono text-sm">
                          {result.sessionId}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!extractVariablesMutation.isPending && !result && !error && (
                  <div className="text-center py-8 text-gray-500">
                    请配置测试参数并点击"执行变量提取测试"按钮
                  </div>
                )}
              </Card>
            </div>
          </TabPane>

          <TabPane
            tab={
              <span>
                <AppstoreOutlined />
                APP模板生成测试
              </span>
            }
            key="generateTemplate"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* APP Template Generation Test Form */}
              <Card title="APP模板生成测试参数配置" className="h-fit">
                <Form
                  form={appTemplateForm}
                  layout="vertical"
                  onFinish={handleAppTemplateSubmit}
                  initialValues={appTemplateFormValues}
                  onValuesChange={(_, allValues) => setAppTemplateFormValues(allValues)}
                >
                  <Form.Item
                    label="画布ID (Canvas ID)"
                    name="canvasId"
                    rules={[{ required: true, message: '请输入画布ID' }]}
                    extra="基于Canvas所有原始prompt和变量生成用户意图模板"
                  >
                    <Input placeholder="请输入画布ID，用于生成APP发布模板" />
                  </Form.Item>

                  {/* Sample Canvas IDs */}
                  <div className="mb-4">
                    <Text type="secondary" className="text-sm mb-2 block">
                      示例画布ID:
                    </Text>
                    <Space wrap>
                      {sampleCanvasIds.map((id, index) => (
                        <Button
                          key={index}
                          size="small"
                          type="dashed"
                          onClick={() => handleAppTemplateSampleSelect(id)}
                        >
                          {id}
                        </Button>
                      ))}
                    </Space>
                  </div>

                  <Form.Item className="mb-0">
                    <Space>
                      <Button
                        type="primary"
                        htmlType="submit"
                        loading={generateAppTemplateMutation.isPending}
                        icon={<AppstoreOutlined />}
                        size="large"
                      >
                        生成APP发布模板
                      </Button>
                      <Button onClick={handleAppTemplateReset} icon={<ReloadOutlined />}>
                        重置表单
                      </Button>
                    </Space>
                  </Form.Item>
                </Form>
              </Card>

              {/* APP Template Generation Test Results */}
              <Card title="APP模板生成测试结果" className="h-fit">
                {generateAppTemplateMutation.isPending && (
                  <div className="text-center py-8">
                    <Spin size="large" />
                    <div className="mt-4 text-gray-500">正在生成APP发布模板...</div>
                  </div>
                )}

                {appTemplateError && (
                  <Alert
                    message="请求失败"
                    description={appTemplateError}
                    type="error"
                    showIcon
                    className="mb-4"
                  />
                )}

                {appTemplateResult && (
                  <div className="space-y-4">
                    {/* Template Content */}
                    <div>
                      <Text strong>模板内容:</Text>
                      <div className="mt-1 p-3 bg-blue-50 rounded border whitespace-pre-wrap">
                        {appTemplateResult.templateContent}
                      </div>
                    </div>

                    {/* Variables */}
                    <div>
                      <Text strong>相关变量 ({appTemplateResult.variables.length}):</Text>
                      <div className="mt-2 space-y-2">
                        {appTemplateResult.variables.map((variable, index) => (
                          <div key={index} className="p-3 bg-green-50 rounded border">
                            <div className="flex justify-between items-start">
                              <div>
                                <Text strong>{variable.name}</Text>
                                <div className="text-sm text-gray-600 mt-1">
                                  值:{' '}
                                  {Array.isArray(variable.value)
                                    ? variable.value.join(', ')
                                    : variable.value}
                                </div>
                                {variable.description && (
                                  <div className="text-sm text-gray-500 mt-1">
                                    描述: {variable.description}
                                  </div>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-gray-500">
                                  类型: {variable.variableType || 'string'}
                                </div>
                                <div className="text-xs text-gray-500">来源: {variable.source}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Metadata */}
                    <div>
                      <Text strong>模板元数据:</Text>
                      <div className="mt-2 p-3 bg-gray-50 rounded border">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            生成时间:{' '}
                            {new Date(appTemplateResult.metadata.extractedAt).toLocaleString()}
                          </div>
                          <div>变量数量: {appTemplateResult.metadata.variableCount}</div>
                          {appTemplateResult.metadata.promptCount && (
                            <div>提示词数量: {appTemplateResult.metadata.promptCount}</div>
                          )}
                          {appTemplateResult.metadata.canvasComplexity && (
                            <div>画布复杂度: {appTemplateResult.metadata.canvasComplexity}</div>
                          )}
                          {appTemplateResult.metadata.workflowType && (
                            <div>工作流类型: {appTemplateResult.metadata.workflowType}</div>
                          )}
                          {appTemplateResult.metadata.templateVersion && (
                            <div>模板版本: {appTemplateResult.metadata.templateVersion}</div>
                          )}
                          {appTemplateResult.metadata.workflowTitle && (
                            <div>工作流标题: {appTemplateResult.metadata.workflowTitle}</div>
                          )}
                          {appTemplateResult.metadata.workflowDescription && (
                            <div>工作流描述: {appTemplateResult.metadata.workflowDescription}</div>
                          )}
                          {appTemplateResult.metadata.estimatedExecutionTime && (
                            <div>
                              预计执行时间: {appTemplateResult.metadata.estimatedExecutionTime}
                            </div>
                          )}
                          {appTemplateResult.metadata.skillTags &&
                            appTemplateResult.metadata.skillTags.length > 0 && (
                              <div>技能标签: {appTemplateResult.metadata.skillTags.join(', ')}</div>
                            )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {!generateAppTemplateMutation.isPending &&
                  !appTemplateResult &&
                  !appTemplateError && (
                    <div className="text-center py-8 text-gray-500">
                      请配置测试参数并点击"生成APP发布模板"按钮
                    </div>
                  )}
              </Card>
            </div>
          </TabPane>
        </Tabs>

        {/* Test History */}
        {testHistory.length > 0 && (
          <Card title="测试历史" className="mt-6">
            <div className="flex justify-between items-center mb-4">
              <Text type="secondary">最近 {testHistory.length} 次测试记录</Text>
              <Button size="small" onClick={handleClearHistory}>
                清空历史
              </Button>
            </div>

            <div className="space-y-3">
              {testHistory.map((record, index) => (
                <div key={index} className="p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <Text strong>测试 #{index + 1}</Text>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          record.type === 'extract'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {record.type === 'extract' ? '变量提取' : 'APP模板生成'}
                      </span>
                    </div>
                    <Text type="secondary" className="text-sm">
                      {record.timestamp}
                    </Text>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <Text type="secondary">请求参数:</Text>
                      <div className="mt-1 p-2 bg-gray-50 rounded">
                        {record.type === 'extract' ? (
                          <>
                            <div>提示词: {record.request.prompt.substring(0, 50)}...</div>
                            <div>画布ID: {record.request.canvasId}</div>
                            <div>模式: {record.request.mode}</div>
                            {record.request.sessionId && (
                              <div>会话ID: {record.request.sessionId}</div>
                            )}
                          </>
                        ) : (
                          <div>画布ID: {record.request.canvasId}</div>
                        )}
                      </div>
                    </div>

                    <div>
                      <Text type="secondary">响应结果:</Text>
                      <div className="mt-1 p-2 bg-gray-50 rounded">
                        {record.type === 'extract' ? (
                          <>
                            <div>
                              变量数量:{' '}
                              {(record.response as VariableExtractionResult).variables.length}
                            </div>
                            <div>
                              复用变量:{' '}
                              {(record.response as VariableExtractionResult).reusedVariables.length}
                            </div>
                            {(record.response as VariableExtractionResult).sessionId && (
                              <div>
                                会话ID: {(record.response as VariableExtractionResult).sessionId}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div>
                              变量数量:{' '}
                              {(record.response as AppTemplateResult).metadata.variableCount}
                            </div>
                            <div>
                              复杂度:{' '}
                              {(record.response as AppTemplateResult).metadata.canvasComplexity}
                            </div>
                            <div>
                              工作流类型:{' '}
                              {(record.response as AppTemplateResult).metadata.workflowType}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
});

VariableExtractionTestPage.displayName = 'VariableExtractionTestPage';

export default VariableExtractionTestPage;
