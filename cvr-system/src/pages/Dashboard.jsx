import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts'
import { Activity, TrendingUp, AlertTriangle, DollarSign } from 'lucide-react'

// Sub-components (will extract later if they get too big)
const KPICard = ({ title, value, subtext, icon: Icon, color }) => (
    <Card>
        <CardContent className="p-6 flex items-center justify-between">
            <div>
                <p className="text-sm font-medium text-gray-500">{title}</p>
                <h3 className="text-2xl font-bold mt-1">{value}</h3>
                {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
            </div>
            <div className={`p-3 rounded-full ${color}`}>
                <Icon size={24} className="text-white" />
            </div>
        </CardContent>
    </Card>
)

export default function Dashboard() {
    // State for interactive slider
    const [marginThreshold, setMarginThreshold] = useState(5.0)

    // Fetch Data
    const { data: portfolioData, isLoading } = useQuery({
        queryKey: ['portfolio_summary'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('portfolio_summary_view')
                .select('*')
            if (error) throw error
            return data
        }
    })

    if (isLoading) return <div className="p-8">Loading dashboard analytics...</div>

    // 1. Calculate Aggregates
    const totalRevenue = portfolioData?.reduce((acc, curr) => acc + curr.current_forecast_revenue, 0) || 0
    const totalCost = portfolioData?.reduce((acc, curr) => acc + curr.current_forecast_cost, 0) || 0
    const totalMargin = totalRevenue - totalCost
    const overallMarginPct = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0

    // 2. Risk Analysis
    const riskyContracts = portfolioData?.filter(c => c.current_margin_pct < marginThreshold) || []

    // 3. Grouping for Charts
    const byPortfolio = portfolioData?.reduce((acc, curr) => {
        const pf = curr.portfolio || 'Unknown'
        if (!acc[pf]) acc[pf] = { name: pf, revenue: 0, margin: 0 }
        acc[pf].revenue += curr.current_forecast_revenue
        acc[pf].margin += curr.current_margin_amt
        return acc
    }, {})
    const portfolioChartData = Object.values(byPortfolio || {})

    // Formatters
    const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format
    const pct = (val) => `${val.toFixed(1)}%`

    return (
        <div className="flex flex-col gap-8 pb-12">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Executive Dashboard</h1>
                <p className="text-gray-500 mt-1">Real-time portfolio insights and health monitoring.</p>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard
                    title="Total Revenue"
                    value={currency(totalRevenue)}
                    icon={DollarSign}
                    color="bg-blue-600"
                />
                <KPICard
                    title="Overall Margin"
                    value={pct(overallMarginPct)}
                    subtext={`Target: >8.0%`} // Hardcoded goal for now
                    icon={TrendingUp}
                    color={overallMarginPct >= 8 ? "bg-emerald-500" : "bg-amber-500"}
                />
                <KPICard
                    title="Active Contracts"
                    value={portfolioData?.length || 0}
                    icon={Activity}
                    color="bg-indigo-500"
                />
                <KPICard
                    title="Contracts At Risk"
                    value={riskyContracts.length}
                    subtext={`< ${marginThreshold}% Margin`}
                    icon={AlertTriangle}
                    color={riskyContracts.length > 0 ? "bg-red-500" : "bg-emerald-500"}
                />
            </div>

            {/* Main Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Visual: Revenue by Portfolio */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Revenue by Portfolio</CardTitle>
                        <CardDescription>Breakdown of total forecast revenue across business units.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={portfolioChartData}>
                                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value / 1000000}M`} />
                                <Tooltip formatter={(value) => currency(value)} cursor={{ fill: '#f3f4f6' }} />
                                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Interactive: Margin Stress Test */}
                <Card className="lg:col-span-1 bg-gradient-to-br from-slate-900 to-slate-800 text-white border-none shadow-xl">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="text-yellow-400" size={20} />
                            <CardTitle className="text-white">Stress Test</CardTitle>
                        </div>
                        <CardDescription className="text-slate-400">
                            Identify contracts that fail to meet a minimum margin threshold.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-6">
                        {/* Slider Control */}
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-slate-300">Minimum Margin Target</span>
                                <span className="text-xl font-bold text-yellow-400">{marginThreshold}%</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="20"
                                step="0.5"
                                value={marginThreshold}
                                onChange={(e) => setMarginThreshold(parseFloat(e.target.value))}
                                className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-yellow-400"
                            />
                            <div className="flex justify-between text-xs text-slate-500 mt-1">
                                <span>0%</span>
                                <span>20%</span>
                            </div>
                        </div>

                        {/* Result List */}
                        <div className="flex-1 overflow-y-auto max-h-[200px] pr-2 space-y-2">
                            {riskyContracts.length === 0 ? (
                                <div className="text-center py-8 text-slate-500 text-sm">
                                    All contracts involve healthy margins!
                                </div>
                            ) : (
                                riskyContracts.map(c => (
                                    <div key={c.id} className="bg-white/10 p-3 rounded flex justify-between items-center text-sm border border-white/5">
                                        <div className="flex flex-col">
                                            <span className="font-semibold">{c.contract_code}</span>
                                            <span className="text-xs text-slate-400">{c.name}</span>
                                        </div>
                                        <div className="text-red-400 font-mono font-bold">
                                            {c.current_margin_pct.toFixed(1)}%
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

        </div>
    )
}
