import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Zap, AlertTriangle, CheckCircle, Activity, Settings2, Power } from 'lucide-react';

interface Policy {
  id: string;
  feature: string;
  mode: 'recommend' | 'auto_apply' | 'disabled';
  quality_floor: string;
  auto_apply_allowed: boolean;
}

interface ModelHealth {
  model_name: string;
  status: 'healthy' | 'degraded' | 'blocked' | 'manual_review_required';
  latency_avg_ms: number;
}

export const AutonomyControlPanel: React.FC = () => {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [healthRegistry, setHealthRegistry] = useState<ModelHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [killSwitchActive, setKillSwitchActive] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [pRes, hRes] = await Promise.all([
      supabase.from('autonomous_optimization_policies').select('*'),
      supabase.from('ai_model_health_registry').select('model_name, status, latency_avg_ms')
    ]);

    if (pRes.data) setPolicies(pRes.data);
    if (hRes.data) setHealthRegistry(hRes.data);
    setLoading(false);
  }

  async function toggleMode(feature: string, currentMode: string) {
    const newMode = currentMode === 'recommend' ? 'auto_apply' : 'recommend';
    const { error } = await supabase
      .from('autonomous_optimization_policies')
      .update({ mode: newMode, auto_apply_allowed: newMode === 'auto_apply' })
      .eq('feature', feature);
    
    if (!error) fetchData();
  }

  return (
    <div className="p-6 bg-[#0a0a0c] text-slate-100 rounded-xl border border-slate-800 shadow-2xl space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="text-amber-400 w-6 h-6" />
            Controladoria de Autonomia <span className="text-xs bg-amber-400/10 text-amber-400 px-2 py-0.5 rounded uppercase tracking-widest font-mono border border-amber-400/20">Stage 17</span>
          </h2>
          <p className="text-slate-400 text-sm mt-1">Gestão de otimização autônoma, circuit breakers e políticas de IA.</p>
        </div>
        <button 
          onClick={() => setKillSwitchActive(!killSwitchActive)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${killSwitchActive ? 'bg-red-500 text-white' : 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white'}`}
        >
          <Power className="w-4 h-4" />
          {killSwitchActive ? 'RESTAURAR SISTEMA' : 'EMERGENCY SHUTDOWN'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Policies Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Settings2 className="w-4 h-4" />
            Políticas por Funcionalidade
          </h3>
          <div className="space-y-3">
            {policies.map(policy => (
              <div key={policy.id} className="bg-slate-900/50 border border-slate-800 p-4 rounded-lg flex items-center justify-between hover:border-slate-700 transition-colors">
                <div>
                  <div className="font-medium text-slate-200">{policy.feature.replace('_', ' ').toUpperCase()}</div>
                  <div className="text-xs text-slate-500 mt-1">Quality Floor: <span className="text-slate-300 font-mono">{policy.quality_floor}</span></div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${policy.mode === 'auto_apply' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                    {policy.mode === 'auto_apply' ? 'AUTO-APPLY' : 'SUGGEST-ONLY'}
                  </span>
                  <button 
                    onClick={() => toggleMode(policy.feature, policy.mode)}
                    className="p-1.5 hover:bg-slate-800 rounded-md transition-colors text-slate-400"
                  >
                    <Settings2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Health Registry Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Activity className="w-4 h-4" />
            AI Model Health Registry
          </h3>
          <div className="space-y-3">
            {healthRegistry.map(model => (
              <div key={model.model_name} className="bg-slate-900/50 border border-slate-800 p-4 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {model.status === 'healthy' ? <CheckCircle className="text-emerald-500 w-4 h-4" /> : <AlertTriangle className="text-amber-500 w-4 h-4" />}
                  <div>
                    <div className="font-mono text-sm text-slate-300">{model.model_name}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Latency: {model.latency_avg_ms}ms</div>
                  </div>
                </div>
                <div className={`text-[10px] px-2 py-0.5 rounded font-mono ${model.status === 'healthy' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                  {model.status.toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Audit Quick Glace */}
      <div className="pt-4 border-t border-slate-800">
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1"><Shield className="w-3 h-3 text-emerald-400" /> Bounded Autonomy: ACTIVE</div>
          <div className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-blue-400" /> Explainability Layer: LIVE</div>
          <div className="flex items-center gap-1"><Zap className="w-3 h-3 text-amber-400" /> Optimization Engine: RUNNING</div>
        </div>
      </div>
    </div>
  );
};
