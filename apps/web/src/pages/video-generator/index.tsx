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

// 视频模型选项
const models = [
  'bytedance/seedance-1-pro',
  'bytedance/seedance-1-lite',
  'minimax/video-01',
  'kwaivgi/kling-v2.1',
  'google/veo-3',
  'luma/ray-flash-2-540p',
];

// 宽高比选项
const aspectRatios = [
  { value: '1:1', label: '1:1' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
];

/**
 * 视频生成页面组件
 */
export default function VideoGenerator() {
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);

  /**
   * 处理视频生成请求
   */
  const handleGenerate = async (values: any) => {
    setIsLoading(true);
    setGeneratedVideo(null);

    try {
      const payload = {
        apiKey: values.apiKey,
        provider: 'replicate' as const,
        prompt: values.prompt,
        model: values.model,
        aspectRatio: values.aspectRatio,
      };

      console.log('发送请求:', payload);

      const response = await fetch('/v1/video-generator/generate', {
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
      setGeneratedVideo(data.output);
      message.success('视频生成成功！');
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
          <Title level={2}>视频生成器</Title>
          <Paragraph>使用 AI 生成精美视频</Paragraph>
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
                  aspectRatio: '16:9',
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
                  <TextArea placeholder="描述你想要生成的视频..." rows={4} />
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
                    {isLoading ? '生成中...' : '生成视频'}
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
                  <div style={{ marginTop: '16px' }}>正在生成视频，请稍候...</div>
                </div>
              )}

              {!isLoading && !generatedVideo && (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
                  请配置参数并点击生成视频
                </div>
              )}

              {generatedVideo && (
                <div>
                  <video
                    src={generatedVideo}
                    controls
                    style={{
                      width: '100%',
                      height: 'auto',
                      borderRadius: '8px',
                      border: '1px solid #d9d9d9',
                    }}
                    onError={(_e) => {
                      message.error('视频加载失败');
                    }}
                  >
                    <track kind="captions" src="" srcLang="zh" label="中文字幕" default />
                    您的浏览器不支持视频播放
                  </video>
                  <div style={{ marginTop: '16px', textAlign: 'center' }}>
                    <Space>
                      <Button onClick={() => window.open(generatedVideo, '_blank')}>
                        在新窗口打开
                      </Button>
                      <Button
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = generatedVideo;
                          link.download = 'generated-video.mp4';
                          link.click();
                        }}
                      >
                        下载视频
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
