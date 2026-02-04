import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart } from 'recharts'
import { format } from 'date-fns'

export const ForecastingChart = ({ data }) => {
    // data expected: [{ period_month: '2025-04-01', revenue_actual: 100, revenue_forecast: 0, ... }]

    const formattedData = data.map(d => ({
        ...d,
        period: format(new Date(d.period_month), 'MMM yy'),
        margin_pct: parseFloat(d.margin_pct).toFixed(1),
        // Ensure numbers
        rev_act: parseFloat(d.revenue_actual) || 0,
        rev_fc: parseFloat(d.revenue_forecast) || 0,
        cost_act: parseFloat(d.cost_actual) || 0,
        cost_fc: parseFloat(d.cost_forecast) || 0,
        // Combined for tooltips if needed, but stacked bars handle visual
    }))

    return (
        <div style={{ width: '100%', height: 400 }}>
            <h3 className="text-sm font-semibold mb-4 text-gray-500">Revenue & Margin Forecast</h3>
            <div className="flex gap-4 text-xs text-gray-500 mb-2 justify-end">
                <span className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-700"></div> Revenue (Actual)</span>
                <span className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-300"></div> Revenue (Forecast)</span>
            </div>
            <ResponsiveContainer>
                <ComposedChart data={formattedData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid stroke="#f5f5f5" />
                    <XAxis dataKey="period" scale="point" padding={{ left: 10, right: 10 }} />
                    <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                    <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" unit="%" />
                    <Tooltip cursor={{ fill: '#f3f4f6' }} />
                    <Legend />

                    {/* Revenue Stack */}
                    <Bar yAxisId="left" dataKey="rev_act" name="Revenue (Actual)" stackId="a" barSize={20} fill="#1d4ed8" />
                    <Bar yAxisId="left" dataKey="rev_fc" name="Revenue (Forecast)" stackId="a" barSize={20} fill="#93c5fd" />

                    {/* Cost Stack */}
                    <Bar yAxisId="left" dataKey="cost_act" name="Cost (Actual)" stackId="b" barSize={20} fill="#c2410c" />
                    <Bar yAxisId="left" dataKey="cost_fc" name="Cost (Forecast)" stackId="b" barSize={20} fill="#fdba74" />

                    <Line yAxisId="right" type="monotone" dataKey="margin_pct" name="Margin %" stroke="#10b981" strokeWidth={2} dot={false} />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    )
}
