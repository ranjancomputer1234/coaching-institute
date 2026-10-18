import { X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

type ContentDrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** `panel` = narrow detail sheet; `full` = entire area right of the sidebar */
  size?: 'panel' | 'full';
  children: React.ReactNode;
};

export function ContentDrawer({
  open,
  onClose,
  title,
  size = 'panel',
  children,
}: ContentDrawerProps) {
  useEffect(() => {
    if (!open) return;

    const syncInset = () => {
      const collapsed = document.querySelector('.app-shell')?.classList.contains('is-collapsed');
      document.documentElement.style.setProperty(
        '--content-drawer-left',
        collapsed ? 'var(--sidebar-rail)' : 'var(--sidebar-w)',
      );
    };
    syncInset();
    window.addEventListener('resize', syncInset);

    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', syncInset);
      document.documentElement.style.removeProperty('--content-drawer-left');
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <>
      <button
        type="button"
        className="content-drawer-scrim"
        aria-label="Close panel"
        onClick={onClose}
      />
      <div
        className={`content-drawer ${size === 'full' ? 'is-full' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="content-drawer-title"
      >
        <header className="content-drawer-head">
          <h2 id="content-drawer-title">{title}</h2>
          <button type="button" className="icon-btn bordered" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="content-drawer-body">{children}</div>
      </div>
    </>,
    document.body,
  );
}
