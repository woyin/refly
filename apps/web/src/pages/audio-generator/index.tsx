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

/**
 * 音频生成模型列表
 */
const models = ['resemble-ai/chatterbox', 'google/lyria-2'];

/**
 * 音频生成器页面组件
 */
export default function AudioGenerator() {
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);

  /**
   * 处理音频生成请求
   * @param values 表单值
   */
  const handleGenerate = async (values: any) => {
    setIsLoading(true);
    setGeneratedAudio(null);

    try {
      const payload = {
        apiKey: values.apiKey,
        provider: 'replicate' as const,
        prompt: values.prompt,
        model: values.model,
      };

      console.log('发送请求:', payload);

      const response = await fetch('/v1/audio-generator/generate', {
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
      setGeneratedAudio(data.output);
      message.success('音频生成成功！');
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
          <Title level={2}>音频生成器</Title>
          <Paragraph>使用 AI 生成精美音频</Paragraph>
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
                  <TextArea placeholder="描述你想要生成的音频..." rows={4} />
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

                {/* 生成按钮 */}
                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={isLoading} size="large" block>
                    {isLoading ? '生成中...' : '生成音频'}
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
                  <div style={{ marginTop: '16px' }}>正在生成音频，请稍候...</div>
                </div>
              )}

              {!isLoading && !generatedAudio && (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
                  请配置参数并点击生成音频
                </div>
              )}

              {generatedAudio && (
                <div>
                  <audio
                    src={generatedAudio}
                    controls
                    style={{
                      width: '100%',
                      borderRadius: '8px',
                      border: '1px solid #d9d9d9',
                    }}
                    onError={(e) => {
                      message.error('音频加载失败');
                      console.error('音频加载错误:', e);
                    }}
                  >
                    <track kind="captions" srcLang="zh" label="中文字幕" />
                  </audio>
                  <div style={{ marginTop: '16px', textAlign: 'center' }}>
                    <Space>
                      <Button onClick={() => window.open(generatedAudio, '_blank')}>
                        在新窗口打开
                      </Button>
                      <Button
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = generatedAudio;
                          link.download = 'generated-audio.mp3';
                          link.click();
                        }}
                      >
                        下载音频
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
