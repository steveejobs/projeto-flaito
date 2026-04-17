import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, RefreshCw, Loader2, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ClientSignaturePanel } from './ClientSignaturePanel';
import { DocumentScanner, ScannedDocument, saveScannedDocumentsToClientFiles } from '@/features/documents';
import type { Tables } from '@/integrations/supabase/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toTitleCase } from '@/lib/utils';
import {
  KitFormDialog,
  KitAnswers,
  MetodoPagamento,
  getDefaultKitAnswers,
  formatCurrency,
  parseCurrencyToNumber,
  valorPorExtenso,
  calcularDatasParcelas,
} from '@/components/KitFormDialog';
import { autoGenerateClientKit } from '@/lib/clientKit';
import { ContractSetupModal } from '@/components/ContractSetupModal';

type Client = Tables<'clients'>;

const MARITAL_STATUS_OPTIONS = [
  { value: 'solteiro', label: 'Solteiro(a)' },
  { value: 'casado', label: 'Casado(a)' },
  { value: 'divorciado', label: 'Divorciado(a)' },
  { value: 'viuvo', label: 'Viúvo(a)' },
  { value: 'uniao_estavel', label: 'União Estável' },
  { value: 'separado', label: 'Separado(a)' },
];

// Helper functions for formatting
const formatCpf = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

const formatCnpj = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
};

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

type ClientFormData = {
  full_name: string;
  person_type: 'PF' | 'PJ';
  cpf: string;
  cnpj: string;
  email: string;
  phone: string;
  address_line: string;
  nationality: string;
  marital_status: string;
  profession: string;
  rg: string;
  rg_issuer: string;
  // Campos do representante legal (PJ)
  representative_name: string;
  representative_cpf: string;
  representative_rg: string;
  representative_nationality: string;
  representative_marital_status: string;
  representative_profession: string;
};

