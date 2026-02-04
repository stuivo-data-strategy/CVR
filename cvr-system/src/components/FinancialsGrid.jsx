import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'

export default function FinancialsGrid({ contractId }) {
    // Fetch periods and related data
    const { data: periods, isLoading } = useQuery({
        queryKey: ['contract_periods', contractId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('contract_periods')
                .select(`
                id,
                period_month,
                contract_revenue (amount),
                contract_costs (amount)
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

    const currencyFormatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    })

    if (isLoading) return <div className="p-4 text-center">Loading financials...</div>

    return (
        <div className="overflow-x-auto rounded-md border border-gray-200">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                    <tr>
                        <th className="px-6 py-3">Month</th>
                        <th className="px-6 py-3 text-right">Revenue</th>
                        <th className="px-6 py-3 text-right">Cost</th>
                        <th className="px-6 py-3 text-right">Margin</th>
                        <th className="px-6 py-3 text-right">Margin %</th>
                    </tr>
                </thead>
                <tbody>
                    {periods?.map((period) => {
                        const revenue = sum(period.contract_revenue)
                        const cost = sum(period.contract_costs)
                        const margin = revenue - cost
                        const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0

                        return (
                            <tr key={period.id} className="bg-white border-b hover:bg-gray-50">
                                <td className="px-6 py-4 font-medium text-gray-900">
                                    {format(new Date(period.period_month), 'MMM yyyy')}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    {currencyFormatter.format(revenue)}
                                </td>
                                <td className="px-6 py-4 text-right text-gray-600">
                                    {currencyFormatter.format(cost)}
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
                            <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                No financial data available for this contract.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    )
}
