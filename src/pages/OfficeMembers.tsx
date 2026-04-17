import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { 
  Users, UserPlus, Shield, Crown, User, Trash2, Pencil, 
  ArrowLeft, Copy, MessageCircle, Clock, X, Send, Link2, RefreshCw, FileUser
} from 'lucide-react';
import { APP_BASE_URL } from '@/lib/config';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MemberProfileDialog } from '@/components/MemberProfileDialog';

type OfficeRole = 'OWNER' | 'ADMIN' | 'MEMBER';

interface OfficeMember {
  id: string;
  user_id: string;
  role: OfficeRole;
  is_active: boolean;
  created_at: string;
  email?: string;
  // Professional profile fields
  full_name: string | null;
  profession: string | null;
  oab_number: string | null;
  oab_uf: string | null;
  cpf: string | null;
}

interface OfficeInvite {
  id: string;
  token: string;
  email: string | null;
  phone: string | null;
  role: string;
  expires_at: string;
  created_at: string;
}

const ROLE_CONFIG: Record<OfficeRole, { label: string; icon: React.ElementType; color: string; description: string }> = {
  OWNER: { 
    label: 'Proprietário', 
    icon: Crown, 
    color: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    description: 'Acesso total, gestão financeira e posse do escritório.'
  },
  ADMIN: { 
    label: 'Administrador', 
    icon: Shield, 
    color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    description: 'Gerencia membros da equipe, configurações e agentes de IA.'
  },
  MEMBER: { 
    label: 'Membro', 
    icon: User, 
    color: 'bg-muted text-muted-foreground border-border',
    description: 'Acesso básico a clientes, casos, agenda e ferramentas jurídicas.'
  },
};

