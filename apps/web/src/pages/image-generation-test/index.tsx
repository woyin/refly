import React, { useState } from 'react';
import {
  Button,
  Input,
  Select,
  Card,
  Form,
  Spin,
  message,
  Typography,
  Row,
  Col,
  Space,
  Divider,
} from 'antd';
import axios from 'axios';

const { TextArea } = Input;
const { Title, Paragraph, Text } = Typography;

interface GeneratedImage {
  url: string;
  width: number;
  height: number;
  format: string;
  seed?: number;
}

interface GenerationResponse {
  images: GeneratedImage[];
  metadata: {
    prompt: string;
    model: string;
    provider: string;
    parameters: Record<string, any>;
    usage?: {
      cost?: number;
      credits?: number;
      processingTime?: number;
    };
    taskId?: string;
  };
}

const providers = [
  { value: 'replicate', label: 'Replicate (Async)' },
  { value: 'fal', label: 'FAL (Fast)' },
];

const models = {
  replicate: [
    'stability-ai/stable-diffusion-xl-base-1.0',
    'stability-ai/stable-diffusion-3-medium',
    'black-forest-labs/flux-schnell',
    'black-forest-labs/flux-dev',
  ],
  fal: ['flux/schnell', 'flux/dev', 'stable-diffusion-xl', 'stable-diffusion-3'],
};

