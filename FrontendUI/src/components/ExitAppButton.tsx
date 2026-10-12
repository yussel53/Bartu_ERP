import React from 'react';
import { LogOut } from 'lucide-react';
import { exitApp } from '../utils/exitApp';

interface Props {
  className?: string;
  /** compact: sadece ikon */
  compact?: boolean;
  label?: string;
}

export const ExitAppButton: React.FC<Props> = ({
  className = '',
  compact = false,
  label = 'Çıkış',
}) => (
  <button
    type="button"
    onClick={() => exitApp()}
    title="Programdan çık"
    className={
      className ||
      (compact
        ? 'inline-flex items-center justify-center p-1.5 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors'
        : 'inline-flex items-center gap-1.5 px-2.5 h-8 rounded-md text-[12px] font-semibold text-slate-600 border border-slate-200 bg-white hover:border-red-200 hover:text-red-700 hover:bg-red-50 transition-colors')
    }
  >
    <LogOut className={compact ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
    {!compact && <span>{label}</span>}
  </button>
);
