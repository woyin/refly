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
 * 媒体类型枚举
 */
enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
}

/**
 * 媒体类型选项
 */
const mediaTypes = [
  { value: MediaType.IMAGE, label: '图片' },
  { value: MediaType.VIDEO, label: '视频' },
  { value: MediaType.AUDIO, label: '音频' },
];

/**
 * 模型列表（按媒体类型分组）
 */
const modelsByType = {
  [MediaType.IMAGE]: [
    'black-forest-labs/flux-schnell',
    'black-forest-labs/flux-dev',
    'black-forest-labs/flux-pro',
  ],
  [MediaType.VIDEO]: [
    'bytedance/seedance-1-pro',
    'bytedance/seedance-1-lite',
    'minimax/video-01',
    'kwaivgi/kling-v2.1',
    'google/veo-3',
    'luma/ray-flash-2-540p',
  ],
  [MediaType.AUDIO]: ['resemble-ai/chatterbox', 'google/lyria-2'],
};

/**
 * 统一媒体生成器页面组件
 */
export default function MediaGenerator() {
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [mediaType, setMediaType] = useState<MediaType>(MediaType.IMAGE);
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);

  /**
   * 处理媒体类型变更
   * @param type 媒体类型
   */
  const handleMediaTypeChange = (type: MediaType) => {
    setMediaType(type);
    // 重置生成内容
    setGeneratedContent(null);
    // 更新表单中的模型为当前媒体类型的第一个模型
    form.setFieldsValue({ model: modelsByType[type][0] });
  };

  /**
   * 处理媒体生成请求
   * @param values 表单值
   */
  const handleGenerate = async (values: any) => {
    setIsLoading(true);
    setGeneratedContent(null);

    try {
      const payload = {
        mediaType: values.mediaType,
        apiKey: values.apiKey,
        provider: 'replicate',
        prompt: values.prompt,
        model: values.model,
      };

      console.log('发送请求:', payload);

      const response = await fetch('/v1/media/generate', {
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
      setGeneratedContent(data.data?.outputUrl);
      message.success(`${getMediaTypeName(values.mediaType)}生成成功！`);
      console.log('生成成功:', data);
    } catch (err: any) {
      const errorMessage = err.message || '生成失败';
      message.error(`生成失败: ${errorMessage}`);
      console.error('生成错误:', err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 获取媒体类型名称
   * @param type 媒体类型
   * @returns 媒体类型名称
   */
  const getMediaTypeName = (type: MediaType): string => {
    const mediaTypeObj = mediaTypes.find((item) => item.value === type);
    return mediaTypeObj ? mediaTypeObj.label : '媒体';
  };

  /**
   * 渲染媒体内容
   * @returns JSX元素
   */
  const renderMediaContent = () => {
    if (isLoading) {
      return (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: '16px' }}>正在生成{getMediaTypeName(mediaType)}，请稍候...</div>
        </div>
      );
    }

    if (!generatedContent) {
      return (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
          请配置参数并点击生成{getMediaTypeName(mediaType)}
        </div>
      );
    }

    switch (mediaType) {
      case MediaType.IMAGE:
        return (
          <div>
            <img
              src={generatedContent}
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
          </div>
        );
      case MediaType.VIDEO:
        return (
          <div>
            <video
              src={generatedContent}
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
          </div>
        );
      case MediaType.AUDIO:
        return (
          <div>
            <audio
              src={generatedContent}
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
          </div>
        );
      default:
        return null;
    }
  };

  /**
   * 渲染下载按钮
   * @returns JSX元素
   */
  const renderDownloadButtons = () => {
    if (!generatedContent) return null;

    let fileExtension = '';
    let contentType = '';

    switch (mediaType) {
      case MediaType.IMAGE:
        fileExtension = 'png';
        contentType = '图片';
        break;
      case MediaType.VIDEO:
        fileExtension = 'mp4';
        contentType = '视频';
        break;
      case MediaType.AUDIO:
        fileExtension = 'mp3';
        contentType = '音频';
        break;
    }

    return (
      <div style={{ marginTop: '16px', textAlign: 'center' }}>
        <Space>
          <Button onClick={() => window.open(generatedContent, '_blank')}>在新窗口打开</Button>
          <Button
            onClick={() => {
              const link = document.createElement('a');
              link.href = generatedContent;
              link.download = `generated-${mediaType}.${fileExtension}`;
              link.click();
            }}
          >
            下载{contentType}
          </Button>
        </Space>
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', padding: '32px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Title level={2}>媒体生成器</Title>
          <Paragraph>使用 AI 生成精美{getMediaTypeName(mediaType)}</Paragraph>
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
                  mediaType: MediaType.IMAGE,
                  model: modelsByType[MediaType.IMAGE][0],
                }}
              >
                {/* 媒体类型 */}
                <Form.Item
                  label="媒体类型"
                  name="mediaType"
                  rules={[{ required: true, message: '请选择媒体类型' }]}
                >
                  <Select onChange={(value) => handleMediaTypeChange(value as MediaType)}>
                    {mediaTypes.map((type) => (
                      <Option key={type.value} value={type.value}>
                        {type.label}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

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
                  <TextArea
                    placeholder={`描述你想要生成的${getMediaTypeName(mediaType)}...`}
                    rows={4}
                  />
                </Form.Item>

                {/* 模型选择 */}
                <Form.Item label="模型" name="model">
                  <Select>
                    {modelsByType[mediaType].map((model) => (
                      <Option key={model} value={model}>
                        {model}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                {/* 生成按钮 */}
                <Form.Item>
                  <Button type="primary" htmlType="submit" loading={isLoading} size="large" block>
                    {isLoading ? '生成中...' : `生成${getMediaTypeName(mediaType)}`}
                  </Button>
                </Form.Item>
              </Form>
            </Card>
          </Col>

          {/* 结果展示 */}
          <Col span={12}>
            <Card title="生成结果" style={{ height: 'fit-content' }}>
              {renderMediaContent()}
              {renderDownloadButtons()}
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
}
