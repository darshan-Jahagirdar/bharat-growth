import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  type RevenueTrendPoint,
  type TopProduct,
} from '@/lib/dashboard/dashboardQueries';
import { DONUT_COLORS } from '@/lib/dashboard/dashboardPresentation';
import { formatINR } from '@/lib/types/database';

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 border border-white/10 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-bold text-orange-400">
        {formatINR(payload[0].value * 100)}
      </p>
    </div>
  );
}

interface DashboardChartsProps {
  revenueTrend: RevenueTrendPoint[];
  topProductTotal: number;
  topProducts: TopProduct[];
}

export function DashboardCharts({
  revenueTrend,
  topProductTotal,
  topProducts,
}: DashboardChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 bg-slate-900/50 border border-white/5 rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sm font-semibold text-gray-200">Revenue Trend</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">Last 7 days</p>
          </div>
        </div>
        {revenueTrend.some((day) => day.revenue > 0) ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={revenueTrend}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.04)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6b7280', fontSize: 11 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                tickFormatter={(value: number) =>
                  value >= 1000 ? `${(value / 1000).toFixed(0)}k` : `${value}`
                }
                width={45}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#f97316"
                strokeWidth={2}
                fill="url(#revenueGradient)"
                dot={{ r: 3, fill: '#f97316', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#f97316', stroke: '#1e293b', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[220px] flex items-center justify-center text-gray-600 text-sm">
            No revenue data for the last 7 days
          </div>
        )}
      </div>

      <div className="bg-slate-900/50 border border-white/5 rounded-xl p-6">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-gray-200">Top Products</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">This month by sales</p>
        </div>
        {topProducts.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={topProducts}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="sales"
                  stroke="none"
                >
                  {topProducts.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={DONUT_COLORS[index % DONUT_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [formatINR(Number(value) * 100), 'Sales']}
                  contentStyle={{
                    background: '#1e293b',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  itemStyle={{ color: '#f97316' }}
                />
                <text x="50%" y="46%" textAnchor="middle" fill="#9ca3af" fontSize={10}>
                  This Month
                </text>
                <text x="50%" y="58%" textAnchor="middle" fill="#e5e7eb" fontSize={13} fontWeight="bold">
                  {formatINR(topProductTotal * 100)}
                </text>
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-3 space-y-1.5">
              {topProducts.map((product, index) => (
                <div key={index} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }}
                    />
                    <span className="text-gray-400 truncate">{product.name}</span>
                  </div>
                  <span className="text-gray-300 font-medium shrink-0 ml-2">
                    {formatINR(product.sales * 100)}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="h-[220px] flex items-center justify-center text-gray-600 text-sm">
            No sales this month
          </div>
        )}
      </div>
    </div>
  );
}
