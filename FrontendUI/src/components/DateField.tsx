import React from 'react';
import {
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
  FieldValues,
} from 'react-hook-form';
import { Calendar } from 'lucide-react';
import {
  getSystemDatePlaceholder,
  displayToIso,
  isoToDisplay,
  subscribeDateFormat,
} from '../utils/dateFormat';
import { blockMinusKeyDown, stripMinusChars } from '../utils/noMinusInput';

interface DateFieldProps {
  label: string;
  registerName: string;
  register: UseFormRegister<FieldValues>;
  setValue?: UseFormSetValue<FieldValues>;
  watch?: UseFormWatch<FieldValues>;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  inputClassName?: string;
  title?: string;
}

/**
 * Tarih alanı: ekranda sistem formatı dd.MM.yyyy, form değeri yyyy-MM-dd.
 * Native type=date tarayıcı/OS diline (MM/dd/yyyy) bağlı kaldığı için kullanılmaz.
 */
export const DateField: React.FC<DateFieldProps> = ({
  label,
  registerName,
  register,
  setValue,
  watch,
  required = false,
  disabled = false,
  placeholder,
  inputClassName = '',
  title,
}) => {
  const raw = watch ? watch(registerName) : undefined;
  const isoValue = raw == null || raw === '' ? '' : String(raw).slice(0, 10);
  const [text, setText] = React.useState(() => isoToDisplay(isoValue));
  const [ph, setPh] = React.useState(() => getSystemDatePlaceholder());
  const pickerRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    return subscribeDateFormat(() => {
      setPh(getSystemDatePlaceholder());
      setText(isoToDisplay(isoValue));
    });
  }, [isoValue]);

  React.useEffect(() => {
    setText(isoToDisplay(isoValue));
  }, [isoValue]);

  const commitIso = (iso: string) => {
    setValue?.(registerName, iso, { shouldDirty: true, shouldValidate: true });
    setText(isoToDisplay(iso));
  };

  const onBlur = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      commitIso('');
      return;
    }
    const iso = displayToIso(trimmed);
    if (iso === null) {
      setText(isoToDisplay(isoValue));
      return;
    }
    if (iso === '') {
      commitIso('');
      return;
    }
    commitIso(iso);
  };

  const onTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(stripMinusChars(e.target.value));
  };

  const openPicker = () => {
    if (disabled) return;
    const el = pickerRef.current;
    if (!el) return;
    try {
      el.showPicker?.();
    } catch {
      el.click();
    }
  };

  const pickerValue = /^\d{4}-\d{2}-\d{2}$/.test(isoValue) ? isoValue : '';

  return (
    <div className="relative w-full min-w-0">
      <input
        type="hidden"
        {...register(registerName, { required: required && !disabled })}
      />
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        value={text}
        onChange={onTextChange}
        onKeyDown={blockMinusKeyDown}
        onBlur={onBlur}
        placeholder={placeholder ?? ph}
        title={title ?? `${label} (${ph})`}
        aria-label={label}
        className={`${inputClassName} pr-8`}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        onClick={openPicker}
        className="absolute right-0.5 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-blue-600 disabled:opacity-40"
        title="Takvim"
        aria-label="Takvim"
      >
        <Calendar className="w-3.5 h-3.5" />
      </button>
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        disabled={disabled}
        value={pickerValue}
        onChange={(e) => commitIso(e.target.value || '')}
        className="sr-only"
        aria-hidden
      />
    </div>
  );
};
