import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'

export default function FinancialsGrid({ contractId }) {
    // 1. Fetch active cost categories for headers
    const { data: categories } = useQuery({
        queryKey: ['cost_categories'],
        queryFn: async () => {
            const { data } = await supabase
                .from('cost_categories')
                .select('id, name, code')
                .eq('is_active', true)
                .order('sort_order', { ascending: true })
            return data || []
        }
    })

    // 2. Fetch periods with detailed cost data
    const { data: periods, isLoading } = useQuery({
        queryKey: ['contract_periods', contractId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('contract_periods')
                .select(`
                id,
                period_month,
                contract_revenue (amount),
                contract_costs (amount, category_id)
            `)
                .eq('contract_id', contractId)
                .eq('is_baseline', false)
                .order('period_month', { ascending: true })

            if (error) throw error
            return data
        }
    })

    // Helper to sum arrays
    const sum = (arr) => arr?.reduce((acc, curr) => acc + (curr.amount || 0), 0) || 0

    // Helper to sum by category
    const sumByCategory = (costs, catId) => {
        return costs?.filter(c => c.category_id === catId)
            .reduce((acc, curr) => acc + (curr.amount || 0), 0) || 0
    }

    const currencyFormatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    })

    if (isLoading) return <div className="p-4 text-center">Loading financials...</div>

    return (
        <div className="overflow-x-auto rounded-md border border-gray-200">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                    <tr>
                        <th className="px-6 py-3 sticky left-0 bg-gray-50 z-10">Month</th>
                        <th className="px-6 py-3 text-right text-blue-600">Revenue</th>

                        {/* Dynamic Cost Category Headers */}
                        {categories?.map(cat => (
                            <th key={cat.id} className="px-4 py-3 text-right text-gray-500 font-medium">
                                {cat.name}
                            </th>
                        ))}

                        <th className="px-6 py-3 text-right font-bold text-gray-800">Total Cost</th>
                        <th className="px-6 py-3 text-right">Margin</th>
                        <th className="px-6 py-3 text-right">Margin %</th>
                    </tr>
                </thead>
                <tbody>
                    {periods?.map((period) => {
                        const revenue = sum(period.contract_revenue)
                        const totalCost = sum(period.contract_costs)
                        const margin = revenue - totalCost
                        const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0

                        return (
                            <tr key={period.id} className="bg-white border-b hover:bg-gray-50">
                                <td className="px-6 py-4 font-medium text-gray-900 sticky left-0 bg-white">
                                    {format(new Date(period.period_month), 'MMM yyyy')}
                                </td>
                                <td className="px-6 py-4 text-right font-medium text-blue-600">
                                    {currencyFormatter.format(revenue)}
                                </td>

                                {/* Dynamic Cost Category Cells */}
                                {categories?.map(cat => {
                                    const catAmount = sumByCategory(period.contract_costs, cat.id)
                                    return (
                                        <td key={cat.id} className="px-4 py-4 text-right text-gray-500">
                                            {catAmount !== 0 ? currencyFormatter.format(catAmount) : '-'}
                                        </td>
                                    )
                                })}

                                <td className="px-6 py-4 text-right font-bold text-gray-800">
                                    {currencyFormatter.format(totalCost)}
                                </td>
                                <td className={`px-6 py-4 text-right font-medium ${margin < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {currencyFormatter.format(margin)}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    {marginPct.toFixed(1)}%
                                </td>
                            </tr>
                        )
                    })}
                    {(!periods || periods.length === 0) && (
                        <tr>
                            <td colSpan={5 + (categories?.length || 0)} className="px-6 py-8 text-center text-gray-500">
                                No financial data available for this contract.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    )
}
