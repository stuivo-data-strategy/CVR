import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import {
    ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Scatter, ReferenceLine
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/Card'
import { AlertCircle, ArrowUpRight, ArrowDownRight, FileText, GitCommit } from 'lucide-react'

export default function ReportsTab({ contractId }) {

    // 1. Fetch Trend Data (Cumulative Financials)
    const { data: trendData, isLoading: loadingTrend } = useQuery({
        queryKey: ['contract_trend', contractId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('view_contract_cumulative_trend')
                .select('*')
                .eq('contract_id', contractId)
                .order('period_month', { ascending: true })
            if (error) throw error
            return data
        }
    })

    // 2. Fetch Events (Narratives & Changes)
    const { data: eventsData, isLoading: loadingEvents } = useQuery({
        queryKey: ['contract_events', contractId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('view_contract_timeline_events')
                .select('*')
                .eq('contract_id', contractId)
            if (error) throw error
            return data
        }
    })

    // 3. Fetch Contract Details (for Target Margin)
    const { data: contract } = useQuery({
        queryKey: ['contract_basic', contractId],
        queryFn: async () => {
            const { data } = await supabase.from('contracts').select('target_margin_pct').eq('id', contractId).single()
            return data
        }
    })

    if (loadingTrend || loadingEvents) return <div className="p-8">Loading Analytics...</div>

    // MERGE DATA: Attach events to the matching month in trend data
    const chartData = trendData?.map(month => {
        // Find events in this month
        const monthEvents = eventsData?.filter(e => e.event_date.startsWith(month.period_month))
        return {
            ...month,
            displayDate: format(parseISO(month.period_month), 'MMM yy'),
            events: monthEvents,
            hasEvent: monthEvents?.length > 0 ? month.cum_margin_pct : null // Y-Coord for dot
        }
    })

    // Custom Tooltip
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload
            return (
                <div className="bg-white p-3 border rounded shadow-lg text-sm max-w-xs z-50">
                    <p className="font-bold border-b pb-1 mb-1">{data.displayDate}</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-2">
                        <span className="text-gray-500">Revenue:</span>
                        <span className="font-mono text-right">${(data.cum_revenue / 1000).toFixed(0)}k</span>
                        <span className="text-gray-500">Margin:</span>
                        <span className={`font-mono text-right font-bold ${data.cum_margin_pct < 0 ? 'text-red-500' : 'text-green-600'}`}>
                            {data.cum_margin_pct?.toFixed(1)}%
                        </span>
                    </div>
                    {/* Events List */}
                    {data.events?.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                            <p className="text-xs font-semibold text-gray-500 mb-1">Key Events:</p>
                            {data.events.map((e, idx) => (
                                <div key={idx} className="flex items-start gap-1 text-xs mb-1">
                                    {e.event_type === 'change' ? <GitCommit size={10} className="mt-1 text-blue-500" /> : <FileText size={10} className="mt-1 text-amber-500" />}
                                    <span className="text-gray-700 leading-tight">
                                        <span className="font-medium">{e.category}:</span> {e.description}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )
        }
        return null
    }

    return (
        <div className="flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUpIcon className="text-blue-600" />
                        Margin Evolution & Risk Analysis
                    </CardTitle>
                    <CardDescription>
                        Tracking cumulative margin performance over time.
                        Dots indicate significant events (Narratives or Contract Changes).
                    </CardDescription>
                </CardHeader>
                <CardContent className="h-[500px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 30, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="displayDate" tick={{ fontSize: 12 }} />

                            {/* Left Axis: Currency */}
                            <YAxis
                                yAxisId="left"
                                orientation="left"
                                tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                                width={60}
                                stroke="#6b7280"
                            />

                            {/* Right Axis: Percentage */}
                            <YAxis
                                yAxisId="right"
                                orientation="right"
                                domain={['auto', 'auto']}
                                tickFormatter={(val) => `${val.toFixed(0)}%`}
                                width={50}
                                stroke="#2563eb"
                            />

                            <Tooltip content={<CustomTooltip />} />
                            <Legend />

                            {/* Reference Lines */}
                            {contract?.target_margin_pct && (
                                <ReferenceLine yAxisId="right" y={contract.target_margin_pct} stroke="green" strokeDasharray="3 3" label={{ value: 'Target', position: 'insideRight', fill: 'green', fontSize: 10 }} />
                            )}

                            {/* Bars for Cost & Revenue (Left Axis) */}
                            <Area
                                yAxisId="left"
                                type="monotone"
                                dataKey="cum_cost"
                                name="Cumulative Cost"
                                fill="#f3f4f6"
                                stroke="#9ca3af"
                                fillOpacity={0.6}
                            />

                            {/* Revenue Bar - using Area for smoother visualization below line? Or Bar? User asked for "values". Let's use Bar for clearer distinction or Line? 
                                User asked for "Actuals and Forecast Values". Multi-bar might be messy. 
                                Let's use Line for Margin % (Right) and Area/Bar for Revenue/Cost. 
                                Area stacking? No, Revenue and Cost are separate totals. 
                                Let's use darker Area for Revenue to contrast with Cost.
                            */}
                            <Area
                                yAxisId="left"
                                type="monotone"
                                dataKey="cum_revenue"
                                name="Cumulative Revenue"
                                fill="#dbeafe"
                                stroke="#93c5fd"
                                fillOpacity={0.4}
                            />

                            {/* Margin Line (Right Axis) */}
                            <Line
                                yAxisId="right"
                                type="monotone"
                                dataKey="cum_margin_pct"
                                name="Margin %"
                                stroke="#2563eb"
                                strokeWidth={3}
                                dot={false}
                                activeDot={{ r: 6 }}
                            />

                            {/* Event Markers (Scatter) - Right Axis aligned */}
                            <Scatter
                                yAxisId="right"
                                name="Events"
                                dataKey="hasEvent"
                                fill="#f59e0b"
                                shape="circle"
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Event Log / Variance Table */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">Variance Analysis</CardTitle>
                        <CardDescription>Baseline vs Current Forecast</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm text-gray-500 text-center py-8 bg-gray-50 border border-dashed rounded">
                            Variance breakdown by Cost Category coming soon.
                            (Requires granular baseline/forecast comparison view).
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">Narrative History</CardTitle>
                        <CardDescription>Risk & Opportunity Log</CardDescription>
                    </CardHeader>
                    <CardContent className="max-h-[300px] overflow-y-auto pr-2">
                        <div className="flex flex-col gap-3">
                            {eventsData?.map((e, i) => (
                                <div key={i} className="flex gap-3 text-sm p-3 bg-white border rounded hover:shadow-sm">
                                    <div className="mt-1">
                                        {e.event_type === 'change' ? <GitCommit className="text-blue-500" size={16} /> : <FileText className="text-amber-500" size={16} />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-semibold text-gray-900">{format(parseISO(e.event_date), 'MMM yyyy')}</span>
                                            <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600 border capitalize">{e.category}</span>
                                        </div>
                                        <p className="text-gray-600">{e.description}</p>
                                    </div>
                                </div>
                            ))}
                            {(!eventsData || eventsData.length === 0) && (
                                <p className="text-gray-400 italic text-center py-4">No significant events recorded.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

function TrendingUpIcon(props) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
        </svg>
    )
}
