export function SectorOptions({ sectors }) {
  return <>{['QUENTE', 'FRIA'].map((category) =>
    <optgroup key={category} label={category === 'QUENTE' ? 'Área Quente' : 'Área Fria'}>
      {sectors.filter((sector) => sector.category === category).map((sector) =>
        <option value={sector.id} key={sector.id}>{sector.name}</option>)}
    </optgroup>)}</>;
}
