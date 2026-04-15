import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FileType, Plus, Pencil, Trash2, Loader2, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DocumentType {
  id: string;
  name: string | null;
  code: string | null;
  is_active: boolean | null;
  office_id: string | null;
}

interface TypePermission {
  id?: string;
  type_id: string | null;
  role: string | null;
  can_view: boolean | null;
  can_upload: boolean | null;
  can_download: boolean | null;
  can_delete: boolean | null;
}

interface TypePermission {
  id?: string;
  type_id: string | null;
  role: string | null;
  can_view: boolean | null;
  can_upload: boolean | null;
  can_download: boolean | null;
  can_delete: boolean | null;
}

const ROLES = ['owner', 'admin', 'member'] as const;

export default function DocumentTypes() {
  const { toast } = useToast();
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<DocumentType | null>(null);
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Permissions modal
  const [permModalOpen, setPermModalOpen] = useState(false);
  const [permType, setPermType] = useState<DocumentType | null>(null);
  const [permissions, setPermissions] = useState<TypePermission[]>([]);
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [savingPerms, setSavingPerms] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: memberData, error: memberError } = await supabase
        .from('office_members')
        .select('office_id, role')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (memberError || !memberData) {
        if (import.meta.env.DEV) console.log('[DocumentTypes] No office member record yet. Hooks might still be provisioning.');
        setLoading(false);
        return;
      }

      setOfficeId(memberData.office_id);
      setUserRole(memberData.role);

      if (!['admin', 'owner'].includes(memberData.role?.toLowerCase())) {
        toast({ title: 'Acesso negado', description: 'Apenas administradores podem acessar esta página.', variant: 'destructive' });
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('document_types')
        .select('*')
        .eq('office_id', memberData.office_id)
        .order('name', { ascending: true });

      if (error) throw error;
      setDocTypes(data || []);
    } catch (err: any) {
      console.error('Fetch error:', err);
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingType(null);
    setFormName('');
    setFormCode('');
    setFormActive(true);
    setModalOpen(true);
  };

  const openEditModal = (type: DocumentType) => {
    setEditingType(type);
    setFormName(type.name);
    setFormCode(type.code || '');
    setFormActive(type.is_active);
    setModalOpen(true);
  };

  const handleSaveType = async () => {
    if (!formName.trim()) {
      toast({ title: 'Erro', description: 'Nome é obrigatório.', variant: 'destructive' });
      return;
    }
    if (!officeId) return;

    setSaving(true);
    try {
      if (editingType) {
        const { error } = await supabase
          .from('document_types')
          .update({ name: formName.trim(), code: formCode.trim() || null, is_active: formActive })
          .eq('id', editingType.id);
        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Tipo atualizado.' });
      } else {
        const { error } = await supabase
          .from('document_types')
          .insert({ name: formName.trim(), code: formCode.trim() || null, is_active: formActive, office_id: officeId });
        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Tipo criado.' });
      }
      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteType = async (type: DocumentType) => {
    if (!confirm(`Excluir o tipo "${type.name}"?`)) return;
    try {
      const { error } = await supabase.from('document_types').delete().eq('id', type.id);
      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Tipo excluído.' });
      fetchData();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const openPermissionsModal = async (type: DocumentType) => {
    setPermType(type);
    setPermModalOpen(true);
    setLoadingPerms(true);

    try {
      const { data, error } = await supabase
        .from('document_type_permissions')
        .select('*')
        .eq('type_id', type.id);

      if (error) throw error;

      // Build permission state for all roles
      const permsMap: Record<string, TypePermission> = {};
      ROLES.forEach((role) => {
        const existing = data?.find((p) => p.role === role);
        permsMap[role] = existing || {
          type_id: type.id,
          role,
          can_view: true,
          can_upload: true,
          can_download: true,
          can_delete: false,
        };
      });

      setPermissions(Object.values(permsMap));
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setLoadingPerms(false);
    }
  };

  const togglePermission = (role: string, field: keyof TypePermission) => {
    setPermissions((prev) =>
      prev.map((p) => (p.role === role ? { ...p, [field]: !p[field] } : p))
    );
  };

  const savePermissions = async () => {
    if (!permType || !officeId) return;
    setSavingPerms(true);

    try {
      for (const perm of permissions) {
        const { error } = await supabase
          .from('document_type_permissions')
          .upsert(
            {
              type_id: permType.id,
              office_id: officeId,
              role: perm.role,
              can_view: perm.can_view,
              can_upload: perm.can_upload,
              can_download: perm.can_download,
              can_delete: perm.can_delete,
            },
            { onConflict: 'type_id,role' }
          );
        if (error) throw error;
      }
      toast({ title: 'Sucesso', description: 'Permissões salvas.' });
      setPermModalOpen(false);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSavingPerms(false);
    }
  };

  const isAdmin = userRole === 'OWNER' || userRole === 'ADMIN';

  if (!isAdmin && !loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <p className="text-muted-foreground">Acesso restrito a administradores.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileType className="h-6 w-6" />
            Tipos de Documento
          </h1>
          <Button onClick={openCreateModal}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Tipo
          </Button>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : docTypes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhum tipo de documento cadastrado.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docTypes.map((type) => (
                    <TableRow key={type.id}>
                      <TableCell className="font-medium">{type.name}</TableCell>
                      <TableCell>{type.code || '-'}</TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-1 rounded ${type.is_active ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                          {type.is_active ? 'Sim' : 'Não'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openPermissionsModal(type)} title="Permissões">
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEditModal(type)} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteType(type)} title="Excluir">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingType ? 'Editar Tipo' : 'Novo Tipo de Documento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="type-name">Nome *</Label>
              <Input id="type-name" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ex: Contrato de Honorários" />
            </div>
            <div>
              <Label htmlFor="type-code">Código</Label>
              <Input id="type-code" value={formCode} onChange={(e) => setFormCode(e.target.value)} placeholder="Ex: CONTR-HON" />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="type-active" checked={formActive} onCheckedChange={setFormActive} />
              <Label htmlFor="type-active">Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveType} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permissions Modal */}
      <Dialog open={permModalOpen} onOpenChange={setPermModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Permissões: {permType?.name}</DialogTitle>
          </DialogHeader>
          {loadingPerms ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="py-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Papel</TableHead>
                    <TableHead className="text-center">Ver</TableHead>
                    <TableHead className="text-center">Upload</TableHead>
                    <TableHead className="text-center">Download</TableHead>
                    <TableHead className="text-center">Excluir</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permissions.map((perm) => (
                    <TableRow key={perm.role}>
                      <TableCell className="capitalize">{perm.role}</TableCell>
                      <TableCell className="text-center">
                        <Switch checked={perm.can_view} onCheckedChange={() => togglePermission(perm.role, 'can_view')} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch checked={perm.can_upload} onCheckedChange={() => togglePermission(perm.role, 'can_upload')} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch checked={perm.can_download} onCheckedChange={() => togglePermission(perm.role, 'can_download')} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch checked={perm.can_delete} onCheckedChange={() => togglePermission(perm.role, 'can_delete')} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermModalOpen(false)}>Cancelar</Button>
            <Button onClick={savePermissions} disabled={savingPerms}>
              {savingPerms && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar Permissões
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
