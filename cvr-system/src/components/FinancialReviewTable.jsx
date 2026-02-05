import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/Card'
import { Button } from './ui/Button'
import { Printer } from 'lucide-react'

export default function FinancialReviewTable({ contractId }) {

    // 1. Fetch Cost Breakdown
    const { data: costs } = useQuery({
        queryKey: ['financial_review_costs', contractId],
        queryFn: async () => {
            const { data } = await supabase
                .from('view_financial_review_costs')
                .select('*')
                .eq('contract_id', contractId)
                .order('sort_order', { ascending: true })
            return data
        }
    })

    // 2. Fetch Revenue Summary
    const { data: revenue } = useQuery({
        queryKey: ['financial_review_revenue', contractId],
        queryFn: async () => {
            const { data } = await supabase
                .from('view_financial_review_revenue')
                .select('*')
                .eq('contract_id', contractId)
                .single()
            return data
        }
    })

    // 3. Fetch Itemized Changes (Adjustments)
    const { data: changes } = useQuery({
        queryKey: ['financial_review_changes', contractId],
        queryFn: async () => {
            const { data } = await supabase
                .from('view_financial_review_changes')
                .select('*')
                .eq('contract_id', contractId)
            return data
        }
    })

    // Helpers
    const filterByGroup = (group) => costs?.filter(c => c.group_name === group) || []
    const sum = (dataset, col) => dataset?.reduce((acc, item) => acc + (item[col] || 0), 0) || 0
    const fmt = (val) => val === 0 ? '-' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(val)
    const fmtQty = (val) => val === 0 ? '-' : new Intl.NumberFormat('en-US').format(val)
    const fmtPct = (val) => val === 0 ? '-' : `${val.toFixed(1)}%`

    // --- AGGREGATES FOR SUMMARY ---
    // Total Costs (Calculated from lines)
    const totalCostEAC = sum(costs, 'eac_cost')
    const totalCostActual = sum(costs, 'actual_cost')
    const totalCostForecast = sum(costs, 'forecast_to_complete')
    const totalCostOriginal = sum(costs, 'original_budget')

    // Revenue Aggregates
    const revOriginal = revenue?.original_revenue || 0
    const revEAC = revenue?.eac_revenue || 0

    // Styles
    const cellBase = "px-3 py-1.5 text-xs text-right border"
    const cellHeader = "px-3 py-2 text-center text-xs font-bold bg-gray-100 border uppercase"
    const cellLabel = "px-3 py-1.5 text-left text-xs font-medium text-gray-900 border"
    const rowSubtotal = "bg-gray-100 font-bold border-t-2 border-gray-300"

    // Render Row Function
    const renderRows = (items, labelFn, qtyMode = false) => (
        items.map((item, idx) => (
            <tr key={item.category_id || idx} className="hover:bg-gray-50">
                <td className={cellLabel}>{labelFn(item)}</td>
                <td className={cellBase}>{qtyMode ? fmtQty(item.original_qty) : fmt(item.original_budget)}</td>
                <td className={cellBase}>{qtyMode ? fmtQty(item.agreed_qty) : fmt(item.agreed_variations)}</td>
                <td className={`${cellBase} text-amber-600`}>{qtyMode ? fmtQty(item.unsigned_qty) : fmt(item.unsigned_variations)}</td>
                <td className={`${cellBase} bg-gray-50`}>{qtyMode ? fmtQty(item.est_final_qty) : fmt(item.estimated_final_budget)}</td>
                <td className={cellBase}>{qtyMode ? fmtQty(item.actual_qty) : fmt(item.actual_cost)}</td>
                <td className={cellBase}>{qtyMode ? fmtQty(item.forecast_qty) : fmt(item.forecast_to_complete)}</td>
                <td className={`${cellBase} text-gray-500`}>
                    {qtyMode ? fmtQty(item.previous_forecast_qty) : fmt(item.previous_forecast)}
                </td>
            </tr>
        ))
    )

    return (
        <Card className="print:shadow-none print:border-none">
            <CardHeader className="flex flex-row items-center justify-between py-4">
                <CardTitle className="text-lg">Detailed Financial Review</CardTitle>
                <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
                    <Printer size={16} /> Print
                </Button>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300 text-xs text-gray-800">
                        {/* HEADER */}
                        <thead>
                            <tr>
                                <th className="px-3 py-2 text-left bg-gray-200 border w-[200px]">Description</th>
                                <th className={cellHeader}>Original Price</th>
                                <th className={cellHeader}>Agreed Vars</th>
                                <th className={cellHeader}>Unsigned Vars</th>
                                <th className={cellHeader}>Est. Contract Price</th>
                                <th className={cellHeader}>Actual to Date</th>
                                <th className={cellHeader}>Forecast Comp.</th>
                                <th className={cellHeader}>Prev. Forecast</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* --- SECTION 1: HOURS (Direct Labour Only) --- */}
                            <tr className="bg-blue-900 text-white font-bold"><td colSpan={8} className="px-3 py-1">HOURS</td></tr>
                            {renderRows(filterByGroup('Direct Labour'), c => c.category_name, true)}
                            {/* Hours Total Row?? User asked for specific rows like 'Seed Corp', 'External'. Assuming 'Direct Labour' contains these categories or similar */}
                            <tr className="bg-blue-50 font-bold border-t">
                                <td className={cellLabel}>Total Hours</td>
                                {/* Summing quantities for Direct Labour */}
                                <td className={cellBase}>{fmtQty(sum(filterByGroup('Direct Labour'), 'original_qty'))}</td>
                                <td className={cellBase}>{fmtQty(sum(filterByGroup('Direct Labour'), 'agreed_qty'))}</td>
                                <td className={cellBase}>{fmtQty(sum(filterByGroup('Direct Labour'), 'unsigned_qty'))}</td>
                                <td className={cellBase}>{fmtQty(sum(filterByGroup('Direct Labour'), 'est_final_qty'))}</td>
                                <td className={cellBase}>{fmtQty(sum(filterByGroup('Direct Labour'), 'actual_qty'))}</td>
                                <td className={cellBase}>{fmtQty(sum(filterByGroup('Direct Labour'), 'forecast_qty'))}</td>
                                <td className={cellBase}>{fmtQty(sum(filterByGroup('Direct Labour'), 'previous_forecast_qty'))}</td>
                            </tr>

                            <tr className="h-4 border-none"><td colSpan={8}></td></tr>

                            {/* --- SECTION 2: COSTS --- */}
                            <tr className="bg-blue-900 text-white font-bold"><td colSpan={8} className="px-3 py-1">COSTS</td></tr>

                            {/* Labour Costs */}
                            <tr className="bg-gray-100 font-semibold"><td colSpan={8} className="px-3 py-1 border">Labour</td></tr>
                            {renderRows(filterByGroup('Direct Labour'), c => c.category_name)}
                            <tr className={rowSubtotal}>
                                <td className={cellLabel}>Labour Total</td>
                                <td className={cellBase}>{fmt(sum(filterByGroup('Direct Labour'), 'original_budget'))}</td>
                                <td className={cellBase}>{fmt(sum(filterByGroup('Direct Labour'), 'agreed_variations'))}</td>
                                <td className={cellBase}>{fmt(sum(filterByGroup('Direct Labour'), 'unsigned_variations'))}</td>
                                <td className={cellBase}>{fmt(sum(filterByGroup('Direct Labour'), 'estimated_final_budget'))}</td>
                                <td className={cellBase}>{fmt(sum(filterByGroup('Direct Labour'), 'actual_cost'))}</td>
                                <td className={cellBase}>{fmt(sum(filterByGroup('Direct Labour'), 'forecast_to_complete'))}</td>
                                <td className={cellBase}>{fmt(sum(filterByGroup('Direct Labour'), 'previous_forecast'))}</td>
                            </tr>

                            {/* Non-Labour Costs */}
                            <tr className="bg-gray-100 font-semibold"><td colSpan={8} className="px-3 py-1 border">Non Labour</td></tr>
                            {/* Render other groups excluding Labour */}
                            {['Materials', 'Subcontractors', 'Other Direct Costs'].map(group => {
                                const groupItems = filterByGroup(group)
                                if (groupItems.length === 0) return null
                                return (
                                    <React.Fragment key={group}>
                                        <tr className="italic"><td colSpan={8} className="px-3 py-0.5 text-gray-500 border">{group}</td></tr>
                                        {renderRows(groupItems, c => c.category_name)}
                                    </React.Fragment>
                                )
                            })}

                            {/* TOTAL COSTS */}
                            <tr className="bg-gray-200 font-bold border-t-2 border-black">
                                <td className={cellLabel}>TOTAL COSTS</td>
                                <td className={cellBase}>{fmt(totalCostOriginal)}</td>
                                <td className={cellBase}>{fmt(sum(costs, 'agreed_variations'))}</td>
                                <td className={cellBase}>{fmt(sum(costs, 'unsigned_variations'))}</td>
                                <td className={cellBase}>{fmt(sum(costs, 'estimated_final_budget'))}</td>
                                <td className={cellBase}>{fmt(totalCostActual)}</td>
                                <td className={cellBase}>{fmt(totalCostForecast)}</td>
                                <td className={cellBase}>{fmt(sum(costs, 'previous_forecast'))}</td>
                            </tr>

                            <tr className="h-4 border-none"><td colSpan={8}></td></tr>

                            {/* --- SECTION 3: REVENUE --- */}
                            <tr className="bg-blue-900 text-white font-bold"><td colSpan={8} className="px-3 py-1">REVENUE</td></tr>
                            <tr className="font-semibold">
                                <td className={cellLabel}>Contract Revenue</td>
                                <td className={cellBase}>{fmt(revenue?.original_revenue)}</td>
                                <td className={cellBase}>{fmt(revenue?.agreed_variations_revenue)}</td>
                                <td className={cellBase}>{fmt(revenue?.unsigned_variations_revenue)}</td>
                                <td className={cellBase}>{fmt(revenue?.estimated_final_revenue)}</td>
                                <td className={cellBase}>{fmt(revenue?.actual_revenue)}</td>
                                <td className={cellBase}>{fmt(revenue?.forecast_revenue)}</td>
                                <td className={cellBase}>{fmt(revenue?.previous_forecast_revenue)}</td>
                            </tr>

                            {/* REVENUE ADJUSTMENTS (CHANGES) */}
                            <tr className="bg-gray-100 font-semibold"><td colSpan={8} className="px-3 py-1 border">Revenue Adjustments</td></tr>
                            {changes?.filter(c => c.revenue_delta !== 0).map(c => (
                                <tr key={c.change_code} className="text-gray-600 italic">
                                    <td className={cellLabel}>{c.change_code}: {c.title}</td>
                                    <td className={cellBase}>-</td>
                                    <td className={cellBase}>{c.status === 'approved' ? fmt(c.revenue_delta) : '-'}</td>
                                    <td className={cellBase}>{c.status === 'proposed' ? fmt(c.revenue_delta) : '-'}</td>
                                    <td className={cellBase}>{fmt(c.revenue_delta)}</td>{/* Adds to Est Price */}
                                    <td className={cellBase}>-</td>
                                    <td className={cellBase}>{fmt(c.revenue_delta)}</td>{/* Forecasts full amount? */}
                                    <td className={cellBase}>-</td>
                                </tr>
                            ))}
                            {/* Subtotal Revenue */}
                            <tr className="bg-blue-50 font-bold">
                                <td className={cellLabel}>Revised Revenue</td>
                                <td className={cellBase}>{fmt(revOriginal)}</td>
                                <td className={cellBase}>{fmt(revenue?.agreed_variations_revenue)}</td>
                                <td className={cellBase}>{fmt(revenue?.unsigned_variations_revenue)}</td>
                                <td className={cellBase}>{fmt(revEAC)}</td>{/* Assuming Est ~ EAC for revenue here */}
                                <td className={cellBase}>{fmt(revenue?.actual_revenue)}</td>
                                <td className={cellBase}>{fmt(revenue?.forecast_revenue)}</td>
                                <td className={cellBase}>{fmt(revenue?.previous_forecast_revenue)}</td>
                            </tr>

                            <tr className="h-4 border-none"><td colSpan={8}></td></tr>

                            {/* --- SECTION 4: MARGIN --- */}
                            <tr className="bg-green-100 font-bold border-t-2 border-green-600">
                                <td className={cellLabel}>REVISED MARGIN ($)</td>
                                <td className={cellBase}>{fmt(revOriginal - totalCostOriginal)}</td>
                                <td className={cellBase}>{fmt((revenue?.agreed_variations_revenue || 0) - sum(costs, 'agreed_variations'))}</td>
                                <td className={cellBase}>{fmt((revenue?.unsigned_variations_revenue || 0) - sum(costs, 'unsigned_variations'))}</td>
                                <td className={cellBase}>{fmt((revenue?.estimated_final_revenue || 0) - sum(costs, 'estimated_final_budget'))}</td>
                                <td className={cellBase}>{fmt((revenue?.actual_revenue || 0) - totalCostActual)}</td>
                                <td className={cellBase}>{fmt((revenue?.forecast_revenue || 0) - totalCostForecast)}</td>
                                <td className={cellBase}>
                                    {fmt((revenue?.previous_forecast_revenue || 0) - (sum(costs, 'previous_forecast') || 0))}
                                </td>
                            </tr>
                            <tr className="bg-green-50 font-bold border-b-2 border-green-600 text-blue-800">
                                <td className={cellLabel}>PROFIT %</td>
                                <td className={cellBase}>{revOriginal ? fmtPct(((revOriginal - totalCostOriginal) / revOriginal) * 100) : '-'}</td>
                                <td className={cellBase}>-</td>
                                <td className={cellBase}>-</td>
                                <td className={cellBase}>{revenue?.estimated_final_revenue ? fmtPct(((revenue.estimated_final_revenue - sum(costs, 'estimated_final_budget')) / revenue.estimated_final_revenue) * 100) : '-'}</td>
                                <td className={cellBase}>-</td>
                                <td className={cellBase}>-</td>
                                <td className={cellBase}>
                                    {(revenue?.previous_forecast_revenue) ?
                                        fmtPct(((revenue.previous_forecast_revenue - sum(costs, 'previous_forecast')) / revenue.previous_forecast_revenue) * 100)
                                        : '-'}
                                </td>
                            </tr>

                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    )
}
