import React from 'react';
import { ModuleParamsPage } from './ModuleParamsPage';

/** Geriye uyumluluk — Kasa artık ModuleParamsPage */
export const KasaParamsPage: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <ModuleParamsPage moduleKey="kasa" onBack={onBack} />
);
