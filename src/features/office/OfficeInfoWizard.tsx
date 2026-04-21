
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, User, Loader2, Save, Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface OfficeInfoWizardProps {
  officeId: string;
  onComplete: () => void;
}

export const OfficeInfoWizard: React.FC<OfficeInfoWizardProps> = ({ officeId, onComplete }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState({
    name: '',
    cnpj: '',
    slug: '',
    responsible_name: '',
    responsible_oab: ''
  });


  const maskCNPJ = (value: string) => {
    const digits = value.replace(/\D/g, "");
    return digits
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/\/(\d{4})(\d)/, "/$1-$2")
      .slice(0, 18);
  };

  const maskOAB = (value: string) => {
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const uf = cleaned.slice(0, 2).replace(/[^A-Z]/g, "");
    const rest = cleaned.slice(uf.length).replace(/\D/g, "").slice(0, 6);
    
    let result = uf;
    if (rest.length > 0) result += " " + rest;
    if (rest.length > 3) {
      result = uf + " " + rest.slice(0, 3) + "." + rest.slice(3);
    }
    return result.slice(0, 10);
  };



  useEffect(() => {
    const fetchOffice = async () => {
      try {
        const { data: office, error } = await supabase
          .from('offices')
          .select('name, cnpj, slug, metadata')
          .eq('id', officeId)
          .single();

        if (error) throw error;

        setData({
          name: office.name || '',
          cnpj: office.cnpj || '',
          slug: office.slug || '',
          responsible_name: (office.metadata as any)?.responsible_lawyer?.name || '',
          responsible_oab: (office.metadata as any)?.responsible_lawyer?.oab || ''
        });
      } catch (err) {
        console.error('Error fetching office:', err);
        toast.error('Erro ao carregar dados do escritório');
      } finally {
        setLoading(false);
      }
    };

    if (officeId) fetchOffice();
  }, [officeId]);

  const handleSave = async (directData?: typeof data) => {
    const currentData = directData || data;

    if (!currentData.name || !currentData.slug) {
      toast.error('Nome e link (slug) são obrigatórios');
      return;
    }

    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('offices')
        .update({
          name: currentData.name,
          cnpj: currentData.cnpj,
          slug: currentData.slug,
          metadata: {
            responsible_lawyer: {
              name: currentData.responsible_name,
              oab: currentData.responsible_oab
            }
          }
        })
        .eq('id', officeId);

      if (updateError) throw updateError;

      const { error: onboardingError } = await supabase
        .rpc('complete_onboarding_step', { p_step: 'office_info' });

      if (onboardingError) {
        console.warn('Could not mark step as complete:', onboardingError);
      }

      toast.success('Informações salvas com sucesso!');
      onComplete();
    } catch (err) {
      console.error('Error saving office info:', err);
      toast.error('Erro ao salvar informações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-sm text-slate-400">Carregando informações...</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-white">Informações do Escritório</h2>
        <p className="text-sm text-slate-400">Dados básicos para identificação e documentos.</p>
      </div>

      <Card className="bg-slate-900/50 border-white/5">
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-slate-300">Nome do Escritório</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <Input 
                  id="name"
                  placeholder="Ex: Almeida & Associados"
                  className="pl-10 bg-slate-950 border-white/10"
                  value={data.name}
                  onChange={(e) => setData({ ...data, name: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cnpj" className="text-slate-300">CNPJ (opcional)</Label>
              <Input 
                id="cnpj"
                placeholder="00.000.000/0000-00"
                className="bg-slate-950 border-white/10"
                value={data.cnpj}
                onChange={(e) => setData({ ...data, cnpj: maskCNPJ(e.target.value) })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug" className="text-slate-300">Link do Escritório (Slug)</Label>
            <div className="relative flex items-center">
              <div className="absolute left-3 flex items-center gap-1 pointer-events-none">
                <Globe className="h-4 w-4 text-slate-500" />
                <span className="text-slate-500 text-sm">app.flaito.com/</span>
              </div>
              <Input 
                id="slug"
                placeholder="nome-do-escritorio"
                className="pl-[145px] bg-slate-950 border-white/10"
                value={data.slug}
                onChange={(e) => setData({ ...data, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
              />
            </div>
            <p className="text-[10px] text-slate-500">Este será o endereço público para seus clientes.</p>
          </div>

          <div className="pt-4 border-t border-white/5 space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Advogado Responsável</p>

            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="resp_name" className="text-slate-300">Nome Completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <Input 
                    id="resp_name"
                    placeholder="Nome do advogado"
                    className="pl-10 bg-slate-950 border-white/10"
                    value={data.responsible_name}
                    onChange={(e) => setData({ ...data, responsible_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="resp_oab" className="text-slate-300">OAB</Label>
                <Input 
                  id="resp_oab"
                  placeholder="UF 000.000"
                  className="bg-slate-950 border-white/10"
                  value={data.responsible_oab}
                  onChange={(e) => setData({ ...data, responsible_oab: maskOAB(e.target.value) })}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 pt-4">
        <Button 
          onClick={() => handleSave()} 
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white min-w-[140px]"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Salvar e Continuar
            </>
          )}
        </Button>
      </div>
      </div>


    </>
  );
};