type Props = {
  officeId: string | null;
  userId: string | null;
  editingClient: Client | null;
  onClientSaved: (client: Client, isNew: boolean) => void;
  onClose: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ClientFormDialog({
  officeId,
  userId,
  editingClient,
  onClientSaved,
  onClose,
  open,
  onOpenChange,
}: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('scanner');
  const [newlyCreatedClientId, setNewlyCreatedClientId] = useState<string | null>(null);
  const [createInitialDocs, setCreateInitialDocs] = useState(true);
  const [scannedDocuments, setScannedDocuments] = useState<ScannedDocument[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isCnpjLoading, setIsCnpjLoading] = useState(false);
  // Form data
  const [formData, setFormData] = useState<ClientFormData>({
    full_name: '',
    person_type: 'PF',
    cpf: '',
    cnpj: '',
    email: '',
    phone: '',
    address_line: '',
    nationality: '',
    marital_status: '',
    profession: '',
    rg: '',
    rg_issuer: '',
    representative_name: '',
    representative_cpf: '',
    representative_rg: '',
    representative_nationality: '',
    representative_marital_status: '',
    representative_profession: '',
  });

  // Address fields
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [numberAddress, setNumberAddress] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [stateUf, setStateUf] = useState('');
  const [complement, setComplement] = useState('');
  const [loadingCep, setLoadingCep] = useState(false);

  // Kit regeneration dialog state
  const [showRegenerateKitDialog, setShowRegenerateKitDialog] = useState(false);
  const [regeneratingKit, setRegeneratingKit] = useState(false);
  const [pendingUpdatedClient, setPendingUpdatedClient] = useState<Client | null>(null);
  const [kitAnswers, setKitAnswers] = useState<KitAnswers>(getDefaultKitAnswers());

  // Initial kit creation dialog state
  const [showInitialKitDialog, setShowInitialKitDialog] = useState(false);
  const [creatingInitialKit, setCreatingInitialKit] = useState(false);

  // NEW: Contract setup modal state (fluxo limpo)
  const [showContractModal, setShowContractModal] = useState(false);
  const [generatingBasicKit, setGeneratingBasicKit] = useState(false);

  // AI extraction tracking
  const [aiExtracted, setAiExtracted] = useState(false);

  // Reset form when dialog opens/closes or editing client changes
  useEffect(() => {
    if (open) {
      if (editingClient) {
        setFormData({
          full_name: editingClient.full_name,
          person_type: editingClient.person_type,
          cpf: editingClient.cpf || '',
          cnpj: editingClient.cnpj || '',
          email: editingClient.email || '',
          phone: editingClient.phone || '',
          address_line: editingClient.address_line || '',
          nationality: editingClient.nationality || 'Brasileiro(a)',
          marital_status: editingClient.marital_status || '',
          profession: editingClient.profession || '',
          rg: editingClient.rg || '',
          rg_issuer: editingClient.rg_issuer || '',
          representative_name: editingClient.representative_name || '',
          representative_cpf: editingClient.representative_cpf || '',
          representative_rg: editingClient.representative_rg || '',
          representative_nationality: editingClient.representative_nationality || 'Brasileiro(a)',
          representative_marital_status: editingClient.representative_marital_status || '',
          representative_profession: editingClient.representative_profession || '',
        });

        // Carregar campos de endereço separados
        setCep(formatCep(editingClient.cep || ''));
        setCity(editingClient.city || '');
        setStateUf(editingClient.state || '');

        // Extrair logradouro, número e bairro do address_line
        const addressParts = (editingClient.address_line || '').split(',').map(p => p.trim());
        if (addressParts.length >= 1) setStreet(addressParts[0] || '');
        if (addressParts.length >= 2) setNumberAddress(addressParts[1]?.replace(/[^\d]/g, '') || '');
        if (addressParts.length >= 3) setNeighborhood(addressParts[2] || '');

        setActiveTab('dados');
      } else {
        resetForm();
      }
    }
  }, [open, editingClient]);

  const resetForm = () => {
    setFormData({
      full_name: '',
      person_type: 'PF',
      cpf: '',
      cnpj: '',
      email: '',
      phone: '',
      address_line: '',
      nationality: 'Brasileiro(a)',
      marital_status: '',
      profession: '',
      rg: '',
      rg_issuer: '',
      representative_name: '',
      representative_cpf: '',
      representative_rg: '',
      representative_nationality: 'Brasileiro(a)',
      representative_marital_status: '',
      representative_profession: '',
    });
    setCep('');
    setStreet('');
    setNumberAddress('');
    setNeighborhood('');
    setCity('');
    setStateUf('');
    setComplement('');
    setFormErrors({});
    setNewlyCreatedClientId(null);
    setActiveTab('scanner');
    setScannedDocuments([]);
    setCreateInitialDocs(true);
    setIsCnpjLoading(false);
    setKitAnswers(getDefaultKitAnswers());
    setAiExtracted(false);
  };

  // Função para buscar dados do CNPJ na BrasilAPI
  const fetchCnpjData = async (rawCnpj: string) => {
    const cnpjDigits = rawCnpj.replace(/\D/g, '');
    if (cnpjDigits.length !== 14) {
      toast({
        title: 'CNPJ inválido',
        description: 'O CNPJ deve ter 14 dígitos.',
        variant: 'destructive',
      });
      return;
    }

    setIsCnpjLoading(true);
    try {
      const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjDigits}`);
      if (!resp.ok) {
        throw new Error('Não foi possível consultar o CNPJ');
      }

      const data = await resp.json();

      // Razão social
      const razao = data.razao_social || data.nome_fantasia || formData.full_name;

      // Endereço
      const logradouro = data.logradouro || '';
      const numero = data.numero || '';
      const bairro = data.bairro || '';
      const cidadeApi = data.municipio || '';
      const ufApi = data.uf || '';
      const cepApi = data.cep?.replace(/\D/g, '') || '';

      // Monta endereço completo
      const enderecoLinha = [
        logradouro,
        numero && `nº ${numero}`,
        bairro,
        cidadeApi && ufApi ? `${cidadeApi} - ${ufApi}` : cidadeApi || ufApi,
        cepApi && `CEP ${cepApi}`,
      ]
        .filter(Boolean)
        .join(', ');

      // Busca o primeiro sócio/administrador como representante legal
      let repNome = '';
      let repCpf = '';
      if (data.qsa && Array.isArray(data.qsa) && data.qsa.length > 0) {
        // Prioriza quem tem "administrador" ou "sócio-administrador" na qualificação
        const admin = data.qsa.find((s: any) =>
          s.qual_socio?.toLowerCase().includes('administrador')
        ) || data.qsa[0];

        repNome = admin.nome_socio || '';
        // A BrasilAPI não retorna CPF dos sócios por questão de privacidade,
        // mas algumas APIs alternativas podem retornar
        repCpf = admin.cpf_representante_legal || '';
      }

      // Atualiza formData
      setFormData((prev) => ({
        ...prev,
        full_name: razao || prev.full_name,
        cnpj: data.cnpj || prev.cnpj,
        address_line: enderecoLinha || prev.address_line,
        email: data.email || prev.email,
        phone: data.ddd_telefone_1 || prev.phone,
        // Representante legal
        representative_name: repNome || prev.representative_name,
        representative_cpf: repCpf || prev.representative_cpf,
        representative_nationality: 'brasileiro(a)',
      }));

      // Atualiza campos de endereço separados
      if (cepApi) setCep(formatCep(cepApi));
      if (logradouro) setStreet(logradouro);
      if (numero) setNumberAddress(numero);
      if (bairro) setNeighborhood(bairro);
      if (cidadeApi) setCity(cidadeApi);
      if (ufApi) setStateUf(ufApi);

      toast({
        title: 'CNPJ encontrado',
        description: 'Dados da empresa preenchidos automaticamente.',
      });
    } catch (err: any) {
      console.error('[CNPJ] Erro ao consultar:', err);
      toast({
        title: 'Erro ao consultar CNPJ',
        description: err?.message || 'Verifique o número informado e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsCnpjLoading(false);
    }
  };

  const sanitizeCep = (raw: string) => raw.replace(/\D/g, '').slice(0, 8);

  const formatCep = (value: string) => {
    const digits = sanitizeCep(value);
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  };

  const fetchAddressFromCep = async (digits: string, silent: boolean = false) => {
    if (digits.length !== 8) return;

    setLoadingCep(true);
    try {
      const res = await supabase.functions.invoke('cep-proxy', {
        body: { cep: digits },
      });

      if (res.error) {
        if (!silent) {
          toast({
            title: 'Erro ao consultar CEP',
            description: 'Não foi possível consultar o CEP. Tente novamente.',
            variant: 'destructive',
          });
        }
        return;
      }

      const data = res.data;

      if (data?.erro) {
        if (!silent) {
          toast({
            title: 'CEP não encontrado',
            description: 'Verifique o CEP informado.',
            variant: 'destructive',
          });
        }
        return;
      }

      setStreet(data.logradouro || '');
      setNeighborhood(data.bairro || '');
      setCity(data.localidade || '');
      setStateUf(data.uf || '');
      setComplement(data.complemento || '');
    } catch (err) {
      console.error('[CEP Proxy]', err);
    } finally {
      setLoadingCep(false);
    }
  };

  const handleCepChange = (v: string) => {
    const f = formatCep(v);
    setCep(f);
    const digits = sanitizeCep(f);
    if (digits.length === 8) {
      fetchAddressFromCep(digits);
    }
  };

  // Handler for data extracted from scanned documents
  const handleDataExtracted = (data: Record<string, string | null | undefined>) => {
    // Mark as AI extracted
    setAiExtracted(true);

    setFormData((prev) => ({
      ...prev,
      full_name: data.full_name || prev.full_name,
      cpf: data.cpf ? formatCpf(data.cpf) : prev.cpf,
      rg: data.rg || prev.rg,
      rg_issuer: data.rg_issuer || prev.rg_issuer,
      nationality: data.nationality || prev.nationality,
      marital_status: data.marital_status || prev.marital_status,
      profession: data.profession || prev.profession,
    }));

    // Update address fields if extracted
    if (data.address_line) setStreet(data.address_line);
    if (data.neighborhood) setNeighborhood(data.neighborhood);
    if (data.city) setCity(data.city);
    if (data.state) setStateUf(data.state);
    if (data.cep) {
      setCep(formatCep(data.cep));
      fetchAddressFromCep(data.cep.replace(/\D/g, ''), true);
    }

    // Switch to data tab after extraction
    setActiveTab('dados');
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.full_name?.trim()) {
      errors.full_name = 'Informe o nome completo do cliente';
    }

    const cpfDigits = (formData.cpf || '').replace(/\D/g, '');
    const cnpjDigits = (formData.cnpj || '').replace(/\D/g, '');

    if (formData.person_type === 'PF') {
      if (cpfDigits.length !== 11) {
        errors.cpf = 'CPF inválido (deve ter 11 dígitos)';
      }
    } else {
      if (cnpjDigits.length !== 14) {
        errors.cnpj = 'CNPJ inválido (deve ter 14 dígitos)';
      }
    }

    const phoneDigits = (formData.phone || '').replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      errors.phone = 'Informe um telefone válido';
    }

    const cepDigits = sanitizeCep(cep);
    if (cepDigits.length !== 8) {
      errors.cep = 'Informe um CEP válido';
    }
    if (!street.trim()) errors.address_line = 'Informe o logradouro';
    if (!neighborhood.trim()) errors.neighborhood = 'Informe o bairro';
    if (!city.trim()) errors.city = 'Informe a cidade';
    if (!stateUf.trim()) errors.state = 'Informe a UF';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast({
        title: 'Preencha os dados obrigatórios',
        description: 'Preencha todos os campos obrigatórios antes de salvar.',
        variant: 'destructive',
      });
      return;
    }

    if (!userId) {
      toast({
        title: 'Erro de Autenticação',
        description: 'Não foi possível identificar seu usuário. Tente atualizar a página.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    try {
      const isPF = formData.person_type === 'PF';

      if (editingClient) {
        // Reconstruir address_line com os campos atuais
        const formattedAddressParts = [street.trim(), numberAddress.trim(), neighborhood.trim()].filter(Boolean);
        const fullAddress = formattedAddressParts.join(', ') + (complement.trim() ? ` - ${complement.trim()}` : '');

        const { data: updatedClient, error: updateError } = await supabase
          .from('clients')
          .update({
            full_name: toTitleCase(formData.full_name),
            person_type: formData.person_type,
            cpf: isPF ? formData.cpf || null : null,
            cnpj: !isPF ? formData.cnpj || null : null,
            email: formData.email || null,
            phone: formData.phone || null,
            cep: cep.replace(/\D/g, '') || null,
            address_line: fullAddress || null,
            city: city.trim() || null,
            state: stateUf.trim() || null,
            nationality: isPF ? toTitleCase(formData.nationality) : null,
            marital_status: isPF ? formData.marital_status || null : null,
            profession: isPF ? toTitleCase(formData.profession) : null,
            rg: isPF ? formData.rg || null : null,
            rg_issuer: isPF ? formData.rg_issuer || null : null,
            // Campos do representante (PJ)
            representative_name: !isPF ? toTitleCase(formData.representative_name) : null,
            representative_cpf: !isPF ? formData.representative_cpf || null : null,
            representative_rg: !isPF ? formData.representative_rg || null : null,
            representative_nationality: !isPF ? toTitleCase(formData.representative_nationality) : null,
            representative_marital_status: !isPF ? formData.representative_marital_status || null : null,
            representative_profession: !isPF ? toTitleCase(formData.representative_profession) : null,
          })
          .eq('id', editingClient.id)
          .select()
          .single();

        if (updateError) throw updateError;

        toast({ title: 'Cliente atualizado', description: 'Os dados foram atualizados.' });
        onClientSaved(updatedClient, false);

        // Salvar documentos escaneados adicionais
        if (scannedDocuments.length > 0 && officeId) {
          const saveResult = await saveScannedDocumentsToClientFiles(scannedDocuments, editingClient.id, officeId);
          if (saveResult.success && saveResult.errors.length === 0) {
            toast({
              title: "Documentos salvos",
              description: `${scannedDocuments.length} arquivo(s) anexado(s) ao cliente.`,
            });
          } else if (saveResult.errors.length > 0) {
            toast({
              title: "Aviso",
              description: `Alguns arquivos não foram salvos: ${saveResult.errors.slice(0, 2).join(", ")}`,
              variant: "destructive",
            });
          }
        }

        // Verificar se o cliente já tem kit gerado
        const { data: existingKit } = await supabase
          .from('client_files')
          .select('id')
          .eq('client_id', editingClient.id)
          .in('kind', ['KIT_PROCURACAO', 'KIT_DECLARACAO', 'KIT_CONTRATO'])
          .limit(1);

        if (existingKit && existingKit.length > 0) {
          setPendingUpdatedClient(updatedClient);
          setShowRegenerateKitDialog(true);
        } else {
          onClose();
          resetForm();
        }
      } else {
        const formattedAddressParts = [street.trim(), numberAddress.trim(), neighborhood.trim()].filter(Boolean);
        const fullAddress = formattedAddressParts.join(', ') + (complement.trim() ? ` - ${complement.trim()}` : '');

        const { data: newClient, error: insertError } = await supabase
          .from('clients')
          .insert({
            office_id: officeId,
            full_name: toTitleCase(formData.full_name),
            person_type: formData.person_type,
            cpf: isPF ? formData.cpf || null : null,
            cnpj: !isPF ? formData.cnpj || null : null,
            email: formData.email || null,
            phone: formData.phone || null,
            cep: cep.replace(/\D/g, '') || null,
            address_line: fullAddress || null,
            city: city.trim() || null,
            state: stateUf.trim() || null,
            nationality: isPF ? toTitleCase(formData.nationality) : null,
            marital_status: isPF ? formData.marital_status || null : null,
            profession: isPF ? toTitleCase(formData.profession) : null,
            rg: isPF ? formData.rg || null : null,
            rg_issuer: isPF ? formData.rg_issuer || null : null,
            // Campos do representante (PJ)
            representative_name: !isPF ? toTitleCase(formData.representative_name) : null,
            representative_cpf: !isPF ? formData.representative_cpf || null : null,
            representative_rg: !isPF ? formData.representative_rg || null : null,
            representative_nationality: !isPF ? toTitleCase(formData.representative_nationality) : null,
            representative_marital_status: !isPF ? formData.representative_marital_status || null : null,
            representative_profession: !isPF ? toTitleCase(formData.representative_profession) : null,
            created_by: userId,
            ai_extracted: aiExtracted,
            status: 'active',
          })
          .select()
          .single();

        if (insertError) {
          let errorMessage = 'Não foi possível cadastrar o cliente.';
          if (insertError.message?.includes('ux_clients_office_cpf')) {
            errorMessage = 'Já existe um cliente com este CPF neste escritório.';
          } else if (insertError.message?.includes('ux_clients_office_cnpj')) {
            errorMessage = 'Já existe um cliente com este CNPJ neste escritório.';
          }
          toast({ title: 'Erro ao cadastrar', description: errorMessage, variant: 'destructive' });
          return;
        }

        toast({
          title: 'Cliente cadastrado',
          description: 'Assinatura pendente para gerar o KIT (Procuração e Declaração).'
        });
        onClientSaved(newClient, true);

        if (newClient?.id) {
          setNewlyCreatedClientId(newClient.id);
          setActiveTab('assinatura');

          // Salvar documentos escaneados
          if (scannedDocuments.length > 0 && officeId) {
            const saveResult = await saveScannedDocumentsToClientFiles(scannedDocuments, newClient.id, officeId);

            if (saveResult.success && saveResult.errors.length === 0) {
              toast({
                title: "Documentos salvos",
                description: `${scannedDocuments.length} arquivo(s) anexado(s) ao cliente.`,
              });
            } else if (saveResult.errors.length > 0) {
              toast({
                title: "Aviso",
                description: `Alguns arquivos não foram salvos: ${saveResult.errors.slice(0, 2).join(", ")}`,
                variant: "destructive",
              });
            }
          }

          // Kit será gerado SOMENTE após coletar assinatura (ClientSignaturePanel)
          return;
        }
      }
    } catch (err) {
      toast({
        title: editingClient ? 'Erro ao atualizar' : 'Erro ao cadastrar',
        description: 'Não foi possível salvar o cliente.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const createInitialDocsKit = async (clientId: string, variables?: Record<string, any>) => {
    try {
      const { data, error } = await supabase.functions.invoke('create-client-kit', {
        body: {
          client_id: clientId,
          template_codes: ['PROC', 'DECL', 'CONTRATO'],
          variables: variables || {},
        },
      });

      let errorReason = data?.reason || error?.message || 'Não foi possível gerar os documentos.';

      // Tenta extrair a mensagem de erro enviada pela edge function (422/500)
      const errorWithCtx = error as { context?: { json: () => Promise<Record<string, unknown>> } };
      if (errorWithCtx?.context && typeof errorWithCtx.context.json === 'function') {
        try {
          const body = await errorWithCtx.context.json();
          if (body && body.reason) {
            errorReason = body.reason;
          } else if (body && body.errors) {
            errorReason = Array.isArray(body.errors) ? typeof body.errors[0] === 'string' ? body.errors[0] : JSON.stringify(body.errors) : JSON.stringify(body.errors);
          }
        } catch (e) {
          // Ignora se não for JSON
        }
      }

      if (error || !data?.ok) {
        toast({
          title: 'Erro ao criar documentos iniciais (Detalhado)',
          description: errorReason,
          variant: 'destructive',
        });
        return;
      }

      const createdCount = data.created?.length || 0;
      if (createdCount > 0) {
        toast({
          title: 'Documentos iniciais criados',
          description: `${createdCount} documento(s) gerado(s).`,
        });
      }
    } catch (err) {
      console.error('[Lexos] Erro ao criar kit inicial:', err);
    }
  };

  // Build variables from kitAnswers for kit generation
  const buildKitVariables = () => {
    const { tipo_remuneracao, percentual_honorarios, valor_fixo_honorarios, forma_pagamento, valor_entrada, numero_parcelas, valor_parcela, metodo_pagamento, chave_pix } = kitAnswers;

    const valorFixoNum = parseCurrencyToNumber(valor_fixo_honorarios);
    const valorEntradaNum = parseCurrencyToNumber(valor_entrada);
    const valorParcelaNum = parseCurrencyToNumber(valor_parcela);
    const numParcelas = parseInt(numero_parcelas, 10) || 0;

    // Calcular datas das parcelas
    const datasParcelas = numParcelas > 0 ? calcularDatasParcelas(kitAnswers.data_primeira_parcela, numParcelas) : [];
    const datasFormatadas = datasParcelas.map(d => format(d, "dd/MM/yyyy", { locale: ptBR }));

    // Montar descrição completa dos honorários
    let honorariosDescricao = "";
    if (tipo_remuneracao === "percentual") {
      honorariosDescricao = `${percentual_honorarios}% (${valorPorExtenso(parseFloat(percentual_honorarios))} por cento) sobre o proveito econômico obtido`;
    } else if (tipo_remuneracao === "valor_fixo") {
      honorariosDescricao = `${formatCurrency(valor_fixo_honorarios)} (${valorPorExtenso(valorFixoNum)})`;
    } else if (tipo_remuneracao === "misto") {
      honorariosDescricao = `${percentual_honorarios}% sobre o proveito econômico, mais o valor fixo de ${formatCurrency(valor_fixo_honorarios)} (${valorPorExtenso(valorFixoNum)})`;
    }

    // Montar descrição da forma de pagamento
    let formaPagamentoDescricao = "";
    if (forma_pagamento === "a_vista") {
      formaPagamentoDescricao = "à vista, no ato da assinatura deste instrumento";
    } else if (forma_pagamento === "parcelado") {
      formaPagamentoDescricao = `em ${numParcelas} (${valorPorExtenso(numParcelas)}) parcelas mensais de ${formatCurrency(valor_parcela)} (${valorPorExtenso(valorParcelaNum)}), com vencimentos em ${datasFormatadas.join(", ")}`;
    } else if (forma_pagamento === "entrada_parcelas") {
      formaPagamentoDescricao = `mediante entrada de ${formatCurrency(valor_entrada)} (${valorPorExtenso(valorEntradaNum)}) no ato da assinatura, e o saldo em ${numParcelas} (${valorPorExtenso(numParcelas)}) parcelas mensais de ${formatCurrency(valor_parcela)} (${valorPorExtenso(valorParcelaNum)}), com vencimentos em ${datasFormatadas.join(", ")}`;
    }

    // Descrição do método de pagamento
    const metodoLabels: Record<MetodoPagamento, string> = {
      pix: "PIX",
      transferencia: "transferência bancária",
      boleto: "boleto bancário",
      dinheiro: "dinheiro",
    };
    let metodoPagamentoDescricao = `Os pagamentos deverão ser realizados via ${metodoLabels[metodo_pagamento]}`;
    if (metodo_pagamento === "pix" && chave_pix) {
      metodoPagamentoDescricao += ` para a chave: ${chave_pix}`;
    }

    // Cláusula de inadimplemento (apenas para parcelamento)
    let clausulaInadimplemento = "";
    if (forma_pagamento !== "a_vista") {
      clausulaInadimplemento = `
<p><strong>CLÁUSULA - DO INADIMPLEMENTO</strong></p>
<p>O atraso no pagamento de qualquer parcela por prazo superior a 15 (quinze) dias acarretará:</p>
<p>a) Incidência de multa de 2% (dois por cento) sobre o valor da parcela em atraso;</p>
<p>b) Juros de mora de 1% (um por cento) ao mês, calculados pro rata die;</p>
<p>c) O vencimento antecipado de todas as parcelas vincendas, tornando-se exigível de imediato o saldo total do contrato;</p>
<p>d) Correção monetária pelo INPC/IBGE ou índice que o substitua.</p>`;
    }

    return {
      tipo_remuneracao,
      percentual_honorarios,
      valor_fixo_honorarios: formatCurrency(valor_fixo_honorarios),
      valor_fixo_honorarios_extenso: valorPorExtenso(valorFixoNum),
      forma_pagamento,
      valor_entrada: formatCurrency(valor_entrada),
      valor_entrada_extenso: valorPorExtenso(valorEntradaNum),
      numero_parcelas: numero_parcelas,
      numero_parcelas_extenso: valorPorExtenso(numParcelas),
      valor_parcela: formatCurrency(valor_parcela),
      valor_parcela_extenso: valorPorExtenso(valorParcelaNum),
      data_primeira_parcela: format(kitAnswers.data_primeira_parcela, "dd/MM/yyyy", { locale: ptBR }),
      parcelas_datas_vencimento: datasFormatadas.join(", "),
      metodo_pagamento,
      metodo_pagamento_label: metodoLabels[metodo_pagamento],
      chave_pix,
      honorarios_descricao_completa: honorariosDescricao,
      forma_pagamento_descricao: formaPagamentoDescricao,
      metodo_pagamento_descricao: metodoPagamentoDescricao,
      clausula_inadimplemento: clausulaInadimplemento,
    };
  };

  // Validate kit form before generation
  const validateKitForm = (): boolean => {
    const { tipo_remuneracao, percentual_honorarios, valor_fixo_honorarios, forma_pagamento, valor_entrada, numero_parcelas, valor_parcela, metodo_pagamento, chave_pix } = kitAnswers;

    if (tipo_remuneracao === "percentual" && !percentual_honorarios) {
      toast({ title: "Informe o percentual de honorários", variant: "destructive" });
      return false;
    }
    if (tipo_remuneracao === "valor_fixo" && !valor_fixo_honorarios) {
      toast({ title: "Informe o valor dos honorários", variant: "destructive" });
      return false;
    }
    if (tipo_remuneracao === "misto" && (!percentual_honorarios || !valor_fixo_honorarios)) {
      toast({ title: "Informe o percentual e o valor fixo dos honorários", variant: "destructive" });
      return false;
    }

    if (forma_pagamento === "parcelado" && (!numero_parcelas || !valor_parcela)) {
      toast({ title: "Informe o número de parcelas e o valor de cada parcela", variant: "destructive" });
      return false;
    }
    if (forma_pagamento === "entrada_parcelas" && (!valor_entrada || !numero_parcelas || !valor_parcela)) {
      toast({ title: "Informe o valor da entrada, número de parcelas e valor de cada parcela", variant: "destructive" });
      return false;
    }

    if (metodo_pagamento === "pix" && !chave_pix) {
      toast({ title: "Informe a chave PIX", variant: "destructive" });
      return false;
    }

    return true;
  };

  const handleRegenerateKit = async () => {
    if (!pendingUpdatedClient) return;

    // Validate kit form
    if (!validateKitForm()) return;

    setRegeneratingKit(true);
    try {
      const variables = buildKitVariables();

      const { data, error } = await supabase.functions.invoke('create-client-kit', {
        body: {
          client_id: pendingUpdatedClient.id,
          template_codes: ['PROC', 'DECL', 'CONTRATO'],
          variables,
        },
      });

      if (error || !data?.ok) {
        toast({
          title: 'Erro ao regenerar kit',
          description: data?.reason || 'Não foi possível regenerar os documentos.',
          variant: 'destructive',
        });
      } else {
        const createdCount = data.created?.length || 0;
        toast({
          title: 'Kit regenerado',
          description: `${createdCount} documento(s) atualizado(s) com os novos dados.`,
        });
      }
    } catch (err) {
      console.error('[Lexos] Erro ao regenerar kit:', err);
      toast({
        title: 'Erro ao regenerar kit',
        description: 'Ocorreu um erro inesperado.',
        variant: 'destructive',
      });
    } finally {
      setRegeneratingKit(false);
      setShowRegenerateKitDialog(false);
      setPendingUpdatedClient(null);
      onClose();
      resetForm();
    }
  };

  const handleSkipRegeneration = () => {
    setShowRegenerateKitDialog(false);
    setPendingUpdatedClient(null);
    onClose();
    resetForm();
  };

  const handleFinalize = async () => {
    if (createInitialDocs && newlyCreatedClientId) {
      // Exibir formulário de honorários antes de gerar o kit
      setShowInitialKitDialog(true);
      return;
    }
    // Se não vai gerar kit, finaliza normalmente
    await finalizeAndClose();
  };

  const finalizeAndClose = async () => {
    // Busca o cliente atualizado e notifica para atualizar a lista
    if (newlyCreatedClientId) {
      const { data: refreshedClient } = await supabase
        .from('clients')
        .select('*')
        .eq('id', newlyCreatedClientId)
        .single();
      if (refreshedClient) {
        onClientSaved(refreshedClient, false); // false = update existing, not add new
      }
    }
    setShowInitialKitDialog(false);
    onClose();
    resetForm();
  };

  const handleConfirmInitialKit = async () => {
    if (!newlyCreatedClientId) return;

    // Validar formulário de honorários
    if (!validateKitForm()) return;

    setCreatingInitialKit(true);
    try {
      const variables = buildKitVariables();
      await createInitialDocsKit(newlyCreatedClientId, variables);
      await finalizeAndClose();
    } finally {
      setCreatingInitialKit(false);
    }
  };

  const handleSkipInitialKit = async () => {
    setShowInitialKitDialog(false);
    await finalizeAndClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) resetForm();
      }}>
        <DialogContent className="sm:max-w-3xl w-[95vw] h-[85vh] p-0 overflow-hidden border-white/10 glass-panel flex flex-col">
          <DialogHeader className="p-6 pb-2 border-b border-white/5 bg-background/50 backdrop-blur-sm">
            <DialogTitle className="text-2xl font-bold tracking-tight">
              {editingClient ? 'Editar Cliente' : newlyCreatedClientId ? 'Completar Cadastro' : 'Novo Cliente'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground/80">
              {editingClient
                ? 'Atualize os dados e configurações do perfil do cliente.'
                : newlyCreatedClientId
                  ? 'Verifique as informações extraídas e finalize o cadastro.'
                  : 'Digitalize os documentos ou inicie o preenchimento manual.'}
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="px-6 pt-3 pb-2">
              <TabsList className="grid grid-cols-3 w-full bg-muted/20 p-1">
                <TabsTrigger value="scanner" disabled={!!newlyCreatedClientId} className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  1. Digitalizar
                </TabsTrigger>
                <TabsTrigger value="dados" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">2. Dados</TabsTrigger>
                <TabsTrigger value="assinatura" disabled={!newlyCreatedClientId && !editingClient} className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  3. Assinatura
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Scanner Tab */}
            <TabsContent value="scanner" className="flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col overflow-hidden m-0 p-0">
              <div className="flex-1 overflow-y-auto minimal-scrollbar px-6 py-4">
                <div className="capture-animate-in">
                  <DocumentScanner
                    scannedDocuments={scannedDocuments}
                    onScannedDocumentsChange={setScannedDocuments}
                    onDataExtracted={handleDataExtracted}
                  />
                </div>
              </div>
              <div className="glass-footer flex justify-end gap-3 px-6">
                <Button type="button" variant="outline" onClick={() => setActiveTab('dados')} className="btn-tactile">
                  Pular e preencher manualmente
                </Button>
              </div>
            </TabsContent>

            {/* Data Tab */}
            <TabsContent value="dados" className="flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col overflow-hidden m-0 p-0">
              <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden min-h-0">
                <div className="flex-1 overflow-y-auto minimal-scrollbar px-6 py-4 space-y-6">
                  <div className="grid gap-6 capture-animate-in">
                    {/* Basic Info Section */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-4 w-1 bg-primary rounded-full" />
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Informações Básicas</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-medium uppercase tracking-tight text-muted-foreground/70">Tipo de pessoa *</Label>
                          <Select
                            value={formData.person_type}
                            onValueChange={(v: 'PF' | 'PJ') => setFormData((d) => ({ ...d, person_type: v }))}
                            disabled={!!newlyCreatedClientId}
                          >
                            <SelectTrigger className="bg-muted/10 border-white/5 focus:ring-primary/20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PF">Pessoa Física</SelectItem>
                              <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {formData.person_type === 'PJ' && (
                          <div className="space-y-2">
                            <Label className="text-xs font-medium uppercase tracking-tight text-muted-foreground/70">CNPJ *</Label>
                            <div className="flex gap-2">
                              <Input
                                value={formData.cnpj}
                                onChange={(e) => setFormData((d) => ({ ...d, cnpj: formatCnpj(e.target.value) }))}
                                placeholder="00.000.000/0000-00"
                                className="flex-1 bg-muted/10 border-white/5 focus:ring-primary/20 h-10"
                                disabled={!!newlyCreatedClientId}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="shrink-0 btn-tactile h-10 w-10"
                                onClick={() => formData.cnpj && fetchCnpjData(formData.cnpj)}
                                disabled={!formData.cnpj || isCnpjLoading || !!newlyCreatedClientId}
                              >
                                {isCnpjLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                              </Button>
                            </div>
                            {formErrors.cnpj && <p className="text-[10px] text-destructive font-medium">{formErrors.cnpj}</p>}
                          </div>
                        )}

                        <div className="space-y-2 md:col-span-2">
                          <Label className="text-xs font-medium uppercase tracking-tight text-muted-foreground/70">
                            {formData.person_type === 'PF' ? 'Nome completo *' : 'Razão Social *'}
                          </Label>
                          <Input
                            value={formData.full_name}
                            onChange={(e) => setFormData((d) => ({ ...d, full_name: e.target.value }))}
                            placeholder={formData.person_type === 'PF' ? 'Nome do cliente' : 'Razão social da empresa'}
                            className="bg-muted/10 border-white/5 focus:ring-primary/20 h-11 text-lg font-medium"
                            disabled={!!newlyCreatedClientId}
                          />
                          {formErrors.full_name && <p className="text-[10px] text-destructive font-medium">{formErrors.full_name}</p>}
                        </div>

                        {formData.person_type === 'PF' && (
                          <>
                            <div className="space-y-2">
                              <Label className="text-xs font-medium uppercase tracking-tight text-muted-foreground/70">CPF *</Label>
                              <Input
                                value={formData.cpf}
                                onChange={(e) => setFormData((d) => ({ ...d, cpf: formatCpf(e.target.value) }))}
                                placeholder="000.000.000-00"
                                className="bg-muted/10 border-white/5 focus:ring-primary/20"
                                disabled={!!newlyCreatedClientId}
                              />
                              {formErrors.cpf && <p className="text-[10px] text-destructive font-medium">{formErrors.cpf}</p>}
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-medium uppercase tracking-tight text-muted-foreground/70">RG</Label>
                              <Input
                                value={formData.rg}
                                onChange={(e) => setFormData((d) => ({ ...d, rg: e.target.value }))}
                                placeholder="Número do RG"
                                className="bg-muted/10 border-white/5 focus:ring-primary/20"
                                disabled={!!newlyCreatedClientId}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label className="text-xs font-medium uppercase tracking-tight text-muted-foreground/70">Nacionalidade</Label>
                              <Input
                                value={formData.nationality}
                                onChange={(e) => setFormData((d) => ({ ...d, nationality: e.target.value }))}
                                placeholder="Brasileiro(a)"
                                className="bg-muted/10 border-white/5 focus:ring-primary/20"
                                disabled={!!newlyCreatedClientId}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-medium uppercase tracking-tight text-muted-foreground/70">Estado civil</Label>
                              <Select
                                value={formData.marital_status}
                                onValueChange={(v) => setFormData((d) => ({ ...d, marital_status: v }))}
                                disabled={!!newlyCreatedClientId}
                              >
                                <SelectTrigger className="bg-muted/10 border-white/5 focus:ring-primary/20">
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                  {MARITAL_STATUS_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </>
                        )}
                      </div>

                      {formData.person_type === 'PF' && (
                        <div className="space-y-2">
                          <Label className="text-xs font-medium uppercase tracking-tight text-muted-foreground/70">Profissão</Label>
                          <Input
                            value={formData.profession}
                            onChange={(e) => setFormData((d) => ({ ...d, profession: e.target.value }))}
                            placeholder="Ex.: Empresário, Aposentado, etc."
                            className="bg-muted/10 border-white/5 focus:ring-primary/20"
                            disabled={!!newlyCreatedClientId}
                          />
                        </div>
                      )}
                    </div>

                    {/* Representative Legal Section for PJ */}
                    {formData.person_type === 'PJ' && (
                      <div className="space-y-4 p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-4 w-1 bg-amber-500 rounded-full" />
                          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Representante Legal</h3>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-medium uppercase tracking-tight text-muted-foreground/70">Nome completo</Label>
                          <Input
                            value={formData.representative_name}
                            onChange={(e) => setFormData((d) => ({ ...d, representative_name: e.target.value }))}
                            placeholder="Nome completo do sócio/administrador"
                            className="bg-muted/10 border-white/5 focus:ring-primary/20"
                            disabled={!!newlyCreatedClientId}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs font-medium uppercase tracking-tight text-muted-foreground/70">CPF</Label>
                            <Input
                              value={formData.representative_cpf}
                              onChange={(e) => setFormData((d) => ({ ...d, representative_cpf: formatCpf(e.target.value) }))}
                              placeholder="000.000.000-00"
                              className="bg-muted/10 border-white/5 focus:ring-primary/20"
                              disabled={!!newlyCreatedClientId}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-medium uppercase tracking-tight text-muted-foreground/70">RG</Label>
                            <Input
                              value={formData.representative_rg}
                              onChange={(e) => setFormData((d) => ({ ...d, representative_rg: e.target.value }))}
                              placeholder="Número do RG"
                              className="bg-muted/10 border-white/5 focus:ring-primary/20"
                              disabled={!!newlyCreatedClientId}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-medium uppercase tracking-tight text-muted-foreground/70">Nacionalidade</Label>
                            <Input
                              value={formData.representative_nationality}
                              onChange={(e) => setFormData((d) => ({ ...d, representative_nationality: e.target.value }))}
                              placeholder="Brasileiro(a)"
                              className="bg-muted/10 border-white/5 focus:ring-primary/20"
                              disabled={!!newlyCreatedClientId}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-medium uppercase tracking-tight text-muted-foreground/70">Estado civil</Label>
                            <Select
                              value={formData.representative_marital_status}
                              onValueChange={(v) => setFormData((d) => ({ ...d, representative_marital_status: v }))}
                              disabled={!!newlyCreatedClientId}
                            >
                              <SelectTrigger className="bg-muted/10 border-white/5 focus:ring-primary/20">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                {MARITAL_STATUS_OPTIONS.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium uppercase tracking-tight text-muted-foreground/70">Profissão</Label>
                          <Input
                            value={formData.representative_profession}
                            onChange={(e) => setFormData((d) => ({ ...d, representative_profession: e.target.value }))}
                            placeholder="Ex.: Empresário, Administrador, etc."
                            className="bg-muted/10 border-white/5 focus:ring-primary/20"
                            disabled={!!newlyCreatedClientId}
                          />
                        </div>
                      </div>
                    )}

                    {/* Contact Section */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-4 w-1 bg-blue-500 rounded-full" />
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Contato</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-medium uppercase tracking-tight text-muted-foreground/70">E-mail</Label>
                          <Input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData((d) => ({ ...d, email: e.target.value }))}
                            placeholder="email@exemplo.com"
                            className="bg-muted/10 border-white/5 focus:ring-primary/20"
                            disabled={!!newlyCreatedClientId}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium uppercase tracking-tight text-muted-foreground/70">Telefone *</Label>
                          <Input
                            value={formData.phone}
                            onChange={(e) => setFormData((d) => ({ ...d, phone: formatPhone(e.target.value) }))}
                            placeholder="(00) 00000-0000"
                            className="bg-muted/10 border-white/5 focus:ring-primary/20"
                            disabled={!!newlyCreatedClientId}
                          />
                          {formErrors.phone && <p className="text-[10px] text-destructive font-medium">{formErrors.phone}</p>}
                        </div>
                      </div>
                    </div>

                    {/* Address Section */}
                    <div className="space-y-4 p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-4 w-1 bg-emerald-500 rounded-full" />
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Endereço</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-medium uppercase tracking-tight text-muted-foreground/70">CEP *</Label>
                          <Input
                            value={cep}
                            onChange={(e) => handleCepChange(e.target.value)}
                            placeholder="00000-000"
                            className="bg-muted/10 border-white/5 focus:ring-primary/20"
                            disabled={loadingCep || !!newlyCreatedClientId}
                          />
                          {formErrors.cep && <p className="text-[10px] text-destructive font-medium">{formErrors.cep}</p>}
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label className="text-xs font-medium uppercase tracking-tight text-muted-foreground/70">Logradouro *</Label>
                          <Input
                            value={street}
                            onChange={(e) => setStreet(e.target.value)}
                            placeholder="Rua, Avenida, etc."
                            className="bg-muted/10 border-white/5 focus:ring-primary/20"
                            disabled={!!newlyCreatedClientId}
                          />
                          {formErrors.address_line && <p className="text-[10px] text-destructive font-medium">{formErrors.address_line}</p>}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-medium uppercase tracking-tight text-muted-foreground/70">Número</Label>
                          <Input
                            value={numberAddress}
                            onChange={(e) => setNumberAddress(e.target.value)}
                            placeholder="Nº"
                            className="bg-muted/10 border-white/5 focus:ring-primary/20"
                            disabled={!!newlyCreatedClientId}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium uppercase tracking-tight text-muted-foreground/70">Bairro *</Label>
                          <Input
                            value={neighborhood}
                            onChange={(e) => setNeighborhood(e.target.value)}
                            placeholder="Bairro"
                            className="bg-muted/10 border-white/5 focus:ring-primary/20"
                            disabled={!!newlyCreatedClientId}
                          />
                          {formErrors.neighborhood && <p className="text-[10px] text-destructive font-medium">{formErrors.neighborhood}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium uppercase tracking-tight text-muted-foreground/70">Cidade *</Label>
                          <Input
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            placeholder="Cidade"
                            className="bg-muted/10 border-white/5 focus:ring-primary/20"
                            disabled={!!newlyCreatedClientId}
                          />
                          {formErrors.city && <p className="text-[10px] text-destructive font-medium">{formErrors.city}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium uppercase tracking-tight text-muted-foreground/70">UF *</Label>
                          <Input
                            value={stateUf}
                            onChange={(e) => setStateUf(e.target.value.toUpperCase().slice(0, 2))}
                            placeholder="UF"
                            maxLength={2}
                            className="bg-muted/10 border-white/5 focus:ring-primary/20"
                            disabled={!!newlyCreatedClientId}
                          />
                          {formErrors.state && <p className="text-[10px] text-destructive font-medium">{formErrors.state}</p>}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-medium uppercase tracking-tight text-muted-foreground/70">Complemento</Label>
                        <Input
                          value={complement}
                          onChange={(e) => setComplement(e.target.value)}
                          placeholder="Apto, Bloco, etc."
                          className="bg-muted/10 border-white/5 focus:ring-primary/20"
                          disabled={!!newlyCreatedClientId}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Data Tab Footer */}
                <div className="glass-footer flex justify-between gap-3 px-6">
                  {!editingClient && !newlyCreatedClientId && (
                    <Button type="button" variant="outline" onClick={() => setActiveTab('scanner')} className="btn-tactile">
                      Voltar
                    </Button>
                  )}
                  {newlyCreatedClientId ? (
                    <Button type="button" onClick={() => setActiveTab('assinatura')} className="ml-auto btn-tactile">
                      Continuar para assinatura
                    </Button>
                  ) : (
                    <Button type="submit" disabled={saving} className="btn-tactile bg-primary hover:bg-primary/90">
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Salvando...
                        </>
                      ) : 'Salvar e Continuar'}
                    </Button>
                  )}
                </div>
              </form>
            </TabsContent>

            {/* Signature Tab */}
            <TabsContent value="assinatura" className="flex-1 min-h-0 data-[state=active]:flex data-[state=active]:flex-col overflow-hidden m-0 p-0">
              <div className="flex-1 overflow-y-auto minimal-scrollbar px-6 py-4">
                <div className="space-y-4 capture-animate-in">
                  {(newlyCreatedClientId || editingClient?.id) && (
                    <ClientSignaturePanel clientId={newlyCreatedClientId || editingClient?.id || ''} />
                  )}

                  {!editingClient && newlyCreatedClientId && (
                    <div className="flex items-center space-x-3 mt-6 p-4 bg-primary/5 border border-primary/10 rounded-xl">
                      <Checkbox
                        id="createDocsCheckbox"
                        checked={createInitialDocs}
                        onCheckedChange={(v) => setCreateInitialDocs(v === true)}
                        className="border-primary/20"
                      />
                      <Label htmlFor="createDocsCheckbox" className="text-sm font-medium cursor-pointer text-primary/80">
                        Gerar kit inicial de documentos (procuração, contrato, etc.)
                      </Label>
                    </div>
                  )}
                </div>
              </div>

              <div className="glass-footer flex justify-between gap-3 px-6">
                <Button type="button" variant="outline" onClick={() => setActiveTab('dados')} className="btn-tactile">
                  Voltar
                </Button>
                <Button type="button" onClick={handleFinalize} className="btn-tactile bg-primary hover:bg-primary/90">
                  Finalizar{createInitialDocs ? ' e gerar kit' : ''}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent >
      </Dialog >

      {/* Dialog de regeneração do kit com formulário de honorários */}
      < KitFormDialog
        open={showRegenerateKitDialog}
        onOpenChange={(open) => {
          if (!open && !regeneratingKit) {
            handleSkipRegeneration();
          }
        }
        }
        kitAnswers={kitAnswers}
        setKitAnswers={setKitAnswers}
        loading={regeneratingKit}
        onConfirm={handleRegenerateKit}
        title="Atualizar Kit de Documentos"
        description="Os dados do cliente foram atualizados. Preencha os dados de honorários para regenerar o kit com as novas informações."
        confirmLabel="Regenerar kit"
      />

      {/* Dialog de criação do kit inicial com formulário de honorários */}
      < KitFormDialog
        open={showInitialKitDialog}
        onOpenChange={(open) => {
          if (!open && !creatingInitialKit) {
            handleSkipInitialKit();
          }
        }}
        kitAnswers={kitAnswers}
        setKitAnswers={setKitAnswers}
        loading={creatingInitialKit}
        onConfirm={handleConfirmInitialKit}
        title="Dados do Contrato de Honorários"
        description="Preencha os dados de honorários para gerar a procuração, declaração e contrato do cliente."
        confirmLabel="Gerar kit"
      />

      {/* NEW: Modal de configuração de contrato (fluxo limpo) */}
      {
        newlyCreatedClientId && (
          <ContractSetupModal
            open={showContractModal}
            onOpenChange={setShowContractModal}
            clientId={newlyCreatedClientId}
            clientName={formData.full_name}
            onSuccess={() => {
              // Fechar diálogo principal após sucesso do contrato
              setTimeout(() => {
                onClose();
                resetForm();
              }, 500);
            }}
          />
        )
      }
    </>
  );
}
