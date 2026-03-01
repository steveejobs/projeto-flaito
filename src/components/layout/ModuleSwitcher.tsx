import { useNavigate, useLocation } from 'react-router-dom';
import { useSidebar } from '@/components/ui/sidebar';
import { Scale, Stethoscope } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ModuleSwitcher({ className }: { className?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const isMedical = location.pathname.startsWith('/medical');

  return (
    <div className={cn("px-3 py-2", className)}>
      <div className={cn(
        "flex flex-col sm:flex-row items-stretch sm:items-center rounded-lg overflow-hidden border",
        isMedical ? "border-gray-200 bg-gray-50" : "border-white/10 bg-black/10",
        collapsed ? "flex-col" : "flex-row"
      )}>
        {/* Jurídico tab */}
        <button
          onClick={() => navigate('/dashboard')}
          type="button"
          title="Módulo Jurídico"
          className={cn(
            "flex flex-1 items-center justify-center gap-2 py-2 px-3 text-sm font-semibold transition-all duration-200",
            collapsed && "w-full py-2 px-0",
            !isMedical
              ? "bg-white/15 text-white shadow-inner"
              : "bg-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100"
          )}
        >
          <Scale className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="text-xs truncate">Jurídico</span>}
        </button>

        {/* Divider */}
        {!collapsed && <div className={cn("w-px h-6 shrink-0 hidden sm:block", isMedical ? "bg-gray-200" : "bg-white/10")} />}

        {/* Medicina tab */}
        <button
          onClick={() => navigate('/medical/dashboard')}
          type="button"
          title="Módulo Medicina"
          className={cn(
            "flex flex-1 items-center justify-center gap-2 py-2 px-3 text-sm font-semibold transition-all duration-200",
            collapsed && "w-full py-2 px-0",
            isMedical
              ? "bg-teal-100/50 text-teal-700 shadow-inner"
              : "bg-transparent text-white/50 hover:text-white/80 hover:bg-white/5"
          )}
        >
          <Stethoscope className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="text-xs truncate">Medicina</span>}
        </button>
      </div>
    </div>
  );
}
