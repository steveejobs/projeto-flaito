import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, BarChart3, Info, AlertTriangle } from "lucide-react";
import { type StrategicInsight } from "@/types/governance";

interface StrategicDecisionBoardProps {
    insights: StrategicInsight[];
    loading?: boolean;
}

export const StrategicDecisionBoard: React.FC<StrategicDecisionBoardProps> = ({ insights, loading }) => {
    if (loading) {
        return (
            <div className="h-64 flex flex-col items-center justify-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500/20 border-t-amber-500" />
            </div>
        );
    }

    if (insights.length === 0) {
        return (
            <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-slate-600 gap-2 p-8 text-center bg-white/[0.01] border border-dashed border-white/5 rounded-2xl">
                <BarChart3 className="h-8 w-8 opacity-20" />
                <p className="text-[10px]">Aguardando dados de volumetria para gerar insights estratégicos.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {insights.map((insight, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-amber-500/[0.03] border border-amber-500/10 hover:border-amber-500/30 transition-all group">
                    <div className="flex justify-between items-start mb-2">
                        <Badge variant="outline" className={`text-[9px] uppercase border-amber-500/20 py-0 h-4 ${
                            insight.priority_level === 'critical' ? 'text-red-400' : 'text-amber-400'
                        }`}>
                            {insight.insight_type?.replace(/_/g, ' ')}
                        </Badge>
                        <div className="flex items-center gap-1">
                            <span className="text-[9px] text-slate-500 font-mono">CONFIDÊNCIA:</span>
                            <span className="text-[9px] text-emerald-400 font-bold">{Math.round((insight.confidence_score || 0) * 100)}%</span>
                        </div>
                    </div>
                    <h3 className="text-xs font-bold text-slate-200 mb-1">{insight.summary}</h3>
                    <p className="text-[10px] text-slate-400 leading-relaxed mb-3 italic">"{insight.reasoning}"</p>
                    
                    <div className="flex items-center justify-between gap-2 p-2 bg-white/5 rounded-lg mb-3">
                        <div className="flex flex-col">
                            <span className="text-[8px] text-slate-500 uppercase">Sugestão</span>
                            <span className="text-[10px] text-white font-medium">{insight.recommended_action}</span>
                        </div>
                        {insight.deviation_pct !== null && (
                            <div className="flex flex-col items-end">
                                <span className="text-[8px] text-slate-500 uppercase">Desvio</span>
                                <span className={`text-[10px] font-bold ${insight.deviation_pct > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                    {insight.deviation_pct > 0 ? '+' : ''}{insight.deviation_pct}%
                                </span>
                            </div>
                        )}
                    </div>

                    <Button variant="ghost" className="w-full h-7 text-[9px] text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 font-bold uppercase tracking-widest gap-1 border-white/5">
                        Model Explainability <Info className="h-3 w-3" />
                    </Button>
                </div>
            ))}
        </div>
    );
};
