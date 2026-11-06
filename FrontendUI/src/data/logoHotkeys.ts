/** Logo tarzı klavye kısayolları — F1 yardım listesi + uygulama eşlemesi */

export interface LogoHotkeyDef {
  keys: string;
  label: string;
  scope: 'global' | 'document' | 'list' | 'field';
  /** Uygulamada bağlı mı */
  status: 'active' | 'partial' | 'planned';
}

export const LOGO_HOTKEYS: LogoHotkeyDef[] = [
  { keys: 'F1', label: 'Yardım (bu liste)', scope: 'global', status: 'active' },
  { keys: 'F2', label: 'Kaydet / işlemi başlat', scope: 'document', status: 'active' },
  { keys: 'Ctrl+F2', label: 'Taslak olarak sakla (Tamamlanmamış kayıtlar)', scope: 'document', status: 'active' },
  { keys: 'F3', label: 'Vazgeç (kaydetmeden çık)', scope: 'document', status: 'active' },
  { keys: 'F5', label: 'Cari ↔ satır alanı arasında geçiş', scope: 'document', status: 'active' },
  { keys: 'F6', label: 'Hızlı giriş (Excel yapıştır)', scope: 'document', status: 'active' },
  { keys: 'F7', label: 'Önizleme / yazdır', scope: 'document', status: 'active' },
  { keys: 'F9', label: 'Belge işlemleri menüsü (⋯)', scope: 'document', status: 'active' },
  { keys: 'F10', label: 'Liste / lookup aç (kod alanları)', scope: 'field', status: 'active' },
  { keys: 'F11', label: 'Kolon ayarları', scope: 'document', status: 'active' },
  { keys: 'F12', label: 'Excel’e aktarım / hızlı yapıştır', scope: 'document', status: 'partial' },
  { keys: 'Alt+5', label: 'Ek indirimler (satır)', scope: 'document', status: 'active' },
  { keys: 'Alt+Enter', label: 'Kalem gridini büyüt / küçült', scope: 'document', status: 'active' },
  { keys: 'Alt+F7', label: 'İndirim / masraf gruplama', scope: 'document', status: 'planned' },
  { keys: 'Ctrl+PgUp / Ctrl+PgDn', label: 'Detay sekmeleri arası gezin', scope: 'document', status: 'active' },
  { keys: 'Shift+Insert', label: 'Satır ekle', scope: 'document', status: 'active' },
  { keys: 'Shift+Del', label: 'Satır sil', scope: 'document', status: 'active' },
  { keys: 'Ctrl+Enter', label: 'Bir alt satıra geç / yeni satır', scope: 'document', status: 'active' },
  { keys: 'Ctrl+F', label: 'Listede ara', scope: 'list', status: 'active' },
  { keys: 'Ctrl+A', label: 'Listede tümünü seç', scope: 'list', status: 'planned' },
  { keys: 'Ctrl+L', label: 'Uygulamayı kilitle', scope: 'global', status: 'active' },
  { keys: 'Shift+F10', label: 'Sık kullanılan metinler', scope: 'global', status: 'planned' },
  { keys: 'Alt+F4', label: 'Programı kapat', scope: 'global', status: 'active' },
  { keys: 'Home / End', label: 'İlk / son kayıt (liste)', scope: 'list', status: 'partial' },
  { keys: 'Tab / Shift+Tab', label: 'Sonraki / önceki alan', scope: 'field', status: 'active' },
];
