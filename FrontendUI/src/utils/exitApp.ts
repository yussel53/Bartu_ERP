/** Programdan çıkış — pencereyi kapatmayı dener; tarayıcı engellerse boş sayfaya geçer */
export function exitApp(confirmMessage = 'Programdan çıkmak istiyor musunuz?'): void {
  if (typeof window === 'undefined') return;
  if (confirmMessage && !window.confirm(confirmMessage)) return;

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
