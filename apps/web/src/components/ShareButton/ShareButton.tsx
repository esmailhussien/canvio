import { useState } from 'react';
import { IconShare } from '@canvio/ui';
import './ShareButton.css';

export function ShareButton({ worldId }: { worldId: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const handleShare = async () => {
    const shareUrl = worldId
      ? new URL(`/w/${worldId}`, window.location.origin).href
      : window.location.href;

    try {
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
    } catch {
      setStatus('error');
    }

    setTimeout(() => setStatus('idle'), 2000);
  };

  return (
    <button className="share-btn" onClick={handleShare} title="Copy link to clipboard">
      <IconShare size={16} />
      <span>{status === 'copied' ? 'Copied!' : status === 'error' ? 'Copy failed' : 'Share'}</span>
    </button>
  );
}
