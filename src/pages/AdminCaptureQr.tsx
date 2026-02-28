import { useState, useEffect, useRef } from "react";
import { Copy, Download, QrCode, AlertCircle } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { useOfficeSession } from "@/hooks/useOfficeSession";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AdminCaptureQr() {
  const { user } = useAuth();
  const { officeId } = useOfficeSession(user?.id);
  const [slug, setSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const captureUrl = slug ? `${window.location.origin}/captacao/${encodeURIComponent(slug.trim())}` : null;

  useEffect(() => {
    if (!officeId) return;

    const fetchSlug = async () => {
      const { data } = await supabase
        .from("offices")
        .select("slug")
        .eq("id", officeId)
        .single();

      setSlug(data?.slug || null);
      setLoading(false);
    };

    fetchSlug();
  }, [officeId]);

  useEffect(() => {
    if (!captureUrl || !canvasRef.current) return;

    QRCode.toCanvas(canvasRef.current, captureUrl, {
      width: 200,
      margin: 2,
      color: { dark: "#000", light: "#fff" },
    });
  }, [captureUrl]);

  const handleCopy = () => {
    if (!captureUrl) return;
    navigator.clipboard.writeText(captureUrl);
    toast.success("Link copiado!");
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `qr-captacao-${slug}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
    toast.success("QR Code baixado!");
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!slug) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Seu escritório não possui um slug configurado. Configure-o nas configurações do escritório para gerar o link de captação.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-lg mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            Link de Captação em Campo
          </CardTitle>
          <CardDescription>
            Compartilhe este link ou QR Code com seus captadores
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* URL Input */}
          <div className="flex gap-2">
            <Input value={captureUrl || ""} readOnly className="font-mono text-sm" />
            <Button variant="outline" size="icon" onClick={handleCopy}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-white rounded-lg">
              <canvas ref={canvasRef} />
            </div>
            <Button variant="outline" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" />
              Baixar PNG
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Os clientes cadastrados aparecerão automaticamente na sua lista de clientes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
