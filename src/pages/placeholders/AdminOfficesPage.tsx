import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { TableEmptyState } from "@/components/ui/table-empty-state";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Building2, Search, Users, FileText, Calendar, RefreshCw, Link2, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OfficeStats {
  office_id: string;
  office_name: string;
  slug: string;
  created_at: string;
  member_count: number;
  client_count: number;
  case_count: number;
  document_count: number;
}

export default function AdminOfficesPage() {
  const [offices, setOffices] = useState<OfficeStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchOffices = async () => {
    setLoading(true);
    try {
      // Buscar escritórios com contagens
      const { data: officeData, error } = await supabase
        .from("offices")
        .select("id, name, slug, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Para cada escritório, buscar contagens
      const officesWithStats = await Promise.all(
        (officeData || []).map(async (office) => {
          const [membersRes, clientsRes, casesRes, docsRes] = await Promise.all([
            supabase.from("office_members").select("id", { count: "exact", head: true }).eq("office_id", office.id),
            supabase.from("clients").select("id", { count: "exact", head: true }).eq("office_id", office.id).is("archived_at", null),
            supabase.from("cases").select("id", { count: "exact", head: true }).eq("office_id", office.id),
            supabase.from("documents").select("id", { count: "exact", head: true }).eq("office_id", office.id).is("deleted_at", null),
          ]);

          return {
            office_id: office.id,
            office_name: office.name,
            slug: office.slug,
            created_at: office.created_at,
            member_count: membersRes.count || 0,
            client_count: clientsRes.count || 0,
            case_count: casesRes.count || 0,
            document_count: docsRes.count || 0,
          };
        })
      );

      setOffices(officesWithStats);
    } catch (err) {
      console.error("Error fetching offices:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffices();
  }, []);

  const filteredOffices = offices.filter(office => {
    const search = searchTerm.toLowerCase();
    return (
      office.office_name?.toLowerCase().includes(search) ||
      office.slug?.toLowerCase().includes(search)
    );
  });

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return "—";
    }
  };

  const totalMembers = offices.reduce((sum, o) => sum + o.member_count, 0);
  const totalClients = offices.reduce((sum, o) => sum + o.client_count, 0);
  const totalCases = offices.reduce((sum, o) => sum + o.case_count, 0);
  const totalDocs = offices.reduce((sum, o) => sum + o.document_count, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Escritórios
          </h1>
          <p className="text-muted-foreground mt-1">
            Visão geral de todos os escritórios da plataforma
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchOffices} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Escritórios</p>
                <p className="text-2xl font-bold">{offices.length}</p>
              </div>
              <Building2 className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Membros</p>
                <p className="text-2xl font-bold">{totalMembers}</p>
              </div>
              <Users className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Clientes</p>
                <p className="text-2xl font-bold">{totalClients}</p>
              </div>
              <Users className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Casos</p>
                <p className="text-2xl font-bold">{totalCases}</p>
              </div>
              <Briefcase className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Documentos</p>
                <p className="text-2xl font-bold">{totalDocs}</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Lista de Escritórios</CardTitle>
              <CardDescription>
                Todos os escritórios cadastrados com suas métricas
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou slug..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton columns={7} rows={5} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Escritório</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead className="text-center">Membros</TableHead>
                  <TableHead className="text-center">Clientes</TableHead>
                  <TableHead className="text-center">Casos</TableHead>
                  <TableHead className="text-center">Documentos</TableHead>
                  <TableHead>Criado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOffices.length === 0 ? (
                  <TableEmptyState
                    colSpan={7}
                    message={searchTerm ? "Nenhum escritório encontrado para a busca" : "Nenhum escritório cadastrado"}
                  />
                ) : (
                  filteredOffices.map((office) => (
                    <TableRow key={office.office_id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {office.office_name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {office.slug}
                          </code>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{office.member_count}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{office.client_count}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{office.case_count}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{office.document_count}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(office.created_at)}
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
    </div>
  );
}
