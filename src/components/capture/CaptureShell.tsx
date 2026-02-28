import React from "react";
import { cn } from "@/lib/utils";
import { Shield } from "lucide-react";
import oziresLogo from "@/assets/ozires-logo.png";

interface OfficeBranding {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
}

interface CaptureShellProps {
  office: OfficeBranding | null;
  children: React.ReactNode;
  loading?: boolean;
}

export function CaptureShell({ office, children, loading }: CaptureShellProps) {
  const primaryColor = office?.primary_color || "#D4AF37";
  const secondaryColor = office?.secondary_color || "#9CA3AF";

  return (
    <div
      className="min-h-screen flex flex-col justify-start md:justify-center p-0 md:p-4"
      style={
        {
          background: "linear-gradient(180deg, #0a0a0a 0%, #121212 50%, #0a0a0a 100%)",
          "--brand-primary": primaryColor,
          "--brand-secondary": secondaryColor,
        } as React.CSSProperties
      }
    >
      {/* Subtle radial overlay for depth */}
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.04) 0%, transparent 60%)`,
          }}
        />
      </div>

      <div className="relative z-10 w-full md:max-w-lg md:mx-auto">
        {/* Card */}
        <div className="bg-black/60 backdrop-blur-md border-0 md:border border-white/[0.08] rounded-none md:rounded-2xl shadow-2xl overflow-hidden min-h-screen md:min-h-0">
          {/* Header institucional premium */}
          <div className="p-6 pb-4">
            <div className="flex items-center gap-4">
              {/* Logo fixa do escritório */}
              <div className="relative shrink-0">
                <div className="relative p-2 rounded-xl bg-white/10 backdrop-blur-sm">
                  <img
                    src={oziresLogo}
                    alt={office?.name || "Logo"}
                    className="h-16 md:h-20 w-auto object-contain"
                  />
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                {loading ? (
                  <div className="space-y-2">
                    <div className="h-5 w-36 bg-white/10 rounded animate-pulse" />
                    <div className="h-3 w-48 bg-white/5 rounded animate-pulse" />
                  </div>
                ) : office ? (
                  <>
                    <h1 className="text-xl font-semibold text-white truncate tracking-tight">
                      {office.name}
                    </h1>
                    {/* Subtítulo institucional fixo */}
                    <p className="text-sm text-white/50 mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80" />
                        Cadastro seguro
                      </span>
                      <span className="text-white/20">•</span>
                      <span>Sigilo profissional</span>
                      <span className="text-white/20">•</span>
                      <span>LGPD</span>
                    </p>
                  </>
                ) : (
                  <>
                    <h1 className="text-xl font-semibold text-white">
                      Cadastro de Cliente
                    </h1>
                    <p className="text-sm text-white/50 mt-1">
                      Cadastro seguro • Sigilo profissional • LGPD
                    </p>
                  </>
                )}
              </div>
            </div>
            
            {/* Linha divisória sutil */}
            <div className="mt-4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>

          {/* Content */}
          <div className={cn("p-6 pt-2", loading && "pointer-events-none")}>
            {children}
          </div>
        </div>

        {/* Footer com mensagem de confiança */}
        <p className="text-center text-sm text-white/30 py-4 md:mt-4 md:py-0 flex flex-col items-center gap-1.5">
          <span className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400/60" />
            Seus dados são protegidos por sigilo profissional e criptografia
          </span>
        </p>
      </div>
    </div>
  );
}
