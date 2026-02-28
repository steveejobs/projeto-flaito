import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';

const BRASILIA_TZ = 'America/Sao_Paulo';

export function LegalClock() {
  const [now, setNow] = useState(() => toZonedTime(new Date(), BRASILIA_TZ));

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(toZonedTime(new Date(), BRASILIA_TZ));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Formato completo para telas grandes
  const fullDate = format(now, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
  const capitalizedDate = fullDate.charAt(0).toUpperCase() + fullDate.slice(1);
  const time = format(now, 'HH:mm:ss', { locale: ptBR });

  // Formato compacto para mobile
  const shortDate = format(now, "EEE, dd/MM/yyyy", { locale: ptBR });
  const capitalizedShortDate = shortDate.charAt(0).toUpperCase() + shortDate.slice(1);

  return (
    <div className="flex items-center gap-2.5 text-muted-foreground font-light tracking-wide">
      <Clock className="h-4 w-4 opacity-60" />
      
      {/* Versão compacta (mobile/tablet) */}
      <div className="flex items-center gap-2 lg:hidden text-sm">
        <span className="capitalize">{capitalizedShortDate}</span>
        <span className="text-primary/60">·</span>
        <span className="tabular-nums font-medium text-foreground">{time}</span>
        <span className="text-[10px] text-muted-foreground/60 uppercase tracking-widest">BRT</span>
      </div>

      {/* Versão completa (desktop) */}
      <div className="hidden lg:flex items-center gap-2 text-sm">
        <span className="capitalize">{capitalizedDate}</span>
        <span className="text-primary/60">·</span>
        <span className="tabular-nums font-medium text-foreground">{time}</span>
        <span className="text-[10px] text-muted-foreground/60 uppercase tracking-widest">BRT</span>
      </div>
    </div>
  );
}
