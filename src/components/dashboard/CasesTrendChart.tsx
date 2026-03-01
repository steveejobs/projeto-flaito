import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, Cell } from 'recharts';
import { BarChart3 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const CHART_COLORS = [
  'hsl(221, 83%, 53%)',
  'hsl(142, 76%, 36%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 84%, 60%)',
  'hsl(262, 83%, 58%)',
];

interface CaseStatusCount {
  status: string;
  count: number;
  percentage: number;
}

interface CasesTrendChartProps {
  casesByStatus: CaseStatusCount[];
  loading: boolean;
  getStatusLabel: (status: string) => string;
}

export function CasesTrendChart({ casesByStatus, loading, getStatusLabel }: CasesTrendChartProps) {
  if (loading) {
    return (
      <Card className="bento-card h-full">
        <CardHeader className="pb-4 border-b border-border/40">
          <Skeleton className="h-6 w-48 rounded-md" />
          <Skeleton className="h-4 w-32 mt-2 rounded-md" />
        </CardHeader>
        <CardContent className="p-4 pt-6">
          <Skeleton className="h-[200px] w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (casesByStatus.length === 0) {
    return (
      <Card className="bento-card h-full">
        <CardContent className="flex flex-col items-center justify-center py-16 h-full min-h-[300px] text-center">
          <div className="h-16 w-16 mb-4 rounded-full bg-primary/5 flex items-center justify-center">
            <BarChart3 className="h-8 w-8 text-primary/30" />
          </div>
          <p className="text-base font-semibold text-foreground">Distribuição Indisponível</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-[200px]">Cadastre mais casos para visualizar o gráfico de tendências</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = casesByStatus.slice(0, 5).map((item) => ({
    ...item,
    label: getStatusLabel(item.status),
  }));

  const chartConfig = {
    count: { label: 'Casos', color: 'hsl(221, 83%, 53%)' },
  };

  return (
    <Card className="bento-card relative overflow-hidden group h-full flex flex-col">
      {/* Subtle Background Decoration */}
      {/* Decorative effect removed to reduce blur */}

      <CardHeader className="pb-3 border-b border-border/40 relative z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shadow-inner border border-primary/20">
            <BarChart3 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg font-bold tracking-tight">Distribuição de Casos</CardTitle>
            <CardDescription className="text-[10px] font-medium uppercase tracking-wider mt-0.5">Top status por quantidade</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-4 relative z-10 flex-1 min-h-[220px]">
        <ChartContainer config={chartConfig} className="h-full w-full min-h-[200px]">
          <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20, top: 10, bottom: 10 }}>
            <XAxis type="number" hide />
            <YAxis
              dataKey="label"
              type="category"
              width={110}
              tick={{ fontSize: 12, fontWeight: 500, fill: 'currentColor' }}
              tickLine={false}
              axisLine={false}
              className="text-foreground/80"
            />
            <ChartTooltip
              content={<ChartTooltipContent />}
              cursor={{ fill: 'hsl(var(--muted))', opacity: 0.2 }}
            />
            <Bar
              dataKey="count"
              radius={[0, 6, 6, 0]}
              maxBarSize={28}
              animationDuration={1500}
            >
              {chartData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                  className="transition-all duration-300 hover:opacity-80 drop-shadow-sm"
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );

}
