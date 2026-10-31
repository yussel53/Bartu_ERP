import { appConfirm } from './appConfirm';

/** Programdan çıkış — pencereyi kapatmayı dener; tarayıcı engellerse boş sayfaya geçer */
export async function exitApp(confirmMessage = 'Programdan çıkmak istiyor musunuz?'): Promise<void> {
  if (typeof window === 'undefined') return;
  if (confirmMessage && !(await appConfirm(confirmMessage, { title: 'Çıkış', okLabel: 'Çık' }))) return;

  try {
    window.close();
  } catch {
    /* ignore */
  }

  window.setTimeout(() => {
    try {
      if (!window.closed) {
        window.location.replace('about:blank');
      }
    } catch {
      window.location.href = 'about:blank';
    }
  }, 150);
}
