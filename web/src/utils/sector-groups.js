import { Briefcase, Factory, Flame, Package, Snowflake, Truck } from 'lucide-react';

// "Administrativo/Comercial" continua salvo com category FRIA no banco (evita mexer
// nas telas de RH, Dashboard e Indicadores por Setor, que filtram QUENTE/FRIA
// explicitamente) — aqui, só para as telas de totem/chat, ele é separado num grupo
// visual próprio pelo nome, com rótulo e ícone corretos.
export function isAdminSector(name = '') {
  const lower = name.toLowerCase();
  return lower.includes('administrativo') || lower.includes('comercial');
}

const GROUP_META = {
  QUENTE: { label: 'Área Quente', icon: Flame, color: '#d96324' },
  FRIA: { label: 'Área Fria', icon: Snowflake, color: '#2b7bc4' },
  ADMIN: { label: 'Administrativo/Comercial', icon: Briefcase, color: '#8b6fd6' },
};

export function groupSectorsForDisplay(sectors) {
  const admin = sectors.filter((item) => isAdminSector(item.name));
  const quente = sectors.filter((item) => !isAdminSector(item.name) && item.category === 'QUENTE');
  const fria = sectors.filter((item) => !isAdminSector(item.name) && item.category === 'FRIA');
  return [
    { key: 'QUENTE', items: quente, ...GROUP_META.QUENTE },
    { key: 'FRIA', items: fria, ...GROUP_META.FRIA },
    { key: 'ADMIN', items: admin, ...GROUP_META.ADMIN },
  ].filter((group) => group.items.length > 0);
}

export function getSectorIcon(sectorName = '', category = '') {
  if (isAdminSector(sectorName)) return Briefcase;
  const lower = sectorName.toLowerCase();
  if (lower.includes('embalagem')) return Package;
  if (lower.includes('expedição') || lower.includes('expedicao')) return Truck;
  if (category === 'QUENTE' || lower.includes('abate')) return Flame;
  if (category === 'FRIA') return Snowflake;
  return Factory;
}
