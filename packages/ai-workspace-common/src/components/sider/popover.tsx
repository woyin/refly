import { Button, Popover } from 'antd';
import { SiderLayout } from './layout';
import { SideRight } from 'refly-icons';
import { useSiderStoreShallow } from '@refly/stores';
import { Logo } from '../common/logo';
import { GithubStar } from '../common/github-star';
import cn from 'classnames';

interface SiderPopoverProps {
  children?: React.ReactNode;
  childrenClassName?: string;
  showBrand?: boolean;
  align?: {
    offset: [number, number];
  };
}

export const SiderPopover = (props: SiderPopoverProps) => {
  const { children, childrenClassName, align = { offset: [0, -40] }, showBrand = true } = props;
  const { collapse, setCollapse } = useSiderStoreShallow((state) => ({
    collapse: state.collapse,
    setCollapse: state.setCollapse,
  }));

  return (
    <div className={cn('flex items-center gap-2', childrenClassName)}>
      <Popover
        zIndex={11}
        overlayInnerStyle={{ padding: 0, boxShadow: 'none', border: 'none' }}
        className="shadow-none"
        arrow={false}
        placement="bottom"
        align={align}
        content={<SiderLayout source="popover" />}
      >
        {children || (
          <Button
            type="text"
            icon={<SideRight size={20} />}
            onClick={() => {
              setCollapse(!collapse);
            }}
          />
        )}
      </Popover>
      {showBrand && (
        <>
          <Logo />
          <GithubStar />
        </>
      )}
    </div>
  );
};
