import React, { useRef, useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Camera, X, RotateCcw, Check, ChevronRight } from "lucide-react";

interface DocumentScannerModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (files: File[]) => void;
  mode: 'single' | 'double';
  documentLabel?: string;
}

type CaptureStep = 'front' | 'front-review' | 'back' | 'confirmation';

export function DocumentScannerModal({
  open,
  onClose,
  onCapture,
  mode,
  documentLabel = "Documento"
}: DocumentScannerModalProps) {
  const nativeInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<CaptureStep>('front');
  const [frontImage, setFrontImage] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<File | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [isOpenDocument, setIsOpenDocument] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep('front');
      setFrontImage(null);
      setFrontPreview(null);
      setBackImage(null);
      setBackPreview(null);
      setIsOpenDocument(false);
    }
  }, [open]);

  // Auto-trigger native camera when entering camera steps
  useEffect(() => {
    if (open && (step === 'front' || step === 'back')) {
      const timer = setTimeout(() => {
        nativeInputRef.current?.click();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open, step]);

  // Handle native file input capture
  const handleNativeCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const suffix = step === 'front' 
      ? (mode === 'double' ? ' - Frente' : '')
      : ' - Verso';
    
    const fileName = `${documentLabel}${suffix}.jpg`;
    const renamedFile = new File([file], fileName, { type: file.type });
    const previewUrl = URL.createObjectURL(file);

    if (step === 'front') {
      setFrontImage(renamedFile);
      setFrontPreview(previewUrl);
      if (mode === 'double') {
        setStep('front-review');
      } else {
        setStep('confirmation');
      }
    } else if (step === 'back') {
      setBackImage(renamedFile);
      setBackPreview(previewUrl);
      setStep('confirmation');
    }

    // Reset input
    e.target.value = '';
  };

  const triggerNativeCamera = () => {
    nativeInputRef.current?.click();
  };

  const handleProceedToBack = () => {
    setStep('back');
  };

  const handleFinishWithOpenDoc = () => {
    if (frontImage && frontPreview) {
      const fileName = `${documentLabel} - Frente e Verso.jpg`;
      const renamedFile = new File([frontImage], fileName, { type: 'image/jpeg' });
      setFrontImage(renamedFile);
    }
    setStep('confirmation');
  };

  const handleRetakeFront = () => {
    setFrontImage(null);
    if (frontPreview) URL.revokeObjectURL(frontPreview);
    setFrontPreview(null);
    setIsOpenDocument(false);
    setStep('front');
  };

  const handleRetakeBack = () => {
    setBackImage(null);
    if (backPreview) URL.revokeObjectURL(backPreview);
    setBackPreview(null);
    setStep('back');
  };

  const handleConfirm = () => {
    const files: File[] = [];
    
    if (isOpenDocument && frontImage) {
      const fileName = `${documentLabel} - Frente e Verso.jpg`;
      const renamedFile = new File([frontImage], fileName, { type: 'image/jpeg' });
      files.push(renamedFile);
    } else {
      if (frontImage) files.push(frontImage);
      if (backImage) files.push(backImage);
    }

    onCapture(files);
    handleClose();
  };

  const handleClose = () => {
    if (frontPreview) URL.revokeObjectURL(frontPreview);
    if (backPreview) URL.revokeObjectURL(backPreview);
    onClose();
  };

  // Camera view component - now uses native input only
  const CameraView = ({ side }: { side: 'front' | 'back' }) => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h3 className="font-semibold text-lg">
            {documentLabel} - {side === 'front' ? 'FRENTE' : 'VERSO'}
          </h3>
          {side === 'back' && (
            <p className="text-sm text-muted-foreground">✓ Frente capturada</p>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={handleClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Hidden native input */}
      <input
        ref={nativeInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleNativeCapture}
        className="hidden"
      />

      {/* Main content - Icon + Instructions */}
      <div className="flex-1 bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-6">
        <div className="text-center space-y-6 max-w-sm">
          <div className="w-24 h-24 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
            <Camera className="h-12 w-12 text-primary" />
          </div>
          <div className="space-y-2">
            <h4 className="text-xl font-semibold text-white">
              {side === 'front' ? 'Tire uma foto da FRENTE' : 'Agora tire a foto do VERSO'}
            </h4>
            <p className="text-white/70 text-sm">
              Posicione o documento em local bem iluminado e clique no botão abaixo
            </p>
          </div>
        </div>
      </div>

      {/* Footer Buttons */}
      <div className="p-4 space-y-3 border-t bg-background">
        <Button
          size="lg"
          className="w-full gap-2"
          onClick={triggerNativeCamera}
        >
          <Camera className="h-5 w-5" />
          Abrir Câmera
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={handleClose}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );

  // Front review component
  const FrontReview = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h3 className="font-semibold text-lg">{documentLabel} - FRENTE</h3>
          <p className="text-sm text-muted-foreground">Verifique a imagem</p>
        </div>
        <Button variant="ghost" size="icon" onClick={handleClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 bg-black flex items-center justify-center p-4 overflow-hidden">
        {frontPreview && (
          <img 
            src={frontPreview} 
            alt="Frente do documento" 
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        )}
      </div>

      <div className="p-4 space-y-4 border-t">
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="open-doc" 
            checked={isOpenDocument}
            onCheckedChange={(checked) => setIsOpenDocument(!!checked)}
          />
          <label 
            htmlFor="open-doc" 
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            O documento está aberto (frente e verso na mesma foto)
          </label>
        </div>

        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="flex-1 gap-2"
            onClick={handleRetakeFront}
          >
            <RotateCcw className="h-4 w-4" />
            Refazer
          </Button>
          
          {isOpenDocument ? (
            <Button 
              className="flex-1 gap-2"
              onClick={handleFinishWithOpenDoc}
            >
              <Check className="h-4 w-4" />
              Confirmar
            </Button>
          ) : (
            <Button 
              className="flex-1 gap-2"
              onClick={handleProceedToBack}
            >
              Fotografar verso
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  // Confirmation component
  const Confirmation = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h3 className="font-semibold text-lg">{documentLabel}</h3>
          <p className="text-sm text-muted-foreground">Confirme as imagens</p>
        </div>
        <Button variant="ghost" size="icon" onClick={handleClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Front image */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {isOpenDocument ? 'Frente e Verso' : 'Frente'}
            </span>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 gap-1"
              onClick={handleRetakeFront}
            >
              <RotateCcw className="h-3 w-3" />
              Refazer
            </Button>
          </div>
          {frontPreview && (
            <img 
              src={frontPreview} 
              alt="Frente" 
              className="w-full rounded-lg border"
            />
          )}
        </div>

        {/* Back image (only if not open document and mode is double) */}
        {!isOpenDocument && mode === 'double' && backPreview && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Verso</span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 gap-1"
                onClick={handleRetakeBack}
              >
                <RotateCcw className="h-3 w-3" />
                Refazer
              </Button>
            </div>
            <img 
              src={backPreview} 
              alt="Verso" 
              className="w-full rounded-lg border"
            />
          </div>
        )}
      </div>

      <div className="p-4 border-t">
        <Button 
          size="lg"
          className="w-full gap-2"
          onClick={handleConfirm}
        >
          <Check className="h-5 w-5" />
          Confirmar e Salvar
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-lg p-0 h-[85vh] max-h-[700px] flex flex-col overflow-hidden">
        {step === 'front' && <CameraView side="front" />}
        {step === 'front-review' && <FrontReview />}
        {step === 'back' && <CameraView side="back" />}
        {step === 'confirmation' && <Confirmation />}
      </DialogContent>
    </Dialog>
  );
}
