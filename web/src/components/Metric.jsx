export function Metric({ icon: Icon, label, value, note, tone }) {
  return <article className={`metric ${tone}`}><span><Icon /></span><div>
    <small>{label}</small><strong>{value}</strong><p>{note}</p>
  </div></article>;
}
