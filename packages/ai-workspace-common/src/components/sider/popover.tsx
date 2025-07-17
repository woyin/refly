import { Popover } from 'antd';
import { SiderLayout } from './layout';

interface SiderPopoverProps {
  children: React.ReactNode;
}

export const SiderPopover = (props: SiderPopoverProps) => {
  const { children } = props;

  return (
    <Popover
      zIndex={11}
      overlayInnerStyle={{ padding: 0, boxShadow: 'none', border: 'none' }}
      className="shadow-none"
      arrow={false}
      placement="rightBottom"
      mouseEnterDelay={0.5}
      content={<SiderLayout source="popover" />}
    >
      {children}
    </Popover>
  );
};
