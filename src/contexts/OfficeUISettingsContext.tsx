import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOfficeSession } from '@/hooks/useOfficeSession';
import { useAuth } from '@/contexts/AuthContext';

// Types
export interface OfficeUISettings {
  ui_font: 'inter' | 'ibm_plex_sans' | 'source_sans_3';
  ui_scale: number;
  ui_density: 'compact' | 'normal' | 'comfortable';
  accent: 'gold' | 'silver' | 'blue';
  sidebar_logo_scale: number;
}

interface OfficeUISettingsContextValue {
  settings: OfficeUISettings;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateSettings: (newSettings: Partial<OfficeUISettings>) => Promise<boolean>;
}

// Defaults that match the current approved visual
const DEFAULT_SETTINGS: OfficeUISettings = {
  ui_font: 'inter',
  ui_scale: 1.0,
  ui_density: 'normal',
  accent: 'gold',
  sidebar_logo_scale: 1.0,
};

// Font family mapping
const FONT_MAP: Record<OfficeUISettings['ui_font'], string> = {
  inter: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  ibm_plex_sans: "'IBM Plex Sans', system-ui, -apple-system, sans-serif",
  source_sans_3: "'Source Sans 3', system-ui, -apple-system, sans-serif",
};

// Accent color mapping (HSL values)
const ACCENT_MAP: Record<OfficeUISettings['accent'], string> = {
  gold: '45 93% 47%',      // Dourado atual
  silver: '210 10% 60%',   // Prateado
  blue: '221 83% 53%',     // Azul primário
};

// Density mapping (base spacing multiplier)
const DENSITY_MAP: Record<OfficeUISettings['ui_density'], string> = {
  compact: '0.875',
  normal: '1',
  comfortable: '1.125',
};

const OfficeUISettingsContext = createContext<OfficeUISettingsContextValue | null>(null);

export function OfficeUISettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const officeSession = useOfficeSession(user?.id ?? null);
  const officeId = officeSession.officeId;
  
  const [settings, setSettings] = useState<OfficeUISettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Apply CSS variables to document root
  const applySettings = useCallback((s: OfficeUISettings) => {
    const root = document.documentElement;
    
    // Font family
    root.style.setProperty('--font-sans', FONT_MAP[s.ui_font]);
    
    // UI Scale (affects base font size)
    root.style.setProperty('--ui-scale', String(s.ui_scale));
    
    // Density multiplier
    root.style.setProperty('--ui-density', DENSITY_MAP[s.ui_density]);
    
    // Accent color
    root.style.setProperty('--accent-color', ACCENT_MAP[s.accent]);
    
    // Sidebar logo scale
    root.style.setProperty('--sidebar-logo-scale', String(s.sidebar_logo_scale));
  }, []);

  // Fetch settings from database
  const fetchSettings = useCallback(async () => {
    if (!officeId) {
      setSettings(DEFAULT_SETTINGS);
      applySettings(DEFAULT_SETTINGS);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .rpc('get_office_ui_settings', { p_office_id: officeId });

      if (fetchError) {
        console.error('[OfficeUISettings] Fetch error:', fetchError);
        setError(fetchError.message);
        setSettings(DEFAULT_SETTINGS);
        applySettings(DEFAULT_SETTINGS);
      } else if (data && data.length > 0) {
        const row = data[0];
        const loadedSettings: OfficeUISettings = {
          ui_font: row.ui_font as OfficeUISettings['ui_font'],
          ui_scale: Number(row.ui_scale),
          ui_density: row.ui_density as OfficeUISettings['ui_density'],
          accent: row.accent as OfficeUISettings['accent'],
          sidebar_logo_scale: Number(row.sidebar_logo_scale),
        };
        setSettings(loadedSettings);
        applySettings(loadedSettings);
      } else {
        // No settings found, use defaults
        setSettings(DEFAULT_SETTINGS);
        applySettings(DEFAULT_SETTINGS);
      }
    } catch (err) {
      console.error('[OfficeUISettings] Unexpected error:', err);
      setError('Erro ao carregar configurações');
      setSettings(DEFAULT_SETTINGS);
      applySettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  }, [officeId, applySettings]);

  // Update settings in database
  const updateSettings = useCallback(async (newSettings: Partial<OfficeUISettings>): Promise<boolean> => {
    if (!officeId) return false;

    const merged = { ...settings, ...newSettings };

    try {
      const { error: updateError } = await supabase
        .from('office_ui_settings')
        .upsert({
          office_id: officeId,
          ui_font: merged.ui_font,
          ui_scale: merged.ui_scale,
          ui_density: merged.ui_density,
          accent: merged.accent,
          sidebar_logo_scale: merged.sidebar_logo_scale,
        }, { onConflict: 'office_id' });

      if (updateError) {
        console.error('[OfficeUISettings] Update error:', updateError);
        return false;
      }

      setSettings(merged);
      applySettings(merged);
      return true;
    } catch (err) {
      console.error('[OfficeUISettings] Unexpected update error:', err);
      return false;
    }
  }, [officeId, settings, applySettings]);

  // Fetch on mount and when officeId changes
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Apply defaults immediately on mount (before fetch completes)
  useEffect(() => {
    applySettings(DEFAULT_SETTINGS);
  }, [applySettings]);

  return (
    <OfficeUISettingsContext.Provider value={{ 
      settings, 
      loading, 
      error, 
      refetch: fetchSettings,
      updateSettings 
    }}>
      {children}
    </OfficeUISettingsContext.Provider>
  );
}

export function useOfficeUISettings() {
  const context = useContext(OfficeUISettingsContext);
  if (!context) {
    throw new Error('useOfficeUISettings must be used within OfficeUISettingsProvider');
  }
  return context;
}

// Export defaults for use in forms
export { DEFAULT_SETTINGS };
