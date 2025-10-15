import { serverOrigin } from '@refly/ui-kit';
import { useMemo } from 'react';

export const Favicon = (props: { url: string; size?: number }) => {
  const { size = 12, url } = props;

  const faviconUrl = useMemo(() => {
    const { host } = new URL(url);
    return `${serverOrigin}/v1/misc/favicon?domain=${host}`;
  }, [url]);

  return <img style={{ width: size, height: size }} src={faviconUrl} alt={`${url}`} />;
};
