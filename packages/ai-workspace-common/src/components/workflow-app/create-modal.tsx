import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, message, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { copyToClipboard } from '@refly-packages/ai-workspace-common/utils';
import { getShareLink } from '@refly-packages/ai-workspace-common/utils/share';
import { Checked } from 'refly-icons';

interface CreateWorkflowAppModalProps {
  title: string;
  canvasId: string;
  visible: boolean;
  setVisible: (visible: boolean) => void;
  onPublishSuccess?: () => void;
}

interface SuccessMessageProps {
  shareId: string;
  onClose?: () => void;
}

// Success message shown inside antd message with share link and copy action
const SuccessMessage = memo(({ shareId, onClose }: SuccessMessageProps) => {
  const { t } = useTranslation();
  const shareLink = useMemo(() => getShareLink('workflowApp', shareId), [shareId]);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!shareLink) return;
    try {
      copyToClipboard(shareLink);
      setCopied(true);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to copy link:', err);
    }
  }, [shareLink]);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  // Auto copy link when component mounts
  useEffect(() => {
    if (shareLink) {
      handleCopy();
    }
  }, [shareLink, handleCopy]);

  return (
    <div className="flex items-center gap-2">
      <Checked size={20} color="var(--refly-func-success-default)" />
      <span className="text-base font-medium text-refly-text-0">
        {t('workflowApp.publishSuccess')}
      </span>
      <div className="flex items-center gap-2 border border-refly-Card-Border bg-refly-bg-content-z1 rounded-full pl-3 pr-1 py-1 max-w-[500px]">
        <span className="flex-1 text-sm text-refly-text-1 max-w-[260px] overflow-hidden text-ellipsis whitespace-nowrap">
          {shareLink}
        </span>
        <Button
          size="small"
          className="!h-[28px] !px-3 rounded-full text-sm text-refly-text-0"
          onClick={handleCopy}
        >
          {copied ? t('shareContent.linkCopied') : t('shareContent.copyLink')}
        </Button>
        <Button
          size="small"
          className="!h-[28px] !px-2 rounded-full text-sm text-refly-text-2 hover:text-refly-text-0"
          onClick={handleClose}
          type="text"
        >
          ×
        </Button>
      </div>
    </div>
  );
});

SuccessMessage.displayName = 'SuccessMessage';

export const CreateWorkflowAppModal = ({
  canvasId,
  title,
  visible,
  setVisible,
  onPublishSuccess,
}: CreateWorkflowAppModalProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const [confirmLoading, setConfirmLoading] = useState(false);
  // const { uploadCanvasCover } = useExportCanvasAsImage();

  const { workflow } = useCanvasContext();
  const { workflowVariables } = workflow ?? {};

  const createWorkflowApp = async ({
    title,
    description,
  }: { title: string; description: string }) => {
    if (confirmLoading) return;

    setConfirmLoading(true);

    try {
      const { data } = await getClient().createWorkflowApp({
        body: {
          title,
          description,
          canvasId,
          query: '', // TODO: support query edit
          variables: workflowVariables ?? [],
        },
      });

      const shareId = data?.data?.shareId ?? '';

      if (data?.success && shareId) {
        setVisible(false);
        const messageInstance = messageApi.open({
          content: <SuccessMessage shareId={shareId} onClose={() => messageInstance()} />,
          duration: 0, // Set to 0 to prevent auto-close
        });
        // Trigger refresh of workflow apps data
        onPublishSuccess?.();
      } else if (!data?.success) {
        message.error(t('common.operationFailed'));
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error creating workflow app', error);
      message.error(t('common.operationFailed'));
    } finally {
      setConfirmLoading(false);
    }
  };

  const onSubmit = async () => {
    try {
      const values = await form.validateFields();
      await createWorkflowApp(values);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error validating form fields', error);
    }
  };

  useEffect(() => {
    if (visible) {
      form.setFieldsValue({
        title,
        description: '',
      });
    }
  }, [visible, title]);

  return (
    <Modal
      centered
      open={visible}
      onCancel={() => setVisible(false)}
      onOk={onSubmit}
      confirmLoading={confirmLoading}
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
      title={t('workflowApp.publish')}
    >
      {contextHolder}
      <div className="w-full h-full pt-4 overflow-y-auto">
        <Form form={form}>
          <div className="flex flex-col gap-2">
            {/* Title Field */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="title-input"
                className="text-xs font-semibold text-refly-text-0 leading-[1.33]"
              >
                {t('workflowApp.title')}
                <span className="text-refly-func-danger-default ml-1">*</span>
              </label>
              <Form.Item
                name="title"
                rules={[{ required: true, message: t('common.required') }]}
                className="mb-0"
              >
                <Input
                  id="title-input"
                  placeholder={t('workflowApp.titlePlaceholder')}
                  className="h-8 rounded-lg border-0 bg-refly-bg-control-z0 px-3 text-sm font-normal text-refly-text-0 placeholder:text-refly-text-3 focus:bg-refly-bg-control-z0 focus:shadow-sm"
                />
              </Form.Item>
            </div>

            {/* Description Field */}
            <div className="flex flex-col gap-2 mt-5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="description-input"
                  className="text-xs font-semibold text-refly-text-0 leading-[1.33]"
                >
                  {t('workflowApp.description')}
                </label>
              </div>
              <Form.Item name="description" className="mb-0">
                <Input.TextArea
                  id="description-input"
                  placeholder={t('workflowApp.descriptionPlaceholder')}
                  className="min-h-[80px] rounded-lg border-0 bg-refly-bg-control-z0 px-3 py-2 text-sm font-normal text-refly-text-0 placeholder:text-refly-text-3 focus:bg-refly-bg-control-z0 focus:shadow-sm"
                  autoSize={{ minRows: 3, maxRows: 6 }}
                />
              </Form.Item>
            </div>
          </div>
        </Form>
      </div>
    </Modal>
  );
};
