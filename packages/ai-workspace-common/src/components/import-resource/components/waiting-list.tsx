import { memo } from 'react';
import { List, Button, Progress } from 'antd';
import { DeleteOutlined, FileTextOutlined, LinkOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useImportResourceStoreShallow } from '@refly/stores';
import type { WaitingListItem } from '@refly/stores/src/stores/import-resource';

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

  if (waitingList.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">{t('resource.import.noPendingFiles')}</div>
    );
  }

  return (
    <List
      size="small"
      dataSource={waitingList}
      renderItem={(item) => (
        <List.Item className="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800">
          <div className="flex items-center justify-between w-full">
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
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => removeFromWaitingList(item.id)}
              className="text-gray-400 hover:text-red-500"
            />
          </div>
        </List.Item>
      )}
    />
  );
});

WaitingList.displayName = 'WaitingList';

export default WaitingList;
