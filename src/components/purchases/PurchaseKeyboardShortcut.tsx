'use client';

import { useEffect } from 'react';

interface PurchaseKeyboardShortcutProps {
  onSave: () => void;
}

export function PurchaseKeyboardShortcut({ onSave }: PurchaseKeyboardShortcutProps) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'F10') {
        event.preventDefault();
        onSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onSave]);

  return null;
}
