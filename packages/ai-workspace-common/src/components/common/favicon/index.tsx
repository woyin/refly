import { serverOrigin } from '@refly/ui-kit';
import { useMemo } from 'react';

export const Favicon = (props: { url: string; size?: number }) => {
  const { size = 12, url } = props;

  const faviconUrl = useMemo(() => {
    if (!url || url.trim() === '') {
      return null;
    }

    try {
      const { host } = new URL(url);
      return `${serverOrigin}/v1/misc/favicon?domain=${host}`;
    } catch (_error) {
      // Invalid URL, return null to indicate fallback behavior
      return null;
    }
  }, [url]);

  if (!faviconUrl) {
    // Fallback: render a generic icon or empty div when URL is invalid
    return (
      <div
        style={{ width: size, height: size }}
        className="flex items-center justify-center bg-gray-100 rounded-sm"
      >
        <span className="text-xs text-gray-400">?</span>
      </div>
    );
  }

  return <img style={{ width: size, height: size }} src={faviconUrl} alt={`${url}`} />;
};
