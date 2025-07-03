import { useState } from 'react';
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
} from 'antd';

const { TextArea } = Input;
const { Title, Paragraph } = Typography;
const { Option } = Select;

// 模型选项
const models = [
  'black-forest-labs/flux-schnell',
  'black-forest-labs/flux-dev',
  'black-forest-labs/flux-pro',
  'stability-ai/stable-diffusion-xl-base-1.0',
];

// 宽高比选项
const aspectRatios = [
  { value: '1:1', label: '1:1 (正方形)' },
  { value: '16:9', label: '16:9 (横屏)' },
  { value: '9:16', label: '9:16 (竖屏)' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
];

/**
 * 图片生成页面组件
 */
export default function ImageGenerator() {
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  /**
   * 处理图片生成请求
   */
  const handleGenerate = async (values: any) => {
    setIsLoading(true);
    setGeneratedImage(null);

    try {
      const payload = {
        apiKey: values.apiKey,
        provider: 'replicate' as const,
        prompt: values.prompt,
        model: values.model,
        aspectRatio: values.aspectRatio,
      };

      console.log('发送请求:', payload);

      const response = await fetch('/v1/image-generator/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setGeneratedImage(data.output);
      message.success('图片生成成功！');
      console.log('生成成功:', data);
    } catch (err: any) {
      const errorMessage = err.message || '生成失败';
      message.error(`生成失败: ${errorMessage}`);
      console.error('生成错误:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', padding: '32px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Title level={2}>图片生成器</Title>
          <Paragraph>使用 AI 生成精美图片</Paragraph>
        </div>

        <Row gutter={32}>
          {/* 配置面板 */}
          <Col span={12}>
            <Card title="生成配置" style={{ height: 'fit-content' }}>
              <Form
                form={form}
                layout="vertical"
                onFinish={handleGenerate}
                initialValues={{
                  model: models[0],
                  aspectRatio: '1:1',
                }}
              >
                {/* API Key */}
                <Form.Item
                  label="API Key"
                  name="apiKey"
                  rules={[{ required: true, message: '请输入 API Key' }]}
                >
                  <Input.Password placeholder="请输入 Replicate API Key" />
                </Form.Item>

                {/* 提示词 */}
                <Form.Item
                  label="提示词"
                  name="prompt"
                  rules={[{ required: true, message: '请输入提示词' }]}
                >
                  <TextArea placeholder="描述你想要生成的图片..." rows={4} />
                </Form.Item>

                {/* 模型选择 */}
                <Form.Item label="模型" name="model">
                  <Select>
                    {models.map((model) => (
                      <Option key={model} value={model}>
                        {model}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                {/* 宽高比 */}
                <Form.Item label="宽高比" name="aspectRatio">
                  <Select>
                    {aspectRatios.map((ratio) => (
                      <Option key={ratio.value} value={ratio.value}>
                        {ratio.label}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                {/* 生成按钮 */}
                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={isLoading} size="large" block>
                    {isLoading ? '生成中...' : '生成图片'}
                  </Button>
                </Form.Item>
              </Form>
            </Card>
          </Col>

          {/* 结果展示 */}
          <Col span={12}>
            <Card title="生成结果" style={{ height: 'fit-content' }}>
              {isLoading && (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                  <Spin size="large" />
                  <div style={{ marginTop: '16px' }}>正在生成图片，请稍候...</div>
                </div>
              )}

              {!isLoading && !generatedImage && (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
                  请配置参数并点击生成图片
                </div>
              )}

              {generatedImage && (
                <div>
                  <img
                    src={generatedImage}
                    alt="Generated artwork"
                    style={{
                      width: '100%',
                      height: 'auto',
                      borderRadius: '8px',
                      border: '1px solid #d9d9d9',
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIExvYWQgRXJyb3I8L3RleHQ+PC9zdmc+';
                    }}
                  />
                  <div style={{ marginTop: '16px', textAlign: 'center' }}>
                    <Space>
                      <Button onClick={() => window.open(generatedImage, '_blank')}>
                        在新窗口打开
                      </Button>
                      <Button
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = generatedImage;
                          link.download = 'generated-image.png';
                          link.click();
                        }}
                      >
                        下载图片
                      </Button>
                    </Space>
                  </div>
                </div>
              )}
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
}
