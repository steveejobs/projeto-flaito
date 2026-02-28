import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Phone, MapPin, Briefcase } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Client = Tables<"clients">;

type Props = {
  client: Client;
};

function formatDocument(client: Client): string {
  if (client.person_type === "PF") {
    return client.cpf || "—";
  }
  return client.cnpj || "—";
}

export function ClientDataPanel({ client }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Informações do Cliente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <span className="text-muted-foreground">Nome:</span>
            <p className="font-medium">{client.full_name}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Tipo:</span>
            <p className="font-medium">
              {client.person_type === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">
              {client.person_type === "PF" ? "CPF:" : "CNPJ:"}
            </span>
            <p className="font-medium">{formatDocument(client)}</p>
          </div>
          {client.rg && (
            <div>
              <span className="text-muted-foreground">RG:</span>
              <p className="font-medium">
                {client.rg}
                {client.rg_issuer && ` - ${client.rg_issuer}`}
              </p>
            </div>
          )}
        </div>

        {/* Contact */}
        <div className="pt-2 border-t border-border">
          <h4 className="text-xs font-medium text-muted-foreground mb-2">CONTATO</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {client.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{client.email}</span>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{client.phone}</span>
              </div>
            )}
            {!client.email && !client.phone && (
              <p className="text-muted-foreground">Nenhum contato cadastrado</p>
            )}
          </div>
        </div>

        {/* Address */}
        {client.address_line && (
          <div className="pt-2 border-t border-border">
            <h4 className="text-xs font-medium text-muted-foreground mb-2">ENDEREÇO</h4>
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p>{client.address_line}</p>
                {(client.city || client.state) && (
                  <p className="text-muted-foreground">
                    {[client.city, client.state].filter(Boolean).join(" - ")}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Additional info for PF */}
        {client.person_type === "PF" && (
          <div className="pt-2 border-t border-border">
            <h4 className="text-xs font-medium text-muted-foreground mb-2">DADOS ADICIONAIS</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {client.profession && (
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <span>{client.profession}</span>
                </div>
              )}
              {client.nationality && (
                <div>
                  <span className="text-muted-foreground">Nacionalidade:</span>
                  <p className="font-medium">{client.nationality}</p>
                </div>
              )}
              {client.marital_status && (
                <div>
                  <span className="text-muted-foreground">Estado civil:</span>
                  <p className="font-medium">{client.marital_status}</p>
                </div>
              )}
              {!client.profession && !client.nationality && !client.marital_status && (
                <p className="text-muted-foreground">Nenhum dado adicional</p>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        {client.notes && (
          <div className="pt-2 border-t border-border">
            <h4 className="text-xs font-medium text-muted-foreground mb-2">OBSERVAÇÕES</h4>
            <p className="text-sm whitespace-pre-wrap">{client.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
