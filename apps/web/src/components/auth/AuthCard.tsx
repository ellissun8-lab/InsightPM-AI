interface AuthCardProps {
  children: React.ReactNode;
  maxWidth?: number;
}

export default function AuthCard({ children, maxWidth = 420 }: AuthCardProps) {
  return (
    <div className="w-full" style={{ maxWidth, padding: "0 16px" }}>
      <div
        style={{
          background: "#fffdf8",
          borderRadius: 24,
          padding: 32,
          border: "1px solid #E5DED0",
          boxShadow: "0 8px 32px rgba(23, 21, 17, 0.04)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
