import { useListToolsets } from '@refly-packages/ai-workspace-common/queries';
import { ToolsetInstance } from '@refly/openapi-schema';
import { Tools } from 'refly-icons';
import { Button, Tag } from 'antd';
import { useTranslation } from 'react-i18next';

export const ToolList = () => {
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.language as 'en' | 'zh';
  const { data } = useListToolsets({}, [], {
    enabled: true,
  });
  const tools = data?.data || [];
  console.log(tools);

  const toolItem = (tool: ToolsetInstance) => {
    return (
      <div
        className="mb-2 px-2 py-3 rounded-[8px] cursor-pointer hover:bg-refly-tertiary-hover flex items-start gap-3"
        key={tool.toolsetId}
      >
        <div className="flex-shrink-0 h-10 w-10 rounded-md bg-refly-tertiary-default flex items-center justify-center">
          <Tools size={24} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="font-semibold text-refly-text-0 leading-5 text-sm mb-0.5">
                {tool.name}
              </div>
              <div className="text-refly-text-1 text-xs leading-4 line-clamp-2">
                {(tool.descriptionDict?.[currentLanguage] as string) ||
                  (tool.descriptionDict?.en as string)}
                lsamdfklsd里面是段落分明水电费茅塞顿开里面概括地说莫高窟等什么赶快电闪雷鸣高门大嗓是德拉克马反倒是考虑买个陌生的离开lsamdfklsd里面是段落分明水电费茅塞顿开里面概括地说莫高窟等什么赶快电闪雷鸣高门大嗓是德拉克马反倒是考虑买个陌生的离开lsamdfklsd里面是段落分明水电费茅塞顿开里面概括地说莫高窟等什么赶快电闪雷鸣高门大嗓是德拉克马反倒是考虑买个陌生的离开
              </div>
            </div>

            {!tool.isGlobal && (
              <div>
                <Button type="text" size="small" onClick={() => {}}>
                  {t('common.edit')}
                </Button>
              </div>
            )}
          </div>

          <div className="mt-2 p-2 bg-refly-bg-control-z0 rounded-[8px]">
            <div className="flex items-center gap-2 flex-wrap">
              {tool.tools.map((t, index) => {
                return (
                  <Tag
                    key={index}
                    className="bg-refly-tertiary-default border-solid border-[1px] border-refly-Card-Border font-semibold text-refly-text-1 h-[18px] flex items-center justify-center rounded-[4px] text-[10px] leading-[14px]"
                  >
                    {t.name}
                  </Tag>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-5 h-full overflow-y-auto">
      {tools.map(toolItem)}
      <div className="text-center text-gray-400 text-sm mt-4 pb-10">{t('common.noMore')}</div>
    </div>
  );
};
