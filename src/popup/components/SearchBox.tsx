interface SearchBoxProps {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  count: number;
}

function SearchBox({ placeholder, value, onChange, count }: SearchBoxProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      position: 'relative',
    }}>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          flex: 1,
          padding: '8px 12px',
          border: '1px solid var(--color-border)',
          borderRadius: '0px',
          fontSize: '12px',
          outline: 'none',
          fontFamily: 'inherit',
        }}
      />
      <span style={{
        fontSize: '11px',
        color: 'var(--color-text-secondary)',
        whiteSpace: 'nowrap',
      }}>
        {count} result{count !== 1 ? 's' : ''}
      </span>
      {value && (
        <button
          onClick={() => onChange('')}
          title="Clear search"
          style={{
            position: 'absolute',
            right: '70px',
            background: 'none',
            border: 'none',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            padding: '4px',
            fontSize: '14px',
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

export default SearchBox;
