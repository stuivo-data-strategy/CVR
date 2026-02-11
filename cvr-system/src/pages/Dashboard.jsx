import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card'
import { AlertCircle, TrendingUp, DollarSign, Activity, PieChart as PieChartIcon, Target, Flag } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'
import { format } from 'date-fns'

export default function Dashboard() {
    // Fetch Portfolio Risk Types
    const { data: riskData, isLoading } = useQuery({
        queryKey: ['portfolio_risk'],
        queryFn: async () => {
            const { data, error } = await supabase.from('view_portfolio_risk').select('*')
            if (error) {
                console.error("Dashboard Error:", error)
                throw new Error("Failed to load Risk Data. Please ensure 'view_portfolio_risk' exists. Details: " + error.message)
            }
            return data
        }
    })

    // --- AGGREGATIONS FOR CHARTS ---

    const chartData = useMemo(() => {
        if (!riskData) return { buData: [], riskDist: [] }

        // Revenue by Business Unit
        const buMap = {}
        riskData.forEach(c => {
            const bu = c.portfolio || c.business_unit || 'Unassigned'
            if (!buMap[bu]) buMap[bu] = 0
            buMap[bu] += (c.final_revenue || 0)
        })
        const buData = Object.entries(buMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

        // Risk Distribution
        const riskMap = { low: 0, medium: 0, high: 0 }
        riskData.forEach(c => {
            if (riskMap[c.risk_status] !== undefined) riskMap[c.risk_status]++
        })
        const riskDist = [
            { name: 'On Track', value: riskMap.low, color: '#10b981' }, // emerald-500
            { name: 'At Risk', value: riskMap.medium, color: '#f59e0b' }, // amber-500
            { name: 'Critical', value: riskMap.high, color: '#ef4444' }, // red-500
        ].filter(d => d.value > 0)

        return { buData, riskDist }
    }, [riskData])


    // Calculate aggregated KPIs
    const totalRevenue = riskData?.reduce((sum, c) => sum + (c.final_revenue || 0), 0) || 0
    const totalMargin = riskData?.reduce((sum, c) => sum + (c.final_margin || 0), 0) || 0
    const weightedMarginPct = totalRevenue ? (totalMargin / totalRevenue) * 100 : 0

    const atRiskCount = riskData?.filter(c => c.risk_status !== 'low').length || 0
    const highRiskCount = riskData?.filter(c => c.risk_status === 'high').length || 0

    const atRiskContracts = riskData?.filter(c => c.risk_status !== 'low')
        .sort((a, b) => a.margin_variance - b.margin_variance) // Worst erosion first

    if (isLoading) return <div className="p-8 flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>
    if (!riskData && !isLoading) return (
        <div className="p-8 text-red-600 bg-red-50 rounded border border-red-200 m-6">
            <h2 className="text-xl font-bold mb-2">Dashboard Error</h2>
            <p>Could not load portfolio data. Please ensure the database migration for Phase 9 has been run.</p>
        </div>
    )

    return (
        <div className="flex flex-col gap-8 p-6 max-w-7xl mx-auto min-h-screen bg-gray-50/50">

            {/* HERO SECTION */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 p-8 text-white shadow-xl">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight mb-2">Portfolio Overview</h1>
                        <p className="text-indigo-100 max-w-xl">
                            Real-time insights into contract performance, margin erosion, and financial risks across your entire portfolio.
                        </p>
                    </div>
                    <div className="flex gap-4">
                        <div className="text-right">
                            <p className="text-sm text-indigo-200 font-medium uppercase tracking-wider">Total Pipeline</p>
                            <p className="text-4xl font-bold">${(totalRevenue / 1000000).toFixed(1)}M</p>
                        </div>
                        <div className="w-px bg-indigo-400/30 mx-2 self-stretch"></div>
                        <div className="text-right">
                            <p className="text-sm text-indigo-200 font-medium uppercase tracking-wider">Avg Margin</p>
                            <p className="text-4xl font-bold">{weightedMarginPct.toFixed(1)}%</p>
                        </div>
                    </div>
                </div>

                {/* Decorative Background Elements */}
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl pointer-events-none"></div>
            </div>

            {/* KPI GRID */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Active Contracts Card */}
                <Card className="hover:shadow-md transition-shadow border-t-4 border-t-blue-500">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-wide">Active Contracts</CardTitle>
                        <Activity className="h-5 w-5 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-gray-900">{riskData?.length || 0}</div>
                        <p className="text-xs text-gray-500 mt-1">Projects currently in execution</p>
                    </CardContent>
                </Card>

                {/* At Risk Card */}
                <Card className={`hover:shadow-md transition-shadow border-t-4 ${atRiskCount > 0 ? 'border-t-amber-500' : 'border-t-green-500'}`}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-wide">Contracts At Risk</CardTitle>
                        <AlertCircle className={`h-5 w-5 ${atRiskCount > 0 ? 'text-amber-500' : 'text-green-500'}`} />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-gray-900">{atRiskCount}</div>
                        <p className="text-xs text-gray-500 mt-1">
                            {highRiskCount > 0 ? (
                                <span className="text-red-600 font-medium">{highRiskCount} Critical Attention Required</span>
                            ) : (
                                "Monitor potential slippage"
                            )}
                        </p>
                    </CardContent>
                </Card>

                {/* Portfolio Health */}
                <Card className="hover:shadow-md transition-shadow border-t-4 border-t-emerald-500">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-wide">Portfolio Health</CardTitle>
                        <Target className="h-5 w-5 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-gray-900">
                            {Math.round(((riskData?.length - atRiskCount) / (riskData?.length || 1)) * 100)}%
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Contracts performing on target</p>
                    </CardContent>
                </Card>
            </div>

            {/* CHARTS SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue Breakdown */}
                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>Revenue by Portfolio</CardTitle>
                        <CardDescription>Total forecast revenue distribution across units</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData.buData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" tickFormatter={(val) => `$${(val / 1000000).toFixed(1)}M`} />
                                <YAxis dataKey="name" type="category" width={100} />
                                <Tooltip formatter={(val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val)} cursor={{ fill: 'transparent' }} />
                                <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={32} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Risk Distribution */}
                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>Risk Profile</CardTitle>
                        <CardDescription>Proportion of contracts by risk status</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData.riskDist}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {chartData.riskDist.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* WATCHLIST TABLE */}
            <Card className="shadow-md border-0 ring-1 ring-black/5">
                <CardHeader className="bg-gray-50/50 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <Flag className="text-red-500 h-5 w-5" />
                        <div>
                            <CardTitle className="text-lg text-gray-900">At Risk Watchlist</CardTitle>
                            <CardDescription>Contracts eroding margin vs baseline target.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-50/50 border-b">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Contract</th>
                                    <th className="px-6 py-4 font-medium text-center">Status</th>
                                    <th className="px-6 py-4 font-medium text-right">Target Margin</th>
                                    <th className="px-6 py-4 font-medium text-right">Forecast</th>
                                    <th className="px-6 py-4 font-medium text-right">Variance</th>
                                    <th className="px-6 py-4 font-medium text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {atRiskContracts?.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="p-3 bg-green-50 rounded-full">
                                                    <Target className="h-6 w-6 text-green-600" />
                                                </div>
                                                <p className="font-medium text-gray-900">All Clear</p>
                                                <p className="text-sm">No contracts currently flagged as 'At Risk'.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    atRiskContracts?.map((c) => (
                                        <tr key={c.contract_id} className="bg-white hover:bg-gray-50/80 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-semibold text-gray-900">{c.contract_code}</div>
                                                <div className="text-xs text-gray-500">{c.contract_name} • {c.owner_name}</div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${c.risk_status === 'high'
                                                    ? 'bg-red-50 text-red-700 ring-1 ring-red-600/10'
                                                    : 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/10'
                                                    }`}>
                                                    {c.risk_status.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right text-gray-600">
                                                {c.target_margin_pct?.toFixed(1)}%
                                            </td>
                                            <td className="px-6 py-4 text-right font-medium text-gray-900">
                                                {c.current_forecast_margin_pct?.toFixed(1)}%
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`font-bold ${c.margin_variance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                    {c.margin_variance > 0 ? '+' : ''}{c.margin_variance?.toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Link
                                                    to={`/contracts/${c.contract_id}?tab=reports`}
                                                    className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors"
                                                >
                                                    Analysis
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
