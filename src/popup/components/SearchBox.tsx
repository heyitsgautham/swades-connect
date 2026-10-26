interface SearchBoxProps {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  count: number;
}

function SearchBox({ placeholder, value, onChange, count }: SearchBoxProps) {
  return (
    <div className="relative flex items-center gap-2">
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 border border-border px-3 py-2 text-[12px] outline-none"
      />
      <span className="text-[11px] whitespace-nowrap text-muted">
        {count} result{count !== 1 ? 's' : ''}
      </span>
      {value && (
        <button
          onClick={() => onChange('')}
          title="Clear search"
          className="absolute right-[70px] cursor-pointer p-1 text-[14px] text-muted"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export default SearchBox;
