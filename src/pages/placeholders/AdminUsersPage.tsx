import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { TableEmptyState } from "@/components/ui/table-empty-state";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Users, Search, Building2, Mail, Calendar, Clock, Shield, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SystemUser {
  user_id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  full_name: string | null;
  role: string | null;
  office_name: string | null;
  office_id: string | null;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Buscar office_members (visível para OWNER/ADMIN via RLS)
      const { data: members, error } = await supabase
        .from("office_members")
        .select(`
          user_id,
          full_name,
          role,
          created_at,
          email,
          offices:office_id (id, name)
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching members:", error);
        setUsers([]);
      } else if (members) {
        setUsers(members.map((m: any) => ({
          user_id: m.user_id,
          email: m.email || "",
          created_at: m.created_at,
          last_sign_in_at: null,
          full_name: m.full_name,
          role: m.role,
          office_name: m.offices?.name || null,
          office_id: m.offices?.id || null,
        })));
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(user => {
    const search = searchTerm.toLowerCase();
    return (
      user.email?.toLowerCase().includes(search) ||
      user.full_name?.toLowerCase().includes(search) ||
      user.office_name?.toLowerCase().includes(search)
    );
  });

  const getRoleBadge = (role: string | null) => {
    switch (role?.toUpperCase()) {
      case "OWNER":
        return <Badge className="bg-amber-600 hover:bg-amber-700">OWNER</Badge>;
      case "ADMIN":
        return <Badge className="bg-blue-600 hover:bg-blue-700">ADMIN</Badge>;
      case "MEMBER":
        return <Badge variant="secondary">MEMBER</Badge>;
      default:
        return <Badge variant="outline">Sem vínculo</Badge>;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return "—";
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Usuários do Sistema
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie todos os usuários cadastrados na plataforma
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Lista de Usuários</CardTitle>
              <CardDescription>
                {users.length} usuários encontrados
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton columns={5} rows={8} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Escritório</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Cadastro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableEmptyState
                    colSpan={5}
                    message={searchTerm ? "Nenhum usuário encontrado para a busca" : "Nenhum usuário cadastrado"}
                  />
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.user_id}>
                      <TableCell className="font-medium">
                        {user.full_name || (
                          <span className="text-muted-foreground italic">Sem nome</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          {user.email || "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.office_name ? (
                          <div className="flex items-center gap-2">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            {user.office_name}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(user.created_at)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Usuários</p>
                <p className="text-2xl font-bold">{users.length}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Owners</p>
                <p className="text-2xl font-bold text-amber-600">
                  {users.filter(u => u.role?.toUpperCase() === "OWNER").length}
                </p>
              </div>
              <Shield className="h-8 w-8 text-amber-600/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Admins</p>
                <p className="text-2xl font-bold text-blue-600">
                  {users.filter(u => u.role?.toUpperCase() === "ADMIN").length}
                </p>
              </div>
              <Shield className="h-8 w-8 text-blue-600/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Membros</p>
                <p className="text-2xl font-bold">
                  {users.filter(u => u.role?.toUpperCase() === "MEMBER").length}
                </p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
