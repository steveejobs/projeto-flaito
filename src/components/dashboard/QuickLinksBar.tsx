import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, BookOpen, Link2, ClipboardList } from 'lucide-react';

interface QuickLinksBarProps {
  isAdmin: boolean;
}

export function QuickLinksBar({ isAdmin }: QuickLinksBarProps) {
  return (
    <Card className="dashboard-card rounded-2xl shadow-sm border-muted">
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-2 justify-center">
          <Button asChild variant="ghost" size="sm">
            <Link to="/documents">
              <FileText className="h-4 w-4 mr-1" />
              Documentos
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/knowledge">
              <BookOpen className="h-4 w-4 mr-1" />
              Base de Conhecimento
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/integrations">
              <Link2 className="h-4 w-4 mr-1" />
              Integrações
            </Link>
          </Button>
          {isAdmin && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/system-audit">
                <ClipboardList className="h-4 w-4 mr-1" />
                Auditoria
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
