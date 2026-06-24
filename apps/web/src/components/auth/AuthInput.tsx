interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export default function AuthInput({ label, ...props }: AuthInputProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "#4b463f",
          marginLeft: 4,
        }}
      >
        {label}
      </label>
      <input
        style={{
          width: "100%",
          height: 48,
          padding: "0 16px",
          background: "#faf3e4",
          borderRadius: 8,
          border: "1px solid #cdc5bc",
          fontSize: 14,
          color: "#1e1b13",
          outline: "none",
          transition: "all 0.2s",
          boxSizing: "border-box",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "#000000";
          e.currentTarget.style.boxShadow = "0 0 0 2px rgba(0,0,0,0.06)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "#cdc5bc";
          e.currentTarget.style.boxShadow = "none";
        }}
        {...props}
      />
    </div>
  );
}
