import React from 'react'
import {
    ComposedChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Area
} from 'recharts'

export default function ScenarioComparisonChart({ data }) {
    if (!data || data.length === 0) return <div className="text-center p-8 text-gray-400">No data specifically for this scenario range.</div>

    return (
        <div className="h-[400px] w-full bg-white p-4 rounded border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Forecast Comparison: Baseline vs Scenario</h3>
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="period" />
                    <YAxis yAxisId="left" tickFormatter={(val) => `$${val / 1000}k`} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={(val) => `${val}%`} />
                    <Tooltip
                        formatter={(value, name) => {
                            if (name.includes('Margin %')) return [`${value.toFixed(1)}%`, name]
                            return [new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value), name]
                        }}
                    />
                    <Legend />

                    {/* BASELINE (Solid) */}
                    <Bar yAxisId="left" dataKey="revenue" name="Current Revenue" fill="#94a3b8" barSize={20} />
                    <Line yAxisId="right" type="monotone" dataKey="margin_pct" name="Current Margin %" stroke="#64748b" strokeWidth={2} dot={false} />

                    {/* SCENARIO (Dashed/Colored) */}
                    {/* SCENARIO (Dashed/Colored) - Only show if distinct from base or specifically requested */}
                    {/* SCENARIO (Dashed/Colored) */}
                    <Line yAxisId="left" type="step" dataKey="scenario_revenue" name="Scenario Revenue" stroke="#2563eb" strokeWidth={3} strokeDasharray="4 4" dot={false} strokeOpacity={0.8} />
                    <Line yAxisId="right" type="check" dataKey="scenario_margin_pct" name="Scenario Margin %" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#fff', strokeWidth: 2 }} />

                </ComposedChart>
            </ResponsiveContainer>
        </div>
    )
}
