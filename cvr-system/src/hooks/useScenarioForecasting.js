import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { format, parseISO } from 'date-fns'

// Helper to ensure consistent keys
const normalizeDate = (dateStr) => {
    if (!dateStr) return null
    try {
        const d = new Date(dateStr)
        d.setDate(1) // Force 1st
        return d.toISOString().slice(0, 10) // YYYY-MM-DD
    } catch (e) {
        return dateStr
    }
}

export function useScenarioForecasting(contractId, scenarioId = null) {
    return useQuery({
        queryKey: ['scenario_forecast', contractId, scenarioId],
        queryFn: async () => {
            // 1. Fetch Integration: Base Monthly Summary (Current Forecast)
            const { data: baseData, error: baseError } = await supabase
                .from('contract_monthly_summary_view')
                .select('*')
                .eq('contract_id', contractId)
                .order('period_month', { ascending: true })

            if (baseError) throw baseError

            // Data structure for lookup
            const baseMap = new Map()
            baseData?.forEach(item => {
                const key = normalizeDate(item.period_month)
                if (key) baseMap.set(key, item)
            })

            // Impact Map
            const impactMap = new Map()

            // 2. Fetch Scenario Impacts (Only if scenario selected)
            if (scenarioId) {
                const { data: impacts, error: impactError } = await supabase
                    .from('contract_scenario_changes')
                    .select(`
                        contract_change_id,
                        contract_changes (
                            id,
                            revenue_delta,
                            cost_delta,
                            effective_date,
                            contract_change_impacts (
                                period_month,
                                revenue_delta,
                                cost_delta
                            )
                        )
                    `)
                    .eq('scenario_id', scenarioId)

                if (impactError) throw impactError

                // Flatten impacts
                impacts?.forEach(item => {
                    const change = item.contract_changes

                    if (change) {
                        // Check if specific time-phased impacts exist
                        const hasDetailedImpacts = change.contract_change_impacts && change.contract_change_impacts.length > 0

                        if (hasDetailedImpacts) {
                            // Use detailed impacts
                            change.contract_change_impacts.forEach(imp => {
                                const rawMonth = imp.period_month
                                const month = normalizeDate(rawMonth)
                                if (!month) return

                                const current = impactMap.get(month) || { rev: 0, cost: 0 }
                                impactMap.set(month, {
                                    rev: current.rev + (imp.revenue_delta || 0),
                                    cost: current.cost + (imp.cost_delta || 0)
                                })
                            })
                        } else {
                            // FALLBACK: Use Headline Delta applied to Effective Date
                            const effectiveDate = change.effective_date
                            if (effectiveDate) {
                                const monthKey = normalizeDate(effectiveDate)
                                if (monthKey) {
                                    const current = impactMap.get(monthKey) || { rev: 0, cost: 0 }
                                    impactMap.set(monthKey, {
                                        rev: current.rev + (change.revenue_delta || 0),
                                        cost: current.cost + (change.cost_delta || 0)
                                    })
                                }
                            }
                        }
                    }
                })
            }

            // 3. Merge Unique Time Periods
            const allMonths = new Set([...baseMap.keys(), ...impactMap.keys()])
            const sortedMonths = Array.from(allMonths).sort((a, b) => new Date(a) - new Date(b))

            // 4. Build Final Data Series
            return sortedMonths.map(monthKey => {
                const baseItem = baseMap.get(monthKey) || {}
                const impacts = impactMap.get(monthKey) || { rev: 0, cost: 0 }

                // Safe Defaults
                const baseRev = baseItem.revenue || 0
                const baseCost = baseItem.cost || 0
                const baseMargin = baseItem.margin || 0
                // Calculate base margin % if missing (e.g. inferred zero-rev month)
                let baseMarginPct = baseItem.margin_pct
                if (baseMarginPct === undefined) {
                    baseMarginPct = baseRev !== 0 ? (baseMargin / baseRev) * 100 : 0
                }

                // Scenario Values
                const scenarioRev = baseRev + impacts.rev
                const scenarioCost = baseCost + impacts.cost
                const scenarioMargin = scenarioRev - scenarioCost
                const scenarioMarginPct = scenarioRev !== 0 ? (scenarioMargin / scenarioRev) * 100 : 0

                return {
                    period: format(parseISO(monthKey), 'MMM yyyy'),
                    period_iso: monthKey,

                    // Base
                    revenue: baseRev,
                    cost: baseCost,
                    margin_pct: baseMarginPct,

                    // Scenario
                    scenario_revenue: scenarioRev,
                    scenario_cost: scenarioCost,
                    scenario_margin_pct: scenarioMarginPct,

                    // Deltas
                    delta_revenue: impacts.rev,
                    delta_cost: impacts.cost
                }
            })
        }
    })
}
