import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart } from 'recharts'
import { format } from 'date-fns'

export const ForecastingChart = ({ data }) => {
    // data expected: [{ period_month: '2025-04-01', revenue: 100, cost: 90, margin_pct: 10 }]

    const formattedData = data.map(d => ({
        ...d,
        period: format(new Date(d.period_month), 'MMM yy'),
        margin_pct: parseFloat(d.margin_pct).toFixed(1)
    }))

    return (
        <div style={{ width: '100%', height: 400 }}>
            <h3 className="text-sm font-semibold mb-4 text-gray-500">Revenue & Margin Forecast</h3>
            <ResponsiveContainer>
                <ComposedChart data={formattedData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid stroke="#f5f5f5" />
                    <XAxis dataKey="period" scale="point" padding={{ left: 10, right: 10 }} />
                    <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                    <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" unit="%" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="revenue" name="Revenue" barSize={20} fill="#413ea0" />
                    <Bar yAxisId="left" dataKey="cost" name="Cost" barSize={20} fill="#f97316" />
                    <Line yAxisId="right" type="monotone" dataKey="margin_pct" name="Margin %" stroke="#10b981" strokeWidth={2} />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    )
}
