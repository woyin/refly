import { useCallback, useEffect, useState } from 'react';
import { Button, message, Upload, UploadProps } from 'antd';
import { TbFile } from 'react-icons/tb';
import { useImportResourceStoreShallow } from '@refly/stores';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useTranslation } from 'react-i18next';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';
import type { RcFile } from 'antd/es/upload/interface';
import { genResourceID } from '@refly/utils/id';
import { LuInfo } from 'react-icons/lu';
import { useSubscriptionStoreShallow } from '@refly/stores';
import { GrUnlock } from 'react-icons/gr';
import { useUserStoreShallow } from '@refly/stores';
import { subscriptionEnabled } from '@refly/ui-kit';
import { logEvent } from '@refly/telemetry-web';

const { Dragger } = Upload;

interface FileItem {
  title: string;
  url: string;
  storageKey: string;
  uid?: string;
  status?: 'uploading' | 'done' | 'error';
}

const ALLOWED_FILE_EXTENSIONS = ['.pdf', '.docx', '.rtf', '.txt', '.md', '.html', '.epub'];

export const ImportFromFile = () => {
  const { t } = useTranslation();
  const {
    fileList: storageFileList,
    setFileList: setStorageFileList,
    addToWaitingList,
    removeFromWaitingList,
    updateWaitingListItem,
    waitingList,
  } = useImportResourceStoreShallow((state) => ({
    setFileList: state.setFileList,
    fileList: state.fileList,
    addToWaitingList: state.addToWaitingList,
    removeFromWaitingList: state.removeFromWaitingList,
    updateWaitingListItem: state.updateWaitingListItem,
    waitingList: state.waitingList,
  }));
  const { setSubscribeModalVisible } = useSubscriptionStoreShallow((state) => ({
    setSubscribeModalVisible: state.setSubscribeModalVisible,
  }));

  const { fileParsingUsage } = useSubscriptionUsage();

  const [fileList, setFileList] = useState<FileItem[]>(storageFileList);

  const { userProfile } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
  }));

  const planType = userProfile?.subscription?.planType || 'free';
  const uploadLimit = fileParsingUsage?.fileUploadLimit ?? -1;
  const maxFileSize = `${uploadLimit}MB`;
  const maxFileSizeBytes = uploadLimit * 1024 * 1024;

  const uploadFile = async (file: File, uid: string) => {
    const { data } = await getClient().upload({
      body: {
        file,
      },
    });
    if (data?.success) {
      return { ...(data.data || {}), uid };
    }
    return { url: '', storageKey: '', uid };
  };

  const props: UploadProps = {
    name: 'file',
    multiple: true,
    accept: ALLOWED_FILE_EXTENSIONS.join(','),
    fileList: [],
    beforeUpload: async (file: File) => {
      if (uploadLimit > 0 && file.size > maxFileSizeBytes) {
        message.error(t('resource.import.fileTooLarge', { size: maxFileSize }));
        return Upload.LIST_IGNORE;
      }

      const tempUid = genResourceID();

      // Add file to waiting list with pending status
      addToWaitingList({
        id: tempUid,
        type: 'file',
        title: file.name,
        status: 'pending',
        progress: 0,
        file: {
          title: file.name,
          url: '',
          storageKey: '',
          uid: tempUid,
          status: 'uploading',
        },
      });

      setFileList((prev) => [
        ...prev,
        {
          title: file.name,
          url: '',
          storageKey: '',
          uid: tempUid,
          status: 'uploading',
        },
      ]);

      const data = await uploadFile(file, tempUid);
      if (data?.url && data?.storageKey) {
        // Update waiting list item with completed status
        updateWaitingListItem(tempUid, {
          status: 'pending',
          progress: 100,
          file: {
            title: file.name,
            url: data.url,
            storageKey: data.storageKey,
            uid: data.uid,
            status: 'done',
          },
        });

        setFileList((prev) =>
          prev.map((item) =>
            item.uid === tempUid
              ? {
                  title: file.name,
                  url: data.url,
                  storageKey: data.storageKey,
                  uid: data.uid,
                  status: 'done',
                }
              : item,
          ),
        );
      } else {
        // Update waiting list item with error status
        updateWaitingListItem(tempUid, {
          status: 'error',
          progress: 0,
          file: {
            title: file.name,
            url: '',
            storageKey: '',
            uid: tempUid,
            status: 'error',
          },
        });

        setFileList((prev) => prev.filter((item) => item.uid !== tempUid));
        message.error(`${t('common.uploadFailed')}: ${file.name}`);
      }

      return false;
    },
    onRemove: (file: RcFile) => {
      setFileList((prev) => prev.filter((item) => item.uid !== file.uid));
      // Also remove from waiting list
      const waitingItem = waitingList.find((item) => item.file?.uid === file.uid);
      if (waitingItem) {
        removeFromWaitingList(waitingItem.id);
      }
    },
  };

  const genUploadHint = () => {
    let hint = t('resource.import.supportedFiles', {
      formats: ALLOWED_FILE_EXTENSIONS.map((ext) => ext.slice(1).toUpperCase()).join(', '),
    });
    if (uploadLimit > 0) {
      hint += `. ${t('resource.import.fileUploadLimit', { size: maxFileSize })}`;
    }
    return hint;
  };

  useEffect(() => {
    setStorageFileList(fileList);
  }, [fileList, setStorageFileList]);

  const handleClickUnlockButton = useCallback(() => {
    logEvent('subscription::upgrade_click', 'import_file');
    setSubscribeModalVisible(true);
  }, [setSubscribeModalVisible]);

  return (
    <div className="h-full flex flex-col min-w-[500px] box-border intergation-import-from-weblink">
      {/* header */}
      <div className="flex items-center gap-x-[8px] pt-6 px-6">
        <span className="flex items-center justify-center">
          <TbFile className="text-lg" />
        </span>
        <div className="text-base font-bold">{t('resource.import.fromFile')}</div>
        {subscriptionEnabled && planType === 'free' && (
          <Button
            type="text"
            icon={<GrUnlock className="flex items-center justify-center" />}
            onClick={handleClickUnlockButton}
            className="text-green-600 font-medium"
          >
            {t('resource.import.unlockUploadLimit')}
          </Button>
        )}
      </div>

      {/* content */}
      <Dragger {...props} className=" w-full bg-refly-bg-control-z0 rounded-xl mb-1.5">
        <div className="flex flex-col items-center gap-2">
          <p className="ant-upload-text mt-4 text-refly-text-0">
            {t('resource.import.dragOrClick')}
          </p>
          <p className="ant-upload-hint text-refly-text-1 mt-2">{genUploadHint()}</p>
          {fileParsingUsage?.pagesLimit && fileParsingUsage?.pagesLimit >= 0 && (
            <div className="text-green-500 mt-2 text-xs font-medium flex items-center justify-center gap-1">
              <LuInfo />
              {t('resource.import.fileParsingUsage', {
                used: fileParsingUsage?.pagesParsed,
                limit: fileParsingUsage?.pagesLimit,
              })}
            </div>
          )}
        </div>
      </Dragger>
    </div>
  );
};
