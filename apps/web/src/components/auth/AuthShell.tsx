import { type LucideIcon } from "lucide-react";

interface Feature {
  label: string;
  desc: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
}

interface AuthShellProps {
  children: React.ReactNode;
  heroTitle: React.ReactNode;
  heroDescription: string;
  features: Feature[];
  logoIcon: LucideIcon;
  /** Use flat surface-container-low background instead of brand-gradient + dotted-grid */
  flatBg?: boolean;
  /** Show logo icon inside a colored box (login style) or inline next to title (signup style) */
  logoInBox?: boolean;
}

export default function AuthShell({
  children,
  heroTitle,
  heroDescription,
  features,
  logoIcon: LogoIcon,
  flatBg = false,
  logoInBox = true,
}: AuthShellProps) {
  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Inter', sans-serif", background: "#F7F3EA" }}>
      {/* Left Side: Brand Panel */}
      <section
        className="hidden lg:flex flex-col justify-between relative overflow-hidden"
        style={{
          width: "42%",
          background: flatBg
            ? "#faf3e4"
            : "linear-gradient(135deg, #faf3e4 0%, #e8e0d0 100%)",
          padding: "40px",
          borderRight: "1px solid #E5DED0",
        }}
      >
        {/* Dotted grid background — login only */}
        {!flatBg && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(#b5ad9e 0.5px, transparent 0.5px)",
              backgroundSize: "24px 24px",
              opacity: 0.1,
            }}
          />
        )}
        {/* Decorative blurs */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: "-10%",
            right: "-10%",
            width: 384,
            height: 384,
            background: flatBg ? "rgba(160,155,140,0.12)" : "rgba(160,155,140,0.08)",
            borderRadius: "50%",
            filter: "blur(100px)",
          }}
        />
        {flatBg && (
          <div
            className="absolute pointer-events-none"
            style={{
              top: "50%",
              right: "-5%",
              width: 256,
              height: 256,
              background: "rgba(180,170,150,0.08)",
              borderRadius: "50%",
              filter: "blur(80px)",
            }}
          />
        )}

        {/* Top: Logo */}
        <div className="relative z-10">
          <div className="flex items-center" style={{ gap: 8, marginBottom: 32 }}>
            {logoInBox ? (
              <div
                style={{
                  width: 40,
                  height: 40,
                  background: "#000000",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                }}
              >
                <LogoIcon size={24} color="#ffffff" strokeWidth={2} />
              </div>
            ) : (
              <LogoIcon size={32} style={{ color: "#000000" }} strokeWidth={2} fill="currentColor" />
            )}
            <div>
              <h1
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  color: "#000000",
                  lineHeight: 1.2,
                }}
                className="font-headline-sm"
              >
                ProofLoop
              </h1>
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.2em",
                  color: "#4b463f",
                  textTransform: "uppercase",
                }}
              >
                AI 反馈分析引擎
              </p>
            </div>
          </div>
        </div>

        {/* Middle: Hero content */}
        <div className="relative z-10" style={{ maxWidth: 448, marginTop: 48 }}>
          <h2
            style={{
              fontSize: 40,
              lineHeight: 1.2,
              fontWeight: 800,
              color: "#1e1b13",
              marginBottom: 24,
            }}
          >
            {heroTitle}
          </h2>
          <p
            style={{
              fontSize: 16,
              lineHeight: "28px",
              color: "#4b463f",
              marginBottom: 32,
            }}
          >
            {heroDescription}
          </p>

          {/* Feature list */}
          <ul style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <li key={i} className="flex items-start" style={{ gap: 16 }}>
                  <div
                    style={{
                      marginTop: 4,
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: f.iconBg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={20} style={{ color: f.iconColor }} strokeWidth={2} />
                  </div>
                  <div>
                    <h4 style={{ fontWeight: 700, color: "#1e1b13", fontSize: 14, lineHeight: "20px" }}>
                      {f.label}
                    </h4>
                    <p style={{ fontSize: 14, color: "#4b463f", lineHeight: "22px" }}>
                      {f.desc}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Bottom: Footer */}
        <div className="relative z-10" style={{ fontSize: 12, color: "#7c766e" }}>
          © 2024 ProofLoop Systems. All rights reserved.
        </div>
      </section>

      {/* Right Side: Form */}
      <section
        className="flex-1 flex items-center justify-center relative"
        style={{ background: "#fff9ee" }}
      >
        {children}
      </section>
    </div>
  );
}