export default function ImageGenerationTest() {
  const [form] = Form.useForm();
  const [prompt, setPrompt] = useState('A beautiful sunset over the mountains, digital art style');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [provider, setProvider] = useState<'replicate' | 'fal'>('fal');
  const [model, setModel] = useState('flux/schnell');
  const [apiKey, setApiKey] = useState('');
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [steps, setSteps] = useState(4);
  const [guidance, setGuidance] = useState(3.5);
  const [seed, setSeed] = useState<number | undefined>();
  const [count, setCount] = useState(1);

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<GenerationResponse | null>(null);

  // Update model when provider changes
  React.useEffect(() => {
    setModel(models[provider][0]);
  }, [provider]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      message.error('Please enter a prompt');
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const payload = {
        prompt: prompt.trim(),
        negativePrompt: negativePrompt.trim() || undefined,
        provider,
        model,
        apiKey: apiKey.trim() || undefined,
        width,
        height,
        steps,
        guidance,
        seed,
        count,
      };

      console.log('Sending request:', payload);

      const response = await axios.post(
        'http://localhost:5800/api/v1/image-generation/test',
        payload,
      );
      setResult(response.data);

      message.success('Image generated successfully!');
      console.log('Generation successful:', response.data);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Generation failed';
      message.error(`Generation failed: ${errorMessage}`);
      console.error('Generation error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const generateRandomSeed = () => {
    setSeed(Math.floor(Math.random() * 999999));
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', padding: '32px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Title level={2}>图像生成测试页面</Title>
          <Paragraph>测试 Replicate 和 FAL 图像生成 Provider</Paragraph>
        </div>

        <Row gutter={32}>
          {/* Configuration Panel */}
          <Col span={12}>
            <Card title="生成配置" style={{ height: 'fit-content' }}>
              <Form form={form} layout="vertical">
                {/* Prompt */}
                <Form.Item label="提示词 *" required>
                  <TextArea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="描述你想要生成的图像..."
                    rows={3}
                  />
                </Form.Item>

                {/* Negative Prompt */}
                <Form.Item label="负面提示词">
                  <TextArea
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    placeholder="描述你不想要的内容..."
                    rows={2}
                  />
                </Form.Item>

                {/* Provider and Model */}
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="Provider">
                      <Select
                        value={provider}
                        onChange={(value: 'replicate' | 'fal') => setProvider(value)}
                        options={providers}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="模型">
                      <Select
                        value={model}
                        onChange={setModel}
                        options={models[provider].map((m) => ({ value: m, label: m }))}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                {/* API Key */}
                <Form.Item label="API Key (可选，用于真实测试)">
                  <Input.Password
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="留空使用测试 key"
                  />
                </Form.Item>

                {/* Image Dimensions */}
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="宽度">
                      <Input
                        type="number"
                        value={width}
                        onChange={(e) => setWidth(Number(e.target.value))}
                        min={256}
                        max={2048}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="高度">
                      <Input
                        type="number"
                        value={height}
                        onChange={(e) => setHeight(Number(e.target.value))}
                        min={256}
                        max={2048}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                {/* Advanced Settings */}
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="推理步数">
                      <Input
                        type="number"
                        value={steps}
                        onChange={(e) => setSteps(Number(e.target.value))}
                        min={1}
                        max={100}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="引导强度">
                      <Input
                        type="number"
                        value={guidance}
                        onChange={(e) => setGuidance(Number(e.target.value))}
                        min={1}
                        max={20}
                        step={0.5}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                {/* Seed and Count */}
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="随机种子">
                      <Space.Compact style={{ display: 'flex' }}>
                        <Input
                          type="number"
                          value={seed || ''}
                          onChange={(e) =>
                            setSeed(e.target.value ? Number(e.target.value) : undefined)
                          }
                          placeholder="随机"
                          style={{ flex: 1 }}
                        />
                        <Button onClick={generateRandomSeed}>随机</Button>
                      </Space.Compact>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="生成数量">
                      <Input
                        type="number"
                        value={count}
                        onChange={(e) => setCount(Number(e.target.value))}
                        min={1}
                        max={4}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                {/* Generate Button */}
                <Form.Item>
                  <Button
                    type="primary"
                    size="large"
                    block
                    loading={isLoading}
                    onClick={handleGenerate}
                  >
                    生成图像
                  </Button>
                  {provider === 'replicate' && (
                    <Text
                      type="warning"
                      style={{ fontSize: '12px', marginTop: '8px', display: 'block' }}
                    >
                      注意：Replicate 是异步处理，可能需要等待几十秒
                    </Text>
                  )}
                </Form.Item>
              </Form>
            </Card>
          </Col>

          {/* Results Panel */}
          <Col span={12}>
            <Card title="生成结果">
              {result && (
                <div>
                  {/* Generated Images */}
                  <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    {result.images.map((image, index) => (
                      <div
                        key={index}
                        style={{
                          border: '1px solid #d9d9d9',
                          borderRadius: '8px',
                          overflow: 'hidden',
                        }}
                      >
                        <img
                          src={image.url}
                          alt={`Generated artwork ${index + 1}`}
                          style={{ width: '100%', height: 'auto' }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIExvYWQgRXJyb3I8L3RleHQ+PC9zdmc+';
                          }}
                        />
                        <div
                          style={{ padding: '12px', backgroundColor: '#fafafa', fontSize: '12px' }}
                        >
                          <p>
                            <strong>尺寸:</strong> {image.width}x{image.height}
                          </p>
                          <p>
                            <strong>格式:</strong> {image.format}
                          </p>
                          {image.seed && (
                            <p>
                              <strong>种子:</strong> {image.seed}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </Space>

                  <Divider />

                  {/* Metadata */}
                  <div style={{ backgroundColor: '#fafafa', borderRadius: '8px', padding: '16px' }}>
                    <Title level={5}>生成信息</Title>
                    <div style={{ fontSize: '12px' }}>
                      <p>
                        <strong>Provider:</strong> {result.metadata.provider}
                      </p>
                      <p>
                        <strong>模型:</strong> {result.metadata.model}
                      </p>
                      <p>
                        <strong>提示词:</strong> {result.metadata.prompt}
                      </p>
                      {result.metadata.taskId && (
                        <p>
                          <strong>任务ID:</strong> {result.metadata.taskId}
                        </p>
                      )}
                      {result.metadata.usage?.processingTime && (
                        <p>
                          <strong>处理时间:</strong>{' '}
                          {result.metadata.usage.processingTime.toFixed(2)}s
                        </p>
                      )}
                      {result.metadata.usage?.cost && (
                        <p>
                          <strong>费用:</strong> ${result.metadata.usage.cost.toFixed(4)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {!result && !isLoading && (
                <div style={{ textAlign: 'center', padding: '48px 0', color: '#999' }}>
                  <p>配置参数并点击生成图像开始测试</p>
                </div>
              )}

              {isLoading && (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <Spin size="large" />
                  <p style={{ marginTop: '16px', color: '#666' }}>
                    {provider === 'replicate' ? 'Generating, please wait...' : 'Generating...'}
                  </p>
                </div>
              )}
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
}
