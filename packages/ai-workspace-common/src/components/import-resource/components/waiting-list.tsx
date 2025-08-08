import { memo } from 'react';
import { Button, Progress, Avatar } from 'antd';
import { FileTextOutlined, LinkOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useImportResourceStoreShallow } from '@refly/stores';
import type { WaitingListItem } from '@refly/stores/src/stores/import-resource';
import { safeParseURL } from '@refly/utils/url';
import { Delete } from 'refly-icons';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';

const WaitingList = memo(() => {
  const { t } = useTranslation();
  const { waitingList, removeFromWaitingList } = useImportResourceStoreShallow((state) => ({
    waitingList: state.waitingList,
    removeFromWaitingList: state.removeFromWaitingList,
  }));

  const getItemIcon = (type: WaitingListItem['type']) => {
    switch (type) {
      case 'file':
        return <FileTextOutlined className="text-green-500" />;
      case 'weblink':
        return <LinkOutlined className="text-purple-500" />;
      default:
        return <FileTextOutlined className="text-gray-500" />;
    }
  };

  const getItemStatus = (item: WaitingListItem) => {
    if (item.status === 'processing') {
      return (
        <div className="flex items-center gap-2">
          <Progress percent={item.progress ?? 0} size="small" showInfo={false} className="w-16" />
          <span className="text-xs text-gray-500">
            {t('resource.import.uploading')} {item.progress ?? 0}%
          </span>
        </div>
      );
    }
    return null;
  };

  const renderWeblinkItem = (item: WaitingListItem) => {
    const isError = item.link?.isError;
    const link = item.link;

    const isHandled = item.link?.isHandled;
    console.log('isHandled', item);

    return (
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Spin spinning={!isHandled} size="small">
          <Avatar
            className="w-5 h-5 rounded-full"
            src={
              link?.image ||
              `https://www.google.com/s2/favicons?domain=${safeParseURL(item.url)}&sz=16`
            }
          />
        </Spin>

        <div className="flex-1 min-w-0">
          <div className="text-sm text-refly-text-0 truncate">
            {isError ? (
              <span className="text-red-500">{t('resource.import.scrapeError')}</span>
            ) : (
              link?.title || item.title || item.url
            )}
          </div>
          {/* {item.url && (
            <div
              className="text-xs text-gray-500 truncate cursor-pointer hover:text-blue-500"
              onClick={() => window.open(item.url, '_blank')}
            >
              {item.url}
            </div>
          )}
          {link?.description && (
            <div className="text-xs text-gray-400 truncate mt-1">{link.description}</div>
          )} */}
        </div>
      </div>
    );
  };

  const renderFileItem = (item: WaitingListItem) => {
    return (
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {getItemIcon(item.type)}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {item.title}
          </div>
          {item.url && <div className="text-xs text-gray-500 truncate">{item.url}</div>}
          {getItemStatus(item)}
        </div>
      </div>
    );
  };

  if (waitingList.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-refly-text-1 text-xs leading-4">
          {t('resource.import.noPendingFiles')}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-y-1 p-3">
      {waitingList.map((item) => (
        <div key={item.id} className="p-2 group hover:bg-refly-tertiary-hover rounded-lg">
          <div className="flex items-center justify-between w-full gap-x-2">
            {item.type === 'weblink' ? renderWeblinkItem(item) : renderFileItem(item)}
            <Button
              type="text"
              size="small"
              icon={<Delete size={20} />}
              onClick={() => removeFromWaitingList(item.id)}
              className="flex-shrink-0 text-refly-text-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            />
          </div>
        </div>
      ))}
    </div>
  );
});

WaitingList.displayName = 'WaitingList';

export default WaitingList;
