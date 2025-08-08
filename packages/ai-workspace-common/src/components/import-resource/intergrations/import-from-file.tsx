import { useEffect, useState } from 'react';
import { message, Upload, UploadProps } from 'antd';
import { useImportResourceStoreShallow } from '@refly/stores';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useTranslation } from 'react-i18next';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';
import type { RcFile } from 'antd/es/upload/interface';
import { genResourceID } from '@refly/utils/id';

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

  const { fileParsingUsage } = useSubscriptionUsage();

  const [fileList, setFileList] = useState<FileItem[]>(storageFileList);

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

  return (
    <div className="h-full flex flex-col min-w-[500px] box-border intergation-import-from-weblink">
      <Dragger
        {...props}
        className="file-upload-container w-full bg-refly-bg-control-z0 rounded-xl mb-1.5"
      >
        <div className="flex flex-col items-center gap-2">
          <div className="text-refly-primary-default text-sm font-medium leading-5">
            {t('resource.import.dragOrClick')}
          </div>
          <div className="text-refly-text-1 text-sm leading-4">{genUploadHint()}</div>
          {fileParsingUsage?.pagesLimit && fileParsingUsage?.pagesLimit >= 0 && (
            <div className="text-refly-text-1 text-sm leading-4">
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
