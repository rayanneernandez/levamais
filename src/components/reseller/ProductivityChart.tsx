import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";

interface ProductivityData {
  month: string;
  active: number;
  cancelled: number;
  net: number;
}

interface ProductivityChartProps {
  data: ProductivityData[];
}

export const ProductivityChart = ({ data }: ProductivityChartProps) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Acompanhamento de Produtividade</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Evolução de clientes ativos e cancelados ao longo do tempo
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="month" 
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="line"
            />
            <Line 
              type="monotone" 
              dataKey="active" 
              name="Novos Clientes"
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--primary))', r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line 
              type="monotone" 
              dataKey="cancelled" 
              name="Cancelamentos"
              stroke="hsl(var(--destructive))" 
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--destructive))', r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line 
              type="monotone" 
              dataKey="net" 
              name="Crescimento Líquido"
              stroke="hsl(var(--chart-2))" 
              strokeWidth={3}
              strokeDasharray="5 5"
              dot={{ fill: 'hsl(var(--chart-2))', r: 5 }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="text-center p-3 bg-primary/10 rounded-lg">
            <div className="text-2xl font-bold text-primary">
              {data.reduce((sum, d) => sum + d.active, 0)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Novos no Período
            </div>
          </div>
          <div className="text-center p-3 bg-destructive/10 rounded-lg">
            <div className="text-2xl font-bold text-destructive">
              {data.reduce((sum, d) => sum + d.cancelled, 0)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Cancelados no Período
            </div>
          </div>
          <div className="text-center p-3 bg-chart-2/10 rounded-lg">
            <div className="text-2xl font-bold" style={{ color: 'hsl(var(--chart-2))' }}>
              {data.reduce((sum, d) => sum + d.net, 0)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Crescimento Líquido
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
