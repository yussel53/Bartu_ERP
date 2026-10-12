/** Chart.js CDN loader (npm yoksa da çalışır) */

type ChartCtor = new (
  ctx: CanvasRenderingContext2D | HTMLCanvasElement,
  config: unknown,
) => { destroy: () => void };

declare global {
  interface Window {
    Chart?: ChartCtor;
  }
}

let loading: Promise<ChartCtor> | null = null;

export function loadChartJs(): Promise<ChartCtor> {
  if (typeof window !== 'undefined' && window.Chart) {
    return Promise.resolve(window.Chart);
  }
  if (loading) return loading;

  loading = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-bartu-chartjs]');
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.Chart) resolve(window.Chart);
        else reject(new Error('Chart.js yüklenemedi'));
      });
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.6/dist/chart.umd.min.js';
    s.async = true;
    s.dataset.bartuChartjs = '1';
    s.onload = () => {
      if (window.Chart) resolve(window.Chart);
      else reject(new Error('Chart.js global bulunamadı'));
    };
    s.onerror = () => reject(new Error('Chart.js CDN yüklenemedi'));
    document.head.appendChild(s);
  });

  return loading;
}
