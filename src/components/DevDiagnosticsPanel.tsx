import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OfficeSessionData {
  ready: boolean;
  loading: boolean;
  error: string | null;
  officeId: string | null;
}

interface DevDiagnosticsPanelProps {
  pathname: string;
  userId: string | null;
  authLoading: boolean;
  officeSession?: OfficeSessionData;
  renderCount?: number;
}

/**
 * DEV-only diagnostics panel to help identify loading gates.
 * Only renders in development mode.
 */
export function DevDiagnosticsPanel(props: DevDiagnosticsPanelProps) {
  // Only render in DEV
  if (!import.meta.env.DEV) return null;

  return <DevDiagnosticsPanelInner {...props} />;
}

function DevDiagnosticsPanelInner({
  pathname,
  userId,
  authLoading,
  officeSession,
  renderCount: externalRenderCount,
}: DevDiagnosticsPanelProps) {
  const localRenderCountRef = useRef(0);
  const [collapsed, setCollapsed] = useState(true);
  const [, forceUpdate] = useState(0);

  // Auth session from supabase (DEV-only polling)
  const [supabaseSession, setSupabaseSession] = useState<{
    hasSession: boolean;
    userId: string | null;
  }>({ hasSession: false, userId: null });

  localRenderCountRef.current += 1;

  // Poll supabase session and sessionStorage every second
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const { data } = await supabase.auth.getSession();
        setSupabaseSession({
          hasSession: !!data.session,
          userId: data.session?.user?.id ?? null,
        });
      } catch {
        // Ignore errors in polling
      }
      forceUpdate((v) => v + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Read storage fresh each render (not useState init)
  const storageChecked = sessionStorage.getItem('lexos_office_checked') ?? 'null';
  const storageOfficeId = sessionStorage.getItem('lexos_office_id') ?? 'null';
  const trace = sessionStorage.getItem('lexos_office_trace') ?? 'null';

  const renderCount = externalRenderCount ?? localRenderCountRef.current;

  return (
    <div
      className="fixed bottom-2 left-2 z-[9999] bg-black/90 text-green-400 font-mono text-[10px] rounded shadow-lg max-w-xs"
      style={{ backdropFilter: 'blur(4px)' }}
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-2 py-1 text-left hover:bg-white/10 flex items-center justify-between"
      >
        <span>🔧 DEV DIAGNOSTICS</span>
        <span>{collapsed ? '▸' : '▾'}</span>
      </button>

      {!collapsed && (
        <div className="px-2 pb-2 space-y-2 border-t border-green-800">
          {/* ROUTE & RENDER */}
          <div className="border-b border-green-900 pb-1">
            <div className="text-gray-500 text-[9px] uppercase mb-0.5">Route</div>
            <div>
              <span className="text-gray-400">pathname:</span> {pathname}
            </div>
            <div>
              <span className="text-gray-400">renderCount:</span> {renderCount}
            </div>
          </div>

          {/* AUTH CONTEXT */}
          <div className="border-b border-green-900 pb-1">
            <div className="text-gray-500 text-[9px] uppercase mb-0.5">Auth Context</div>
            <div>
              <span className="text-gray-400">userId:</span>{' '}
              {userId ?? <span className="text-red-400">null</span>}
            </div>
            <div>
              <span className="text-gray-400">authLoading:</span>{' '}
              {authLoading ? <span className="text-yellow-400">true</span> : 'false'}
            </div>
          </div>

          {/* HOOK: officeSession */}
          <div className="border-b border-green-900 pb-1">
            <div className="text-gray-500 text-[9px] uppercase mb-0.5">Hook: officeSession</div>
            {officeSession ? (
              <>
                <div>
                  <span className="text-gray-400">ready:</span>{' '}
                  {officeSession.ready ? (
                    <span className="text-green-300">true</span>
                  ) : (
                    <span className="text-red-400">false</span>
                  )}
                </div>
                <div>
                  <span className="text-gray-400">loading:</span>{' '}
                  {officeSession.loading ? (
                    <span className="text-yellow-400">true</span>
                  ) : (
                    'false'
                  )}
                </div>
                <div>
                  <span className="text-gray-400">officeId:</span>{' '}
                  {officeSession.officeId ?? <span className="text-red-400">null</span>}
                </div>
                <div>
                  <span className="text-gray-400">error:</span>{' '}
                  {officeSession.error ? (
                    <span className="text-red-400">{officeSession.error}</span>
                  ) : (
                    'null'
                  )}
                </div>
              </>
            ) : (
              <div className="text-red-400">officeSession: MISSING</div>
            )}
          </div>

          {/* STORAGE */}
          <div className="border-b border-green-900 pb-1">
            <div className="text-gray-500 text-[9px] uppercase mb-0.5">SessionStorage</div>
            <div>
              <span className="text-gray-400">lexos_office_checked:</span>{' '}
              {storageChecked === 'true' ? (
                <span className="text-green-300">{storageChecked}</span>
              ) : (
                <span className="text-red-400">{storageChecked}</span>
              )}
            </div>
            <div>
              <span className="text-gray-400">lexos_office_id:</span>{' '}
              {storageOfficeId !== 'null' ? (
                <span className="text-green-300">{storageOfficeId}</span>
              ) : (
                <span className="text-red-400">{storageOfficeId}</span>
              )}
            </div>
            <div>
              <span className="text-gray-400">trace:</span>{' '}
              <span className={trace === 'null' ? 'text-red-400' : 'text-green-300'}>{trace}</span>
            </div>
          </div>

          {/* SUPABASE AUTH (polled) */}
          <div>
            <div className="text-gray-500 text-[9px] uppercase mb-0.5">Supabase Auth (polled)</div>
            <div>
              <span className="text-gray-400">hasSession:</span>{' '}
              {supabaseSession.hasSession ? (
                <span className="text-green-300">true</span>
              ) : (
                <span className="text-red-400">false</span>
              )}
            </div>
            <div>
              <span className="text-gray-400">session.userId:</span>{' '}
              {supabaseSession.userId ?? <span className="text-red-400">null</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
