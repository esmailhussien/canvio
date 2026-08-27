import { useEffect, useMemo, useRef, useState } from 'react';
import { IconCopy, IconShare, IconX } from '@canvio/ui';
import { ApiRequestError, createBoardShareLink } from '../../utils/api';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { trackBoardEvent } from '../../utils/productTelemetry';
import './ShareButton.css';

type ShareStatus = 'idle' | 'loading' | 'ready' | 'copied' | 'error';

function getSavedName() {
  try {
    return localStorage.getItem('CANVIO_COLLABORATOR_NAME') || '';
  } catch {
    return '';
  }
}

interface ShareButtonProps {
  worldId: string;
  // Bump this token to open the dialog and focus the display-name field —
  // used by the presence avatar so joiners can rename "Anonymous Fox".
  focusNameSignal?: number;
  collaboratorCount?: number;
}

export function ShareButton({ worldId, focusNameSignal = 0, collaboratorCount = 0 }: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<ShareStatus>('idle');
  const [shareUrl, setShareUrl] = useState('');
  const [name, setName] = useState(getSavedName);
  const [isPublic, setIsPublic] = useState(false);
  const [errorText, setErrorText] = useState('Unable to create a share link.');
  const dialogRef = useRef<HTMLElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  useDialogA11y(dialogRef, isOpen, () => setIsOpen(false));

  const openShare = async (forcePublic = isPublic) => {
    setIsOpen(true);
    setStatus('loading');
    setShareUrl('');
    setErrorText('Unable to create a share link.');

    try {
      const shareResult = worldId ? await createBoardShareLink(worldId, forcePublic) : null;
      const nextUrl = shareResult?.url
        ? new URL(shareResult.url, window.location.origin).href
        : window.location.href;
      setShareUrl(nextUrl);
      setIsPublic(Boolean(shareResult?.isPublic));
      setStatus('ready');
      if (worldId) {
        trackBoardEvent(worldId, 'share_created', {
          isPublic: Boolean(shareResult?.isPublic),
          collaboratorCount,
        });
      }
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 429) {
        setErrorText('Too many requests. Try again shortly.');
      } else if (error instanceof ApiRequestError && error.status === 403) {
        setErrorText('You do not have access to share this board.');
      } else if (error instanceof ApiRequestError) {
        setErrorText(error.message);
      }
      setStatus('error');
      if (worldId) {
        trackBoardEvent(worldId, 'runtime_issue', {
          area: 'share',
          code: 'request_failed',
          recoverable: true,
        });
      }
    }
  };

  const handleTogglePublic = async () => {
    const nextPublic = !isPublic;
    setIsPublic(nextPublic);
    await openShare(nextPublic);
  };

  const openShareRef = useRef(openShare);
  openShareRef.current = openShare;

  useEffect(() => {
    if (!focusNameSignal) return;
    openShareRef.current();
    // Wait for the dialog to mount before moving focus into the name field.
    const timer = window.setTimeout(() => nameInputRef.current?.focus(), 120);
    return () => window.clearTimeout(timer);
  }, [focusNameSignal]);

  const qrUrl = useMemo(() => (
    shareUrl
      ? `https://quickchart.io/qr?text=${encodeURIComponent(shareUrl)}&size=240&margin=2`
      : ''
  ), [shareUrl]);

  const saveName = (value: string) => {
    setName(value);
    try {
      localStorage.setItem('CANVIO_COLLABORATOR_NAME', value.trim());
    } catch {
      // The name is optional; sharing still works when storage is blocked.
    }
    window.dispatchEvent(new CustomEvent('canvio:collaborator-name', {
      detail: { name: value.trim() },
    }));
  };

  const copyLink = async () => {
    if (!shareUrl) return;
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
      window.setTimeout(() => setStatus((current) => current === 'copied' ? 'ready' : current), 1800);
    } catch {
      setStatus('error');
      setErrorText('Copy failed. Select the link and copy it manually.');
    }
  };

  const nativeShare = async () => {
    if (!shareUrl || !navigator.share) return copyLink();
    try {
      await navigator.share({
        title: 'Canvio collaboration board',
        text: 'Join my Canvio board',
        url: shareUrl,
      });
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') {
        setErrorText('System sharing is unavailable. Copy the link instead.');
      }
    }
  };

  return (
    <>
      <button className="share-btn" onClick={() => openShare(isPublic)} title="Share this board" aria-label="Share this board">
        <IconShare size={16} />
        <span>Share</span>
      </button>

      {isOpen && (
        <div className="share-dialog__overlay" role="presentation" onClick={() => setIsOpen(false)}>
          <section
            className="share-dialog"
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="share-dialog__header">
              <div>
                <p className="share-dialog__eyebrow">Live collaboration & Remixing</p>
                <h2 id="share-dialog-title">Invite & Share this World</h2>
              </div>
              <button className="share-dialog__close" onClick={() => setIsOpen(false)} aria-label="Close share dialog" title="Close">
                <IconX size={20} />
              </button>
            </header>

            <label className="share-dialog__field">
              <span>Your name</span>
              <input
                ref={nameInputRef}
                value={name}
                onChange={(event) => saveName(event.target.value)}
                placeholder="Enter your name"
                autoComplete="name"
              />
            </label>

            {status === 'loading' && (
              <div className="share-dialog__loading" role="status">Configuring sharing link...</div>
            )}

            {status === 'error' && (
              <div className="share-dialog__error" role="alert">
                <span>{errorText}</span>
                <button type="button" onClick={() => openShare(isPublic)}>Try again</button>
              </div>
            )}

            {shareUrl && status !== 'loading' && (
              <>
                <div className="share-dialog__field">
                  <span>Link</span>
                  <div className="share-dialog__link-row">
                    <input value={shareUrl} readOnly aria-label="Share link" onFocus={(event) => event.currentTarget.select()} />
                    <button className="share-dialog__icon-action" onClick={nativeShare} aria-label="Share link" title="Share link">
                      <IconShare size={19} />
                    </button>
                    <button className="share-dialog__copy-action" onClick={copyLink}>
                      <IconCopy size={18} />
                      <span>{status === 'copied' ? 'Copied' : 'Copy link'}</span>
                    </button>
                  </div>
                </div>

                <div className="share-dialog__field" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>Public World & Remixing</span>
                    <p style={{ margin: '2px 0 0 0', fontSize: 11, color: 'var(--text-secondary)' }}>Allow anyone to view and fork a clone into their own workspace.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={handleTogglePublic}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                </div>

                <div className="share-dialog__qr-wrap">
                  <img src={qrUrl} alt="QR code for the Canvio collaboration link" />
                </div>

                <div className="share-dialog__privacy">
                  <strong>
                    <span className="material-symbols-outlined" aria-hidden="true">{isPublic ? 'public' : 'lock'}</span>
                    {isPublic ? 'Public & Forkable World' : 'Private link with live sync'}
                  </strong>
                  <p>{isPublic ? 'Anyone with the link can view and fork this world to build upon your mental model.' : 'Only people with this link can join. Board content is not listed publicly.'}</p>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
