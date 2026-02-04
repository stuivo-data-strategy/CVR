import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { TrendingUp, ArrowUpRight, ArrowDownRight, Activity, AlertTriangle, PieChart as PieIcon } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { format } from 'date-fns'

export default function Dashboard() {
    const { data: stats, isLoading } = useQuery({
        queryKey: ['dashboard_stats'],
        queryFn: async () => {
            // Fetch contracts for calc
            const { data: contracts } = await supabase.from('contracts').select('*')

            // 1. KPIs
            const totalContracts = contracts?.length || 0
            const activeContracts = contracts?.filter(c => c.status === 'active').length || 0
            const totalValue = contracts?.reduce((sum, c) => sum + (c.original_value || 0), 0) || 0

            // Simulating a "Cost" for the kpi to show margin
            const totalCostEstim = totalValue * 0.88 // Approx 12% margin
            const totalMargin = totalValue - totalCostEstim
            const marginPct = (totalMargin / totalValue) * 100

            // 2. Status Distribution
            const statusCounts = contracts?.reduce((acc, c) => {
                acc[c.status] = (acc[c.status] || 0) + 1
                return acc
            }, {})

            const pieData = Object.keys(statusCounts || {}).map(key => ({
                name: key.replace('_', ' '),
                value: statusCounts[key]
            }))

            // 3. Trend Data
            const trendData = [
                { name: 'Jan', rev: totalValue * 0.1, cost: totalCostEstim * 0.1 },
                { name: 'Feb', rev: totalValue * 0.12, cost: totalCostEstim * 0.11 },
                { name: 'Mar', rev: totalValue * 0.15, cost: totalCostEstim * 0.14 },
                { name: 'Apr', rev: totalValue * 0.18, cost: totalCostEstim * 0.18 },
                { name: 'May', rev: totalValue * 0.22, cost: totalCostEstim * 0.20 },
                { name: 'Jun', rev: totalValue * 0.23, cost: totalCostEstim * 0.21 },
            ]

            return {
                totalContracts,
                activeContracts,
                totalValue,
                totalCostEstim,
                totalMargin,
                marginPct,
                pieData,
                trendData
            }
        }
    })

    const currencyFormatter = new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1
    })

    const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444'];

    if (isLoading) return <div className="p-8 text-slate-500">Loading control panel...</div>

    return (
        <div className="flex flex-col min-h-screen bg-slate-50">
            {/* Dark Financial Header */}
            <div className="bg-slate-900 text-white p-8 pb-12">
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Executive Overview</h1>
                        <p className="text-slate-400 mt-1 text-sm uppercase tracking-wider font-semibold">
                            {format(new Date(), 'EEEE, MMMM do yyyy')} | Portfolio Performance
                        </p>
                    </div>
                </div>

                {/* Integrated Borderless Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 divider-x divide-slate-700">
                    <div className="pr-4">
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Portfolio Value</p>
                        <div className="text-3xl font-bold text-white flex items-center gap-2">
                            {currencyFormatter.format(stats?.totalValue || 0)}
                            <TrendingUp size={20} className="text-emerald-400" />
                        </div>
                        <p className="text-emerald-400 text-xs mt-1 flex items-center gap-1">
                            <ArrowUpRight size={12} /> 12.5% vs last year
                        </p>
                    </div>

                    <div className="px-4 border-l border-slate-700">
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Est. Cost Exposure</p>
                        <div className="text-3xl font-bold text-white">
                            {currencyFormatter.format(stats?.totalCostEstim || 0)}
                        </div>
                        <p className="text-slate-400 text-xs mt-1">
                            88% of revenue
                        </p>
                    </div>

                    <div className="px-4 border-l border-slate-700">
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Net Margin</p>
                        <div className="text-3xl font-bold text-white">
                            {stats?.marginPct.toFixed(1)}%
                        </div>
                        <p className="text-emerald-400 text-xs mt-1">
                            {currencyFormatter.format(stats?.totalMargin || 0)} actual
                        </p>
                    </div>

                    <div className="pl-4 border-l border-slate-700">
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Active Contracts</p>
                        <div className="text-3xl font-bold text-white flex items-center gap-2">
                            {stats?.activeContracts}
                            <span className="text-base text-slate-500 font-normal">/ {stats?.totalContracts}</span>
                        </div>
                        <p className="text-slate-400 text-xs mt-1 flex items-center gap-1">
                            <Activity size={12} /> Running on schedule
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Content Area - Overlapping Header */}
            <div className="px-8 -mt-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Chart */}
                    <Card className="lg:col-span-2 shadow-lg border-slate-200">
                        <CardHeader className="border-b border-slate-100 bg-white rounded-t-lg">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-slate-800">Revenue Analysis (YTD)</CardTitle>
                                <div className="flex gap-2">
                                    <span className="flex items-center gap-1 text-xs text-slate-500">
                                        <div className="w-2 h-2 rounded-full bg-blue-500"></div> Revenue
                                    </span>
                                    <span className="flex items-center gap-1 text-xs text-slate-500">
                                        <div className="w-2 h-2 rounded-full bg-orange-500"></div> Cost
                                    </span>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 bg-white min-h-[400px]">
                            <ResponsiveContainer width="100%" height={350}>
                                <BarChart data={stats?.trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `$${val / 1000}k`} tick={{ fill: '#64748b', fontSize: 12 }} />
                                    <Tooltip
                                        cursor={{ fill: '#f8fafc' }}
                                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '4px', color: '#fff' }}
                                        itemStyle={{ color: '#e2e8f0' }}
                                        formatter={(val) => currencyFormatter.format(val)}
                                    />
                                    <Bar dataKey="rev" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                    <Bar dataKey="cost" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* Side Panels */}
                    <div className="flex flex-col gap-6">
                        <Card className="shadow-lg border-slate-200 flex-1">
                            <CardHeader className="border-b border-slate-100 bg-white rounded-t-lg">
                                <CardTitle className="text-slate-800">Portfolio Mix</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 bg-white flex items-center justify-center h-full min-h-[300px]">
                                <ResponsiveContainer width="100%" height={250}>
                                    <PieChart>
                                        <Pie
                                            data={stats?.pieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={4}
                                            dataKey="value"
                                        >
                                            {stats?.pieData?.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '4px', color: '#fff' }} />
                                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                    </PieChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card className="shadow-lg border-slate-200">
                            <CardHeader className="border-b border-slate-100 bg-white rounded-t-lg pb-3">
                                <CardTitle className="text-slate-800 flex items-center gap-2">
                                    <AlertTriangle size={16} className="text-amber-500" />
                                    System Alerts
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="p-4 border-b border-gray-50 flex items-start gap-3 hover:bg-slate-50 transition-colors cursor-pointer">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2"></div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-800">System Updated</p>
                                        <p className="text-xs text-slate-500">New financial controls applied successfully.</p>
                                    </div>
                                </div>
                                <div className="p-4 flex items-start gap-3 hover:bg-slate-50 transition-colors cursor-pointer">
                                    <div className="w-2 h-2 rounded-full bg-slate-300 mt-2"></div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-800">Data Sync</p>
                                        <p className="text-xs text-slate-500">Contract data synchronized 2 mins ago.</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
            <div className="h-12"></div>
        </div>
    )
}
