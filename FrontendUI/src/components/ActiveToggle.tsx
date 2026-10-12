import React, { useEffect, useState } from 'react';

interface ActiveToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
  name?: string;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  inputRef?: React.Ref<HTMLInputElement>;
}

/**
 * Kaydırmalı aktif/pasif — aktif yeşil (sağ), pasif kırmızı (sol)
 */
export const ActiveToggle: React.FC<ActiveToggleProps> = ({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  showLabel = true,
  className = '',
  name,
  onBlur,
  inputRef,
}) => {
  const trackW = size === 'sm' ? 'w-11' : 'w-[3.25rem]';
  const trackH = size === 'sm' ? 'h-6' : 'h-7';
  const knob = size === 'sm' ? 'h-5 w-5' : 'h-6 w-6';
  const knobOn = size === 'sm' ? 'translate-x-[1.35rem]' : 'translate-x-[1.55rem]';

  return (
    <label
      className={`inline-flex items-center gap-2 select-none ${
        disabled ? 'opacity-55 cursor-not-allowed' : 'cursor-pointer'
      } ${className}`}
    >
      <input
        ref={inputRef}
        type="checkbox"
        className="sr-only"
        name={name}
        checked={checked}
        disabled={disabled}
        onBlur={onBlur}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        className={`relative ${trackW} ${trackH} rounded-full transition-colors duration-200 shadow-inner shrink-0 ${
          checked ? 'bg-emerald-500' : 'bg-red-500'
        }`}
        aria-hidden
      >
        <span
          className={`absolute top-0.5 left-0.5 ${knob} rounded-full bg-white shadow-md transition-transform duration-200 ease-out ${
            checked ? knobOn : 'translate-x-0'
          }`}
        />
      </span>
      {showLabel && (
        <span
          className={`text-[11px] font-semibold min-w-[2.5rem] ${
            checked ? 'text-emerald-600' : 'text-red-600'
          }`}
        >
          {checked ? 'Aktif' : 'Pasif'}
        </span>
      )}
    </label>
  );
};

export const ActiveStatusBadge: React.FC<{
  value: unknown;
  /** Verilmezse veya disabled=true ise sadece gösterim (listelerde) */
  onToggle?: (next: boolean) => void;
  disabled?: boolean;
}> = ({ value, onToggle, disabled = false }) => {
  const readOnly = disabled || !onToggle;
  return (
    <ActiveToggle
      checked={isActiveValue(value)}
      onChange={(next) => {
        if (!readOnly) onToggle?.(next);
      }}
      disabled={readOnly}
      size="sm"
      showLabel
    />
  );
};

/** RHF register ile bağlanan aktif toggle */
export const ActiveToggleField: React.FC<{
  registerReturn: {
    name: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
    ref: React.Ref<HTMLInputElement>;
  };
  disabled?: boolean;
  size?: 'sm' | 'md';
  defaultOn?: boolean;
}> = ({ registerReturn, disabled, size = 'md', defaultOn = true }) => {
  const [on, setOn] = useState(defaultOn);

  useEffect(() => {
    // form reset / defaultValues sonrası DOM ile senkron
    const el =
      typeof registerReturn.ref === 'function'
        ? null
        : (registerReturn.ref as React.RefObject<HTMLInputElement> | null)?.current;
    if (el) setOn(el.checked);
  }, [registerReturn.ref]);

  return (
    <ActiveToggle
      checked={on}
      disabled={disabled}
      size={size}
      showLabel
      name={registerReturn.name}
      onBlur={registerReturn.onBlur}
      inputRef={registerReturn.ref}
      onChange={(next) => {
        setOn(next);
        const synthetic = {
          target: { name: registerReturn.name, checked: next, type: 'checkbox', value: next ? 'on' : '' },
          currentTarget: { name: registerReturn.name, checked: next, type: 'checkbox', value: next ? 'on' : '' },
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        registerReturn.onChange(synthetic);
      }}
    />
  );
};

export function isActiveValue(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null || value === '') return false;
  const s = String(value).trim().toLocaleLowerCase('tr-TR');
  if (['aktif', 'active', 'true', '1', 'evet', 'yes'].includes(s)) return true;
  if (['pasif', 'passive', 'inactive', 'false', '0', 'hayır', 'no'].includes(s)) return false;
  return Boolean(value);
}

export function isActiveToggleField(fieldName: string, label: string): boolean {
  const n = fieldName.toLowerCase();
  if (n === 'isactive' || n === 'active') return true;
  if (n === 'status' && /aktif/i.test(label)) return true;
  if (/^aktif(\s|$)/i.test(label.trim())) return true;
  return false;
}
