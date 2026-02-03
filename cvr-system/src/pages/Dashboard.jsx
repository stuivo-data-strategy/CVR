import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { FileText, DollarSign, TrendingUp, AlertTriangle } from 'lucide-react'

export default function Dashboard() {
    const { data: stats, isLoading } = useQuery({
        queryKey: ['dashboard_stats'],
        queryFn: async () => {
            // 1. Count contracts
            const { count: contractCount, error: err1 } = await supabase.from('contracts').select('*', { count: 'exact', head: true })

            // 2. Sum original value
            const { data: valueData, error: err2 } = await supabase.from('contracts').select('original_value')
            const totalValue = valueData?.reduce((sum, c) => sum + (c.original_value || 0), 0) || 0

            // 3. Count active changes
            const { count: changesCount, error: err3 } = await supabase.from('contract_changes').select('*', { count: 'exact', head: true }).eq('status', 'proposed')

            if (err1 || err2 || err3) throw new Error('Failed to fetch stats')

            return { contractCount, totalValue, changesCount }
        }
    })

    // Format currency
    const currencyFormatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: 'compact',
        maximumFractionDigits: 1
    })

    if (isLoading) return <div className="p-8">Loading dashboard...</div>

    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-2xl font-bold">Dashboard</h1>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Total Contracts</CardTitle>
                        <FileText size={16} className="text-gray-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.contractCount || 0}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Portfolio Value</CardTitle>
                        <DollarSign size={16} className="text-gray-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{currencyFormatter.format(stats?.totalValue || 0)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Proposed Changes</CardTitle>
                        <TrendingUp size={16} className="text-gray-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.changesCount || 0}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Risks</CardTitle>
                        <AlertTriangle size={16} className="text-gray-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">0</div>
                        <p className="text-xs text-gray-500">No high risks flagged</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="min-h-[300px]">
                    <CardHeader><CardTitle>Portfolio Margin Trend</CardTitle></CardHeader>
                    <CardContent className="flex items-center justify-center text-gray-400">
                        Chart placeholder
                    </CardContent>
                </Card>
                <Card className="min-h-[300px]">
                    <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
                    <CardContent className="flex items-center justify-center text-gray-400">
                        Activity feed placeholder
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
