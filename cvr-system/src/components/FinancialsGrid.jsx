import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Button } from './ui/Button'
import { Plus } from 'lucide-react'
import { format, addMonths, startOfMonth } from 'date-fns'
import styles from './FinancialsGrid.module.css'

export default function FinancialsGrid({ contractId }) {
    const queryClient = useQueryClient()
    const [editingCell, setEditingCell] = useState(null) // { periodId, type, category }
    const [editValue, setEditValue] = useState('')

    // Fetch periods and related data
    const { data: periods, isLoading } = useQuery({
        queryKey: ['contract_periods', contractId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('contract_periods')
                .select(`
                id,
                period_month,
                contract_revenue (id, amount, revenue_type),
                contract_costs (id, amount, cost_type, category)
            `)
                .eq('contract_id', contractId)
                .eq('is_baseline', false)
                .order('period_month', { ascending: true })

            if (error) throw error
            return data
        }
    })

    const addNextMonth = async () => {
        let nextMonth = startOfMonth(new Date())
        if (periods && periods.length > 0) {
            const lastPeriod = periods[periods.length - 1]
            nextMonth = addMonths(new Date(lastPeriod.period_month), 1)
        }

        const { error } = await supabase.from('contract_periods').insert({
            contract_id: contractId,
            period_month: nextMonth.toISOString(),
            is_baseline: false,
            version: 1
        })

        if (error) alert(error.message)
        else queryClient.invalidateQueries(['contract_periods', contractId])
    }

    // Update mutations
    const updateRevenue = async (periodId, amount, currentRecordId) => {
        // If record exists, update. If not, insert.
        // For simplicity, we assume we are editing 'actual' revenue for now.
        const revenue_type = 'actual'

        let error;
        if (currentRecordId) {
            const { error: e } = await supabase.from('contract_revenue').update({ amount }).eq('id', currentRecordId)
            error = e
        } else {
            const { error: e } = await supabase.from('contract_revenue').insert({
                contract_period_id: periodId,
                revenue_type,
                amount
            })
            error = e
        }

        if (error) alert(error.message)
        else {
            queryClient.invalidateQueries(['contract_periods', contractId])
            setEditingCell(null)
        }
    }

    const updateCost = async (periodId, amount, currentRecordId) => {
        // Simplified: Total cost editing implies we need a default category or something.
        // But schema requires category. Let's assume 'other' for single row edit, 
        // or prompts "We need to breakdown costs". 
        // For this Grid V1, let's just map to 'other' category and 'actual' cost_type if creating new.
        const cost_type = 'actual'
        const category = 'other'

        let error;
        if (currentRecordId) {
            const { error: e } = await supabase.from('contract_costs').update({ amount }).eq('id', currentRecordId)
            error = e
        } else {
            const { error: e } = await supabase.from('contract_costs').insert({
                contract_period_id: periodId,
                cost_type,
                category,
                amount
            })
            error = e
        }
        if (error) alert(error.message)
        else {
            queryClient.invalidateQueries(['contract_periods', contractId])
            setEditingCell(null)
        }
    }

    const handleCellClick = (periodId, type, currentAmount) => {
        setEditingCell({ periodId, type })
        setEditValue(currentAmount || '')
    }

    const handleBlur = (period, type) => {
        // Find current record ID if exists
        // This logic is a bit naive for multiple records (e.g. multiple cost categories).
        // For this prototype, we'll just summing up visual, but editing might be ambiguous.
        // Let's grab the FIRST 'actual' record for simplicity for now.

        const amount = parseFloat(editValue) || 0

        if (type === 'revenue') {
            const record = period.contract_revenue?.find(r => r.revenue_type === 'actual')
            updateRevenue(period.id, amount, record?.id)
        } else if (type === 'cost') {
            // Warning: this overwrites the first cost record found or creates new 'other'
            // Ideally we expand rows for categories.
            const record = period.contract_costs?.find(c => c.cost_type === 'actual')
            updateCost(period.id, amount, record?.id)
        }
    }

    const handleKeyDown = (e, period, type) => {
        if (e.key === 'Enter') {
            handleBlur(period, type)
        }
    }

    const getRevenue = (period) => {
        // Sum only actuals for display in this "Actuals" view? Or all? 
        // Let's assume this grid is "Latest Position" so we sum actuals + forecast?
        // User story says: "Add/edit actual revenue & cost"
        // Let's stick to ACTUALS for now.
        return period.contract_revenue?.filter(r => r.revenue_type === 'actual').reduce((sum, r) => sum + (r.amount || 0), 0) || 0
    }

    const getCost = (period) => {
        return period.contract_costs?.filter(c => c.cost_type === 'actual').reduce((sum, c) => sum + (c.amount || 0), 0) || 0
    }

    // Currency formatter
    const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)

    return (
        <div className={styles.container}>
            <div className={styles.toolbar}>
                <Button size="sm" onClick={addNextMonth}>
                    <Plus size={16} className="mr-2" />
                    Add Period
                </Button>
            </div>

            <div className={styles.gridContainer}>
                <table className={styles.grid}>
                    <thead>
                        <tr>
                            <th className={styles.thFirst}>Category (Actuals)</th>
                            {periods?.map(p => (
                                <th key={p.id} className={styles.th}>
                                    {format(new Date(p.period_month), 'MMM yyyy')}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className={styles.tdCategory}>Revenue</td>
                            {periods?.map(p => {
                                const isEditing = editingCell?.periodId === p.id && editingCell?.type === 'revenue'
                                const val = getRevenue(p)
                                return (
                                    <td key={p.id} className={styles.tdValue} onClick={() => !isEditing && handleCellClick(p.id, 'revenue', val)}>
                                        {isEditing ? (
                                            <input
                                                autoFocus
                                                className={styles.cellInput}
                                                value={editValue}
                                                onChange={e => setEditValue(e.target.value)}
                                                onBlur={() => handleBlur(p, 'revenue')}
                                                onKeyDown={(e) => handleKeyDown(e, p, 'revenue')}
                                            />
                                        ) : formatCurrency(val)}
                                    </td>
                                )
                            })}
                        </tr>
                        <tr>
                            <td className={styles.tdCategory}>Cost</td>
                            {periods?.map(p => {
                                const isEditing = editingCell?.periodId === p.id && editingCell?.type === 'cost'
                                const val = getCost(p)
                                return (
                                    <td key={p.id} className={styles.tdValue} onClick={() => !isEditing && handleCellClick(p.id, 'cost', val)}>
                                        {isEditing ? (
                                            <input
                                                autoFocus
                                                className={styles.cellInput}
                                                value={editValue}
                                                onChange={e => setEditValue(e.target.value)}
                                                onBlur={() => handleBlur(p, 'cost')}
                                                onKeyDown={(e) => handleKeyDown(e, p, 'cost')}
                                            />
                                        ) : formatCurrency(val)}
                                    </td>
                                )
                            })}
                        </tr>
                        <tr className={styles.trTotal}>
                            <td className={styles.tdCategory}>Margin</td>
                            {periods?.map(p => {
                                const m = getRevenue(p) - getCost(p)
                                return (
                                    <td key={p.id} className={`${styles.tdValue} ${m < 0 ? styles.negative : ''}`}>
                                        {formatCurrency(m)}
                                    </td>
                                )
                            })}
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    )
}
