import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/Dialog'
import { Button } from './ui/Button'
import { supabase } from '../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { Calculator, TrendingUp, ArrowRight } from 'lucide-react'
import { addMonths, format, parseISO } from 'date-fns'

export default function ForecastGeneratorModal({ isOpen, onClose, contractId, categories, periods }) {
    const queryClient = useQueryClient()
    const [step, setStep] = useState(1)
    const [method, setMethod] = useState('ctc') // 'ctc' (Cost to Complete) or 'run_rate'
    const [targetCategory, setTargetCategory] = useState('ALL') // 'ALL' or specific category ID
    const [totalValue, setTotalValue] = useState('') // For CTC
    const [loading, setLoading] = useState(false)

    // Helper: Sort periods
    const sortedPeriods = [...(periods || [])].sort((a, b) => new Date(a.period_month) - new Date(b.period_month))

    // Helper: Find Active Record (Actual or Forecast)
    const getActive = (records, typeField) => records?.find(r => r[typeField] === 'actual' || r[typeField] === 'forecast')

    // Helper: Get future periods (Forecast)
    const futurePeriods = sortedPeriods.filter(p => {
        const rev = getActive(p.contract_revenue, 'revenue_type')
        // If Actual, it's past. If Forecast or Missing, it's future.
        return rev?.revenue_type !== 'actual'
    })
    const countFuture = futurePeriods.length

    // Helper: Calculate Run Rate (Average of last 3 actuals)
    const calculateRunRate = () => {
        // Find actuals
        const actuals = sortedPeriods.filter(p => {
            const rev = getActive(p.contract_revenue, 'revenue_type')
            return rev?.revenue_type === 'actual'
        })

        // Take last 3
        const last3 = actuals.slice(-3)
        if (last3.length === 0) return 0

        const sum = last3.reduce((acc, p) => {
            let val = 0
            if (targetCategory === 'REVENUE') {
                const r = getActive(p.contract_revenue, 'revenue_type')
                val = r?.amount || 0
            } else if (targetCategory !== 'ALL') {
                const costs = p.contract_costs?.filter(c => c.category_id === targetCategory)
                const c = getActive(costs, 'cost_type')
                val = c?.amount || 0
            }
            return acc + val
        }, 0)

        return sum / last3.length
    }

    const runRate = calculateRunRate()

    const handleApply = async () => {
        setLoading(true)
        try {
            if (countFuture === 0) throw new Error("No future forecast periods found to spread over.")

            let monthlyAmount = 0

            if (method === 'ctc') {
                const amountToSpread = parseFloat(totalValue)
                if (isNaN(amountToSpread)) throw new Error("Invalid Amount")
                monthlyAmount = amountToSpread / countFuture
            } else {
                monthlyAmount = runRate
            }

            // Apply to DB
            let successCount = 0
            for (const p of futurePeriods) {
                if (targetCategory === 'REVENUE') {
                    // Update Revenue: Delete existing forecast and insert new
                    const { error: delErr } = await supabase.from('contract_revenue').delete()
                        .eq('contract_period_id', p.id)
                        .eq('revenue_type', 'forecast')

                    if (delErr) throw delErr

                    const { error: insErr } = await supabase.from('contract_revenue').insert({
                        contract_period_id: p.id,
                        revenue_type: 'forecast',
                        amount: monthlyAmount
                    })

                    if (insErr) throw insErr

                } else if (targetCategory !== 'ALL') {
                    // Specific Cost Category
                    const { error: delErr } = await supabase.from('contract_costs').delete()
                        .eq('contract_period_id', p.id)
                        .eq('category_id', targetCategory)
                        .eq('cost_type', 'forecast')

                    if (delErr) throw delErr

                    const { error: insErr } = await supabase.from('contract_costs').insert({
                        contract_period_id: p.id,
                        category_id: targetCategory,
                        cost_type: 'forecast',
                        amount: monthlyAmount
                    })
                    if (insErr) throw insErr
                }
            }

            await queryClient.invalidateQueries({ queryKey: ['forecasting_periods', contractId] })
            await queryClient.invalidateQueries({ queryKey: ['financials', contractId] })

            onClose()
            alert(`Successfully applied forecast of ${monthlyAmount.toFixed(2)} / month.`)
        } catch (err) {
            alert(err.message)
        } finally {
            setLoading(false)
        }
    }

    // Is Button Disabled?
    const isApplyDisabled = loading || (method === 'ctc' && !totalValue)

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <Calculator className="text-blue-600" /> Smart Forecast Generator
                </DialogTitle>
            </DialogHeader>
            <DialogContent>
                <div className="flex flex-col gap-6 py-4">
                    {/* Step 1: Target */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-gray-700">1. Select Target Line</label>
                        <select
                            className="border p-2 rounded"
                            value={targetCategory}
                            onChange={(e) => setTargetCategory(e.target.value)}
                        >
                            <option value="REVENUE">Total Revenue</option>
                            <option disabled>--- Cost Categories ---</option>
                            {categories?.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Step 2: Method */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-gray-700">2. Calculation Method</label>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setMethod('ctc')}
                                className={`p-4 border rounded-lg text-left flex flex-col gap-2 transition-all ${method === 'ctc' ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}
                            >
                                <span className="font-bold text-sm flex items-center gap-2">
                                    <ArrowRight size={16} /> Flatten to End
                                </span>
                                <span className="text-xs text-gray-500">Spread a lump sum evenly over remaining months.</span>
                            </button>
                            <button
                                onClick={() => setMethod('run_rate')}
                                className={`p-4 border rounded-lg text-left flex flex-col gap-2 transition-all ${method === 'run_rate' ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}
                            >
                                <span className="font-bold text-sm flex items-center gap-2">
                                    <TrendingUp size={16} /> Use Run Rate
                                </span>
                                <span className="text-xs text-gray-500">Average of last 3 months applied forward.</span>
                            </button>
                        </div>
                    </div>

                    {/* Step 3: Inputs */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-gray-700">
                            3. {method === 'ctc' ? (targetCategory === 'REVENUE' ? 'Remaining Revenue to Recognize' : 'Cost to Complete (CTC)') : 'Projected Monthly Rate'}
                        </label>

                        {method === 'ctc' ? (
                            <>
                                <input
                                    type="number"
                                    className="border p-2 rounded text-lg font-mono"
                                    placeholder="0.00"
                                    value={totalValue}
                                    onChange={(e) => setTotalValue(e.target.value)}
                                />
                                <p className="text-xs text-gray-500">
                                    Will be spread over <strong>{countFuture} remaining months</strong>
                                    {countFuture > 0 && totalValue && ` (~${(parseFloat(totalValue) / countFuture).toFixed(2)} / month)`}.
                                </p>
                            </>
                        ) : (
                            <div className="p-3 bg-gray-50 border rounded text-lg font-mono text-gray-700">
                                {runRate.toFixed(2)} / month
                                <p className="text-xs text-gray-500 mt-1 font-sans">
                                    Based on average of last 3 actual periods.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
            <DialogFooter>
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button onClick={handleApply} disabled={isApplyDisabled}>
                    {loading ? 'Applying...' : 'Apply Forecast'}
                </Button>
            </DialogFooter>
        </Dialog>
    )
}
