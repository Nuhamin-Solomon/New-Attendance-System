import Icon from "./Icon";

export default function SearchBar({ value, onChange, placeholder = "Search by name, ID, or department", style }) {
  return (
    <label className="search-bar" style={style}>
      <Icon name="search" size={16} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}
