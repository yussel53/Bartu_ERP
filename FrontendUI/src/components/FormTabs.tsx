import React from 'react';

export interface FormTabItem {
  id: string;
  label: string;
  count?: number;
}

interface FormTabsProps {
  tabs: FormTabItem[];
  active: string;
  onChange: (id: string) => void;
  /** sm: daha sıkı; pill: yuvarlak seçim */
  variant?: 'underline' | 'pill' | 'segment';
  size?: 'sm' | 'md';
  /** Alt boşluk / border yok (iç içe kullanım) */
  flush?: boolean;
  className?: string;
}

export const FormTabs: React.FC<FormTabsProps> = ({
  tabs,
  active,
  onChange,
  variant = 'underline',
  size = 'md',
  flush = false,
  className = '',
}) => {
  const h = size === 'sm' ? 'h-7' : 'h-8';
  const text = size === 'sm' ? 'text-[11px]' : 'text-[12px]';

  if (variant === 'segment') {
    return (
      <div
        className={`inline-flex items-center rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/60 p-0.5 gap-0.5 ${className}`}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`${h} px-2.5 ${text} font-semibold rounded transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span className="ml-1 text-[10px] font-bold text-slate-400">{tab.count}</span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === 'pill') {
    return (
      <div className={`flex flex-wrap items-center gap-1 ${flush ? '' : 'mb-2'} ${className}`}>
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`${h} px-2.5 ${text} font-medium rounded-full transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-0.5 overflow-x-auto ${
        flush ? '' : 'border-b border-slate-200 dark:border-slate-700 mb-2'
      } ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`px-2.5 ${h} ${text} font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0 ${
              isActive
                ? 'border-blue-600 text-blue-700 dark:text-blue-300'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span className="ml-1 text-[10px] font-bold text-slate-400">{tab.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};
