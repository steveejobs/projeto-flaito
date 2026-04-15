import React, { useEffect, useState } from 'react';
import { DocumentPreviewFrame } from '@/components/documents/DocumentPreviewFrame';
import { useDocumentEngine } from '@/hooks/useDocumentEngine';
import { BASE_MOCK_CONTEXT, MOCK_DOCUMENT_CONTENT } from '@/tests/mocks/documentMocks';
import { DocumentTemplateId } from '@/types/institutional';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Eye, Printer, Layers, FileText } from 'lucide-react';

const DocumentGallery = () => {
  const { generateDocument } = useDocumentEngine();
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const templates: DocumentTemplateId[] = ['premium_elegant', 'clean_white', 'modern_executive', 'simple_watermark'];

  useEffect(() => {
    const loadAll = async () => {
      const results: Record<string, string> = {};
      for (const tId of templates) {
        const context = {
          ...BASE_MOCK_CONTEXT,
          templateMetadata: { ...BASE_MOCK_CONTEXT.templateMetadata!, id: tId }
        };
        results[tId] = await generateDocument(context, MOCK_DOCUMENT_CONTENT);
      }
      setPreviews(results);
      setLoading(false);
    };
    loadAll();
  }, [generateDocument]);

  return (
    <div className="container mx-auto py-10 space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Galeria de Templates Profissionais</h1>
        <p className="text-muted-foreground text-lg">
          Validação visual comparativa do motor documental (v1.0.0). Zero Webfonts • A4 Standard.
        </p>
      </div>

      <Tabs defaultValue="grid" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="grid" className="flex items-center gap-2">
            <Layers className="h-4 w-4" /> Grade Comparativa
          </TabsTrigger>
          <TabsTrigger value="individual" className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> Visão Individual
          </TabsTrigger>
        </TabsList>

        <TabsContent value="grid" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {templates.map((tId) => (
              <Card key={tId} className="overflow-hidden border-2 hover:border-primary/20 transition-colors">
                <CardHeader className="bg-muted/50 border-b py-3">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wider">
                      {tId.replace('_', ' ')}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => window.print()}>
                        <Printer className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <DocumentPreviewFrame 
                    htmlContent={previews[tId]} 
                    loading={loading}
                    className="border-0 rounded-none shadow-none"
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="individual" className="mt-6">
          <Tabs defaultValue="premium_elegant" className="w-full">
            <div className="flex justify-between items-center mb-6">
              <TabsList>
                {templates.map(tId => (
                  <TabsTrigger key={tId} value={tId}>{tId.split('_')[0]}</TabsTrigger>
                ))}
              </TabsList>
              <Button onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" /> Imprimir Selecionado (A4)
              </Button>
            </div>
            
            {templates.map(tId => (
              <TabsContent key={tId} value={tId}>
                <div className="max-w-[900px] mx-auto bg-white shadow-2xl">
                   <DocumentPreviewFrame 
                      htmlContent={previews[tId]} 
                      loading={loading}
                      className="border-0 shadow-none rounded-none aspect-auto min-h-[1100px]"
                   />
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </TabsContent>
      </Tabs>

      <div className="rounded-lg border bg-amber-50 p-6 text-amber-900 border-amber-200">
        <h3 className="font-semibold flex items-center gap-2 mb-2">
          <Eye className="h-5 w-5" /> Notas de Validação Técnica
        </h3>
        <ul className="list-disc list-inside space-y-1 text-sm opacity-90">
          <li><strong>Isolamento (Iframe)</strong>: O documento renderizado não compartilha CSS com esta página de galeria.</li>
          <li><strong>Tipografia</strong>: Foram utilizadas apenas fontes de sistema (Georgia, Arial, Helvetica).</li>
          <li><strong>Snapshot</strong>: O código-fonte de cada preview contém o JSON institucional completo para fins de auditoria.</li>
          <li><strong>A4 Precision</strong>: O wrapper possui largura de 210mm fixa, espelhando fielmente o PDF final.</li>
        </ul>
      </div>
    </div>
  );
};

export default DocumentGallery;
