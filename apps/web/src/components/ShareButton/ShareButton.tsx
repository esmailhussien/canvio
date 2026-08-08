import { useState } from 'react';
import { IconShare } from '@canvio/ui';
import { ApiRequestError, createBoardShareLink } from '../../utils/api';
import './ShareButton.css';

export function ShareButton({ worldId }: { worldId: string }) {
  const [status, setStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle');
  const [errorText, setErrorText] = useState('Copy failed');

  const handleShare = async () => {
    try {
      setStatus('copying');
      const shareResult = worldId ? await createBoardShareLink(worldId) : null;
      const shareUrl = shareResult?.url
        ? new URL(shareResult.url, window.location.origin).href
        : window.location.href;

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const input = document.createElement('textarea');
        input.value = shareUrl;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        input.remove();
      }
      setStatus('copied');
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 429) {
        setErrorText('Try again soon');
      } else if (error instanceof ApiRequestError && error.status === 403) {
        setErrorText('No access');
      } else {
        setErrorText('Copy failed');
      }
      setStatus('error');
    }

    setTimeout(() => {
      setStatus('idle');
      setErrorText('Copy failed');
    }, 2000);
  };

  return (
    <button className="share-btn" onClick={handleShare} title="Copy link to clipboard">
      <IconShare size={16} />
      <span>{status === 'copying' ? 'Sharing...' : status === 'copied' ? 'Copied!' : status === 'error' ? errorText : 'Share'}</span>
    </button>
  );
}
