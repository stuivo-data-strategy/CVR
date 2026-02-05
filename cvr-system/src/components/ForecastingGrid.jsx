import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { format, parseISO } from 'date-fns'
import { Save, AlertCircle } from 'lucide-react'
import { Button } from './ui/Button'

export default function ForecastingGrid({ contractId }) {
    const queryClient = useQueryClient()
    const [edits, setEdits] = useState({}) // Key: "periodId-type-catId", Value: amount
    const [saving, setSaving] = useState(false)

    // 1. Fetch Categories
    const { data: categories } = useQuery({
        queryKey: ['cost_categories'],
        queryFn: async () => {
            const { data } = await supabase.from('cost_categories').select('id, name, code').eq('is_active', true).order('sort_order')
            return data || []
        }
    })

    // 2. Fetch Periods & Data
    const { data: periods, isLoading } = useQuery({
        queryKey: ['forecasting_periods', contractId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('contract_periods')
                .select(`
                    id, period_month,
                    contract_revenue (id, amount, revenue_type),
                    contract_costs (id, amount, cost_type, category_id)
                `)
                .eq('contract_id', contractId)
                .order('period_month', { ascending: true })
            if (error) throw error
            return data
        }
    })

    // Helpers: Strict Selection (Ignore Baseline)
    const getActiveRecord = (records, typeField) => {
        if (!records) return null
        // Priority: Actual > Forecast. Ignore Baseline.
        return records.find(r => r[typeField] === 'actual') ||
            records.find(r => r[typeField] === 'forecast')
    }

    const getRevenue = (p) => getActiveRecord(p.contract_revenue, 'revenue_type')
    const getCost = (p, catId) => {
        const costs = p.contract_costs?.filter(c => c.category_id === catId)
        return getActiveRecord(costs, 'cost_type')
    }

    // Determine if row is editable (Forecast vs Actual)
    const isRowEditable = (p) => {
        const rec = getRevenue(p)
        // If it's actual, locked. If forecast (or null/missing), editable.
        return rec?.revenue_type !== 'actual'
    }

    const handleChange = (periodId, type, catId, value) => {
        // Use pipe separator to avoid clash with UUID hyphens
        const key = `${periodId}|${type}|${catId || 'revenue'}`
        setEdits(prev => ({ ...prev, [key]: parseFloat(value) || 0 }))
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const updates = []

            for (const [key, value] of Object.entries(edits)) {
                const [periodId, type, catId] = key.split('|')

                if (type === 'revenue') {
                    // Update Revenue: Delete existing forecast and insert new
                    // (We use delete+insert because there is no unique constraint on period+type to allow clean upserts)
                    await supabase.from('contract_revenue').delete()
                        .eq('contract_period_id', periodId)
                        .eq('revenue_type', 'forecast')

                    await supabase.from('contract_revenue').insert({
                        contract_period_id: periodId,
                        revenue_type: 'forecast',
                        amount: value
                    })

                } else {
                    // Upsert Cost
                    await supabase.from('contract_costs').delete()
                        .eq('contract_period_id', periodId)
                        .eq('category_id', catId)
                        .eq('cost_type', 'forecast')

                    await supabase.from('contract_costs').insert({
                        contract_period_id: periodId,
                        category_id: catId,
                        cost_type: 'forecast',
                        amount: value
                    })
                }
            }

            await queryClient.invalidateQueries(['forecasting_periods', contractId])
            await queryClient.invalidateQueries(['financials', contractId]) // Update charts
            setEdits({})
            alert('Forecast saved!')
        } catch (err) {
            alert('Error saving: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    if (isLoading) return <div>Loading grid...</div>

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center bg-yellow-50 p-3 rounded border border-yellow-200">
                <div className="flex items-center gap-2 text-sm text-yellow-800">
                    <AlertCircle size={16} />
                    <span>Gray rows are <strong>Actuals</strong> (Locked). White rows are <strong>Forecast</strong> (Editable).</span>
                </div>
                {Object.keys(edits).length > 0 && (
                    <Button size="sm" onClick={handleSave} disabled={saving}>
                        <Save size={16} className="mr-2" />
                        {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                )}
            </div>

            <div className="overflow-x-auto border rounded-lg shadow-sm">
                <table className="w-full text-sm">
                    <thead className="bg-gray-100 text-gray-700 font-semibold border-b">
                        <tr>
                            <th className="px-4 py-3 text-left w-32 sticky left-0 bg-gray-100">Month</th>
                            <th className="px-4 py-3 text-right w-32 text-blue-700 border-l">Revenue</th>
                            {categories?.map(c => (
                                <th key={c.id} className="px-4 py-3 text-right w-32 border-l">{c.name}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {periods?.map(p => {
                            const isEditable = isRowEditable(p)
                            const rowClass = isEditable ? 'bg-white' : 'bg-gray-100/50 text-gray-500'

                            // Revenue
                            const revData = getRevenue(p)
                            const revVal = edits[`${p.id}|revenue|revenue`] ?? revData?.amount ?? 0

                            return (
                                <tr key={p.id} className={`${rowClass} border-b hover:bg-gray-50`}>
                                    <td className="px-4 py-2 font-medium sticky left-0 bg-inherit">
                                        {format(parseISO(p.period_month), 'MMM yyyy')}
                                    </td>

                                    {/* Revenue Input */}
                                    <td className="px-2 py-2 border-l">
                                        <input
                                            type="number"
                                            disabled={!isEditable}
                                            value={revVal}
                                            onChange={(e) => handleChange(p.id, 'revenue', null, e.target.value)}
                                            className={`w-full text-right px-2 py-1 rounded border-transparent hover:border-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all ${!isEditable && 'bg-transparent'}`}
                                        />
                                    </td>

                                    {/* Cost Inputs */}
                                    {categories?.map(cat => {
                                        const costData = getCost(p, cat.id)
                                        const costVal = edits[`${p.id}|cost|${cat.id}`] ?? costData?.amount ?? 0
                                        return (
                                            <td key={cat.id} className="px-2 py-2 border-l">
                                                <input
                                                    type="number"
                                                    disabled={!isEditable}
                                                    value={costVal}
                                                    onChange={(e) => handleChange(p.id, 'cost', cat.id, e.target.value)}
                                                    className={`w-full text-right px-2 py-1 rounded border-transparent hover:border-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all ${!isEditable && 'bg-transparent'}`}
                                                />
                                            </td>
                                        )
                                    })}
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