export default function OfficeMembers() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [members, setMembers] = useState<OfficeMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<OfficeInvite[]>([]);
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [officeName, setOfficeName] = useState<string>('');
  const [currentUserRole, setCurrentUserRole] = useState<OfficeRole | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Dialog states
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteRole, setInviteRole] = useState<OfficeRole>('MEMBER');
  const [isInviting, setIsInviting] = useState(false);
  
  // Invite result dialog
  const [inviteResult, setInviteResult] = useState<{ token: string; link: string } | null>(null);
  
  // Edit dialog
  const [editingMember, setEditingMember] = useState<OfficeMember | null>(null);
  const [editRole, setEditRole] = useState<OfficeRole>('MEMBER');
  
  // Profile dialog
  const [profileMemberId, setProfileMemberId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  // Realtime subscription for auto-refresh
  useEffect(() => {
    if (!officeId) return;

    const channel = supabase
      .channel('office-members-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'office_invites', filter: `office_id=eq.${officeId}` },
        () => loadData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'office_members', filter: `office_id=eq.${officeId}` },
        () => loadData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [officeId]);


  const loadData = async () => {
    setLoading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }
      setCurrentUserId(user.id);

      // Get office context
      const { data: healthRaw } = await supabase.rpc('lexos_healthcheck_session');
      const healthArr = healthRaw as Array<{ ok: boolean; office_id: string; role: string }> | null;
      const health = healthArr?.[0] ?? null;

      if (!health?.ok || !health.office_id) {
        toast.error('Sem escritório ativo');
        navigate('/meu-escritorio');
        return;
      }

      setOfficeId(health.office_id);
      setCurrentUserRole(health.role as OfficeRole);

      // Get office name
      const { data: officeData } = await supabase
        .from('offices')
        .select('name')
        .eq('id', health.office_id)
        .single();
      
      if (officeData) {
        setOfficeName(officeData.name);
      }

      if (health.role !== 'OWNER' && health.role !== 'ADMIN') {
        toast.error('Acesso negado. Apenas OWNER ou ADMIN podem gerenciar membros.');
        navigate('/dashboard');
        return;
      }

      // Fetch members with professional profile fields and persisted email
      const { data: membersData, error: membersError } = await supabase
        .from('office_members')
        .select('id, user_id, role, is_active, created_at, full_name, email, profession, oab_number, oab_uf, cpf')
        .eq('office_id', health.office_id)
        .order('created_at', { ascending: true });

      if (membersError) throw membersError;

      const membersWithEmail: OfficeMember[] = (membersData || []).map(m => ({
        ...m,
        role: m.role as OfficeRole,
        email: m.email ?? undefined,
        full_name: m.full_name ?? null,
        profession: m.profession ?? null,
        oab_number: m.oab_number ?? null,
        oab_uf: m.oab_uf ?? null,
        cpf: m.cpf ?? null,
      }));

      setMembers(membersWithEmail);

      // Fetch pending invites
      const { data: invitesData } = await supabase
        .from('office_invites')
        .select('id, token, email, phone, role, expires_at, created_at')
        .eq('office_id', health.office_id)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      setPendingInvites(invitesData || []);
    } catch (error) {
      console.error('Error loading members:', error);
      toast.error('Erro ao carregar membros');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!officeId || !currentUserId) return;

    setIsInviting(true);
    try {
      const { data, error } = await supabase
        .from('office_invites')
        .insert({
          office_id: officeId,
          email: inviteEmail.trim() || null,
          phone: invitePhone.trim() || null,
          role: inviteRole === 'OWNER' ? 'ADMIN' : inviteRole, // Prevent OWNER invites
          invited_by: currentUserId,
        })
        .select('token')
        .single();

      if (error) throw error;

      const inviteLink = `${APP_BASE_URL}/signup?invite=${data.token}`;
      
      setInviteResult({ token: data.token, link: inviteLink });
      setIsInviteOpen(false);
      setInviteEmail('');
      setInvitePhone('');
      setInviteRole('MEMBER');
      
      loadData(); // Refresh to show new invite
    } catch (error) {
      console.error('Error creating invite:', error);
      toast.error('Erro ao criar convite');
    } finally {
      setIsInviting(false);
    }
  };

  const handleCopyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Link copiado!');
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const handleSendWhatsApp = (link: string) => {
    const message = encodeURIComponent(
      `Olá! Você foi convidado para fazer parte do escritório ${officeName} no Lexos. Acesse o link para aceitar o convite:\n\n${link}`
    );
    const whatsappUrl = invitePhone 
      ? `https://wa.me/${invitePhone.replace(/\D/g, '')}?text=${message}`
      : `https://wa.me/?text=${message}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      const { error } = await supabase
        .from('office_invites')
        .delete()
        .eq('id', inviteId);

      if (error) throw error;

      toast.success('Convite cancelado');
      loadData();
    } catch (error) {
      console.error('Error canceling invite:', error);
      toast.error('Erro ao cancelar convite');
    }
  };

  const handleUpdateRole = async () => {
    if (!editingMember || !officeId) return;

    if (editingMember.role === 'OWNER' && currentUserRole !== 'OWNER') {
      toast.error('Apenas o OWNER pode alterar outro OWNER');
      return;
    }

    if (editRole === 'OWNER' && currentUserRole !== 'OWNER') {
      toast.error('Apenas o OWNER pode promover outro usuário a OWNER');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('office_members')
        .update({ role: editRole })
        .eq('id', editingMember.id);

      if (error) throw error;

      toast.success('Role atualizado com sucesso');
      setEditingMember(null);
      loadData();
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Erro ao atualizar role');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (member: OfficeMember) => {
    if (member.user_id === currentUserId) {
      toast.error('Você não pode desativar a si mesmo');
      return;
    }

    if (member.role === 'OWNER' && currentUserRole !== 'OWNER') {
      toast.error('Apenas o OWNER pode desativar outro OWNER');
      return;
    }

    try {
      const { error } = await supabase
        .from('office_members')
        .update({ is_active: !member.is_active })
        .eq('id', member.id);

      if (error) throw error;

      toast.success(member.is_active ? 'Membro desativado' : 'Membro ativado');
      loadData();
    } catch (error) {
      console.error('Error toggling member:', error);
      toast.error('Erro ao alterar status do membro');
    }
  };

  const handleRemoveMember = async (member: OfficeMember) => {
    if (member.user_id === currentUserId) {
      toast.error('Você não pode remover a si mesmo');
      return;
    }

    if (member.role === 'OWNER') {
      toast.error('Não é possível remover o OWNER do escritório');
      return;
    }

    try {
      const { error } = await supabase
        .from('office_members')
        .delete()
        .eq('id', member.id);

      if (error) throw error;

      toast.success('Membro removido com sucesso');
      loadData();
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Erro ao remover membro');
    }
  };

  const canEditMember = (member: OfficeMember): boolean => {
    if (member.user_id === currentUserId) return false;
    if (currentUserRole === 'OWNER') return true;
    if (currentUserRole === 'ADMIN' && member.role === 'MEMBER') return true;
    return false;
  };

  const canRemoveMember = (member: OfficeMember): boolean => {
    if (member.user_id === currentUserId) return false;
    if (member.role === 'OWNER') return false;
    if (currentUserRole === 'OWNER') return true;
    if (currentUserRole === 'ADMIN' && member.role === 'MEMBER') return true;
    return false;
  };

  const getRoleBadge = (role: OfficeRole | string) => {
    const config = ROLE_CONFIG[role as OfficeRole] || ROLE_CONFIG.MEMBER;
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={`gap-1 ${config.color}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/meu-escritorio')}
        className="gap-2 text-muted-foreground hover:text-foreground -ml-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Button>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-widest">
            Gestão de Equipe
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
            Membros do Escritório
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-md">
            Controle de acesso e permissões da equipe. Cada membro possui um nível de autorização que define suas capacidades no sistema.
          </p>
          
          {/* Stats inline */}
          <div className="flex items-center gap-4 pt-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{members.filter(m => m.is_active).length}</span> ativos
              </span>
            </div>
            {members.filter(m => !m.is_active).length > 0 && (
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                <span className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{members.filter(m => !m.is_active).length}</span> inativos
                </span>
              </div>
            )}
            {pendingInvites.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{pendingInvites.length}</span> convite{pendingInvites.length !== 1 ? 's' : ''} pendente{pendingInvites.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => {
              setRefreshing(true);
              loadData().finally(() => setRefreshing(false));
            }} 
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-sm" size="lg">
                <UserPlus className="h-4 w-4" />
                Convidar Membro
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">Convidar para {officeName || 'Equipe'}</DialogTitle>
              <DialogDescription className="text-sm">
                Gere um link de convite para adicionar um novo membro ao escritório.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
                  E-mail <span className="text-muted-foreground/50">(opcional)</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
                  WhatsApp <span className="text-muted-foreground/50">(opcional)</span>
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+55 11 99999-9999"
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
                  Nível de Permissão
                </Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as OfficeRole)}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MEMBER">Membro</SelectItem>
                    <SelectItem value="ADMIN">Administrador</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground/70 mt-1">
                  {ROLE_CONFIG[inviteRole].description}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsInviteOpen(false)} className="text-muted-foreground">
                Cancelar
              </Button>
              <Button onClick={handleInvite} disabled={isInviting} className="shadow-sm">
                {isInviting ? 'Gerando...' : 'Gerar Convite'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>
      {/* Invite Result Dialog */}
      <Dialog open={!!inviteResult} onOpenChange={(open) => !open && setInviteResult(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              Convite Criado!
            </DialogTitle>
            <DialogDescription className="text-sm">
              Compartilhe o link abaixo com o novo membro. O convite expira em 7 dias.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <Input
                value={inviteResult?.link || ''}
                readOnly
                className="h-10 text-xs font-mono bg-muted/50"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={() => inviteResult && handleCopyLink(inviteResult.link)}
                className="shrink-0"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => inviteResult && handleCopyLink(inviteResult.link)}
              >
                <Copy className="h-4 w-4" />
                Copiar Link
              </Button>
              <Button
                className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => inviteResult && handleSendWhatsApp(inviteResult.link)}
              >
                <MessageCircle className="h-4 w-4" />
                Enviar via WhatsApp
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInviteResult(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-amber-500/20">
                <Send className="h-3.5 w-3.5 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold uppercase tracking-wide text-foreground/90">
                  Convites Pendentes
                </CardTitle>
                <CardDescription className="text-xs">
                  {pendingInvites.length} convite{pendingInvites.length !== 1 ? 's' : ''} aguardando aceite
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border/50 bg-background"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {invite.email || invite.phone || 'Sem identificação'}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Expira em {format(new Date(invite.expires_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getRoleBadge(invite.role)}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => handleCopyLink(`${APP_BASE_URL}/signup?invite=${invite.token}`)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                      onClick={() => handleSendWhatsApp(`${APP_BASE_URL}/signup?invite=${invite.token}`)}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancelar Convite</AlertDialogTitle>
                          <AlertDialogDescription>
                            O link de convite será invalidado e não poderá mais ser usado.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Manter</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => handleCancelInvite(invite.id)}
                          >
                            Cancelar Convite
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Members Table */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-muted/80">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-foreground/90">
                Equipe do Escritório
              </CardTitle>
              <CardDescription className="text-xs">
                {members.length} colaborador{members.length !== 1 ? 'es' : ''} cadastrado{members.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-12">
              <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <Users className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Nenhum membro encontrado</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Convide colaboradores para começar</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                        Colaborador
                      </TableHead>
                      <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                        Perfil
                      </TableHead>
                      <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                        Permissão
                      </TableHead>
                      <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                        Acesso
                      </TableHead>
                      <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                        Membro Desde
                      </TableHead>
                      <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                        Ações
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.id} className={!member.is_active ? 'opacity-50 bg-muted/20' : ''}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center border border-border/50">
                              <User className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                              <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                                {member.user_id === currentUserId ? (
                                  <>
                                    Você
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-primary/5 border-primary/20 text-primary">
                                      Atual
                                    </Badge>
                                  </>
                                ) : (
                                  member.email || 'Colaborador'
                                )}
                              </div>
                              <div className="text-[10px] text-muted-foreground/60 font-mono tracking-tight mt-0.5">
                                ID: {member.user_id.slice(0, 8)}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {member.full_name ? (
                              <>
                                <span className="text-sm font-medium text-foreground/80 truncate max-w-[100px]">
                                  {member.full_name.split(' ')[0]}
                                </span>
                                {member.profession === 'Advogado' && member.oab_number && member.oab_uf ? (
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-primary/5 border-primary/20 text-primary font-mono">
                                    OAB/{member.oab_uf} {member.oab_number}
                                  </Badge>
                                ) : member.profession ? (
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-muted/50 border-border text-muted-foreground">
                                    {member.profession}
                                  </Badge>
                                ) : null}
                              </>
                            ) : (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-amber-500/10 border-amber-500/30 text-amber-600">
                                Incompleto
                              </Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => setProfileMemberId(member.id)}
                              title="Editar perfil profissional"
                            >
                              <FileUser className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>{getRoleBadge(member.role)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <Switch
                              checked={member.is_active}
                              onCheckedChange={() => handleToggleActive(member)}
                              disabled={member.user_id === currentUserId || (member.role === 'OWNER' && currentUserRole !== 'OWNER')}
                            />
                            <div className="flex items-center gap-1.5">
                              <div className={`h-1.5 w-1.5 rounded-full ${member.is_active ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
                              <span className={`text-xs font-medium ${member.is_active ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                                {member.is_active ? 'Ativo' : 'Suspenso'}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium text-foreground/80">
                            {format(new Date(member.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {canEditMember(member) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                  setEditingMember(member);
                                  setEditRole(member.role);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {canRemoveMember(member) && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="text-lg font-semibold">Remover Colaborador</AlertDialogTitle>
                                    <AlertDialogDescription className="text-sm">
                                      Esta ação removerá permanentemente o acesso deste colaborador ao escritório. Dados criados por ele serão mantidos.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="text-muted-foreground">Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      onClick={() => handleRemoveMember(member)}
                                    >
                                      Remover Acesso
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card List */}
              <div className="grid grid-cols-1 gap-4 md:hidden">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className={`p-4 rounded-xl border border-border/50 space-y-4 shadow-sm bg-card/50 transition-all ${
                      !member.is_active ? 'opacity-60 grayscale' : ''
                    }`}
                  >
                    {/* Card Header: Avatar + Info */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center border border-primary/20 shadow-inner">
                          <User className="h-5 w-5 text-primary/70" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-foreground flex items-center gap-1.5 flex-wrap">
                            {member.user_id === currentUserId ? 'Você' : member.email || 'Colaborador'}
                            {member.user_id === currentUserId && (
                              <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 bg-primary/5 border-primary/20 text-primary">
                                Atual
                              </Badge>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            ID: {member.user_id.slice(0, 8)}
                          </div>
                        </div>
                      </div>
                      {getRoleBadge(member.role)}
                    </div>

                    {/* Card Profile Section */}
                    <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/30">
                      {member.full_name ? (
                        <span className="text-xs font-semibold text-foreground/80">
                          {member.full_name}
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-600 font-medium">Perfil incompleto</span>
                      )}
                      
                      {member.profession === 'Advogado' && member.oab_number && (
                        <Badge variant="outline" className="text-[9px] h-4 bg-primary/5 border-primary/20 text-primary font-mono ml-auto">
                          OAB/{member.oab_uf} {member.oab_number}
                        </Badge>
                      )}
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground ml-auto"
                        onClick={() => setProfileMemberId(member.id)}
                      >
                        <FileUser className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Card Controls */}
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-tight">Status de Acesso</span>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={member.is_active}
                            onCheckedChange={() => handleToggleActive(member)}
                            disabled={member.user_id === currentUserId || (member.role === 'OWNER' && currentUserRole !== 'OWNER')}
                          />
                          <span className={`text-[11px] font-bold ${member.is_active ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                            {member.is_active ? 'ATIVO' : 'SUSPENSO'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-tight block">Membro desde</span>
                        <span className="text-xs font-medium">{format(new Date(member.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="flex gap-2 pt-2 border-t border-border/30">
                      {canEditMember(member) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-9 gap-2 text-xs font-semibold shadow-sm"
                          onClick={() => {
                            setEditingMember(member);
                            setEditRole(member.role);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Permissões
                        </Button>
                      )}
                      
                      {canRemoveMember(member) && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="flex-1 h-9 gap-2 text-xs font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive shadow-sm">
                              <Trash2 className="h-3.5 w-3.5" />
                              Remover
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="w-[95vw] rounded-2xl">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover Acesso?</AlertDialogTitle>
                              <AlertDialogDescription className="text-sm">
                                Esta ação removerá o acesso deste colaborador ao escritório. Os dados dele serão preservados.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-4">
                              <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="w-full sm:w-auto bg-destructive text-white hover:bg-destructive/90"
                                onClick={() => handleRemoveMember(member)}
                              >
                                Confirmar Remoção
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Role Dialog */}
      <Dialog open={!!editingMember} onOpenChange={(open) => !open && setEditingMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Alterar Permissão</DialogTitle>
            <DialogDescription className="text-sm">
              Defina o nível de acesso e responsabilidades deste colaborador.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
                Nível de Permissão
              </Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as OfficeRole)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEMBER">Membro</SelectItem>
                  <SelectItem value="ADMIN">Administrador</SelectItem>
                  {currentUserRole === 'OWNER' && (
                    <SelectItem value="OWNER">Proprietário</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground/70 mt-1">
                {ROLE_CONFIG[editRole].description}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingMember(null)} className="text-muted-foreground">
              Cancelar
            </Button>
            <Button onClick={handleUpdateRole} disabled={isSaving} className="shadow-sm">
              {isSaving ? 'Salvando...' : 'Salvar Alteração'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Legend */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-muted/80">
              <Shield className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-foreground/90">
                Níveis de Permissão
              </CardTitle>
              <CardDescription className="text-xs">
                Entenda as responsabilidades e capacidades de cada nível de acesso
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {(['OWNER', 'ADMIN', 'MEMBER'] as OfficeRole[]).map((role) => {
              const config = ROLE_CONFIG[role];
              const Icon = config.icon;
              return (
                <div key={role} className="flex flex-col gap-3 p-4 rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/20">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-md ${config.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="font-semibold text-sm text-foreground">{config.label}</div>
                  </div>
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    {config.description}
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border/30">
            <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
              <span className="font-semibold text-muted-foreground">Nota de segurança:</span> Alterações de permissão são registradas no log de auditoria. Membros inativos perdem acesso imediato ao sistema, mas seus dados históricos são preservados.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Member Profile Dialog */}
      <MemberProfileDialog
        open={!!profileMemberId}
        onOpenChange={(open) => !open && setProfileMemberId(null)}
        memberId={profileMemberId}
        onSaved={() => loadData()}
      />
    </div>
  );
}
