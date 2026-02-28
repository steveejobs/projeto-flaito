import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface AvatarUploadProps {
  currentUrl: string | null;
  initials: string;
  userId: string;
  onUpload: (url: string) => void;
  onRemove: () => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
}

const BUCKET_NAME = "member-avatars";
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function AvatarUpload({
  currentUrl,
  initials,
  userId,
  onUpload,
  onRemove,
  disabled = false,
  size = "lg",
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = {
    sm: "h-12 w-12",
    md: "h-16 w-16",
    lg: "h-20 w-20",
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Formato inválido. Use JPEG, PNG ou WebP.");
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Imagem muito grande. Máximo 2MB.");
      return;
    }

    setUploading(true);
    try {
      // Get file extension
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${userId}/avatar.${ext}`;

      // Delete existing avatar first (if any)
      const { data: existingFiles } = await supabase.storage
        .from(BUCKET_NAME)
        .list(userId);
      
      if (existingFiles && existingFiles.length > 0) {
        const filesToRemove = existingFiles.map(f => `${userId}/${f.name}`);
        await supabase.storage.from(BUCKET_NAME).remove(filesToRemove);
      }

      // Upload new file
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file, { 
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

      // Add cache-busting timestamp
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      
      onUpload(publicUrl);
      toast.success("Foto atualizada!");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Erro ao enviar foto");
    } finally {
      setUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = async () => {
    setUploading(true);
    try {
      // List and remove all files in user's folder
      const { data: existingFiles } = await supabase.storage
        .from(BUCKET_NAME)
        .list(userId);
      
      if (existingFiles && existingFiles.length > 0) {
        const filesToRemove = existingFiles.map(f => `${userId}/${f.name}`);
        await supabase.storage.from(BUCKET_NAME).remove(filesToRemove);
      }

      onRemove();
      toast.success("Foto removida");
    } catch (error) {
      console.error("Remove error:", error);
      toast.error("Erro ao remover foto");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <Avatar className={sizeClasses[size]}>
          {currentUrl && <AvatarImage src={currentUrl} alt="Foto de perfil" />}
          <AvatarFallback className="bg-primary/10 text-primary text-lg font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
        
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-full">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || uploading}
        />
        
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          className="gap-2"
        >
          <Camera className="h-4 w-4" />
          {currentUrl ? "Alterar foto" : "Adicionar foto"}
        </Button>

        {currentUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={disabled || uploading}
            className="gap-2 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Remover
          </Button>
        )}
      </div>
    </div>
  );
}
