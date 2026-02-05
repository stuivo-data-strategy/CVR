import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card'
import { AlertCircle, TrendingUp, DollarSign, Activity } from 'lucide-react'
import { Link } from 'react-router-dom'

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

    if (isLoading) return <div className="p-8">Loading Dashboard...</div>
    if (!riskData && !isLoading) return (
        <div className="p-8 text-red-600 bg-red-50 rounded border border-red-200 m-6">
            <h2 className="text-xl font-bold mb-2">Dashboard Error</h2>
            <p>Could not load portfolio data. Please ensure the database migration for Phase 9 has been run.</p>
        </div>
    )

    // Calculate aggregated KPIs
    const totalRevenue = riskData?.reduce((sum, c) => sum + (c.final_revenue || 0), 0) || 0
    const totalMargin = riskData?.reduce((sum, c) => sum + (c.final_margin || 0), 0) || 0
    const weightedMarginPct = totalRevenue ? (totalMargin / totalRevenue) * 100 : 0

    const atRiskCount = riskData?.filter(c => c.risk_status !== 'low').length || 0
    const highRiskCount = riskData?.filter(c => c.risk_status === 'high').length || 0

    const atRiskContracts = riskData?.filter(c => c.risk_status !== 'low')
        .sort((a, b) => a.margin_variance - b.margin_variance) // Worst erosion first

    return (
        <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold text-gray-900">Portfolio Overview</h1>
                <p className="text-gray-500">Executive Summary & Risk Analysis</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Total Pipeline Value</CardTitle>
                        <DollarSign className="h-4 w-4 text-gray-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            ${(totalRevenue / 1000000).toFixed(1)}M
                        </div>
                        <p className="text-xs text-gray-500">Forecast Revenue</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Portfolio Margin</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {weightedMarginPct.toFixed(1)}%
                        </div>
                        <p className="text-xs text-gray-500">Weighted Average</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Contracts At Risk</CardTitle>
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-600">
                            {atRiskCount}
                        </div>
                        <p className="text-xs text-gray-500">{highRiskCount} Critical</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Active Contracts</CardTitle>
                        <Activity className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {riskData?.length || 0}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* WATCHLIST */}
            <Card className="border-red-100 shadow-sm">
                <CardHeader className="bg-red-50/30 border-b border-red-100">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="text-red-500" />
                        <div>
                            <CardTitle className="text-lg text-red-900">At Risk Watchlist</CardTitle>
                            <CardDescription>Contracts eroding margin vs baseline target.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="relative overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                                <tr>
                                    <th className="px-6 py-3">Contract</th>
                                    <th className="px-6 py-3 text-center">Risk Level</th>
                                    <th className="px-6 py-3 text-right">Target Margin</th>
                                    <th className="px-6 py-3 text-right">Current Forecast</th>
                                    <th className="px-6 py-3 text-right">Variance</th>
                                    <th className="px-6 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {atRiskContracts?.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                            No contracts currently flagged as 'At Risk'. Great job!
                                        </td>
                                    </tr>
                                ) : (
                                    atRiskContracts?.map((c) => (
                                        <tr key={c.contract_id} className="bg-white border-b hover:bg-gray-50">
                                            <td className="px-6 py-4 font-medium text-gray-900">
                                                {c.contract_code} - {c.contract_name}
                                                <div className="text-xs text-gray-500 font-normal">{c.owner_name}</div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${c.risk_status === 'high' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                                                    }`}>
                                                    {c.risk_status.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {c.target_margin_pct?.toFixed(1)}%
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold">
                                                {c.current_forecast_margin_pct?.toFixed(1)}%
                                            </td>
                                            <td className={`px-6 py-4 text-right font-bold ${c.margin_variance < 0 ? 'text-red-600' : 'text-green-600'
                                                }`}>
                                                {c.margin_variance?.toFixed(1)}%
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Link
                                                    to={`/contracts/${c.contract_id}?tab=reports`}
                                                    className="font-medium text-blue-600 hover:underline"
                                                >
                                                    View Report
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
