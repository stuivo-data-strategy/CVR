import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { Button } from '../ui/Button'
import { Plus, Trash2, Check, X } from 'lucide-react'

export default function ScenarioManager({ contractId, selectedScenarioId, onScenarioSelect }) {
    const queryClient = useQueryClient()
    const [isCreating, setIsCreating] = useState(false)
    const [newScenarioName, setNewScenarioName] = useState('')

    // Fetch Scenarios
    const { data: scenarios, isLoading } = useQuery({
        queryKey: ['scenarios', contractId],
        queryFn: async () => {
            const { data } = await supabase
                .from('contract_scenarios')
                .select('*')
                .eq('contract_id', contractId)
                .order('created_at', { ascending: false })
            return data || []
        }
    })

    // Create Scenario
    const createMutation = useMutation({
        mutationFn: async (name) => {
            const { error } = await supabase
                .from('contract_scenarios')
                .insert({
                    contract_id: contractId,
                    name: name,
                    scenario_type: 'custom',
                    description: 'User created scenario'
                })
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['scenarios', contractId])
            setIsCreating(false)
            setNewScenarioName('')
        }
    })

    // Promote Scenario
    const promoteMutation = useMutation({
        mutationFn: async (id) => {
            // 1. Get linked changes
            const { data: links } = await supabase
                .from('contract_scenario_changes')
                .select('contract_change_id, contract_changes(*, contract_change_impacts(*))')
                .eq('scenario_id', id)

            if (!links || links.length === 0) throw new Error("No changes in this scenario to promote")

            const changes = links.map(l => l.contract_changes)
            const changeIds = changes.map(c => c.id)

            // 2. Update status to 'approved'
            const { error: updateErr } = await supabase
                .from('contract_changes')
                .update({ status: 'approved', approval_date: new Date().toISOString() })
                .in('id', changeIds)

            if (updateErr) throw updateErr

            // 3. Bake into Base Forecast (Revenue/Costs)
            // We need to map impacts (by Month) to Contract Periods (by ID)

            // 3a. Fetch Periods
            const { data: periods } = await supabase
                .from('contract_periods')
                .select('id, period_month')
                .eq('contract_id', contractId)

            const periodMap = new Map() // 'YYYY-MM-DD' -> uuid
            periods?.forEach(p => periodMap.set(p.period_month, p.id))

            const revInserts = []
            const costInserts = []

            for (const change of changes) {
                // If detailed impacts exist, use them. Else use Headline.
                const hasDetailed = change.contract_change_impacts && change.contract_change_impacts.length > 0

                if (hasDetailed) {
                    for (const imp of change.contract_change_impacts) {
                        const pid = periodMap.get(imp.period_month)
                        if (pid) {
                            if (imp.revenue_delta) revInserts.push({ contract_period_id: pid, revenue_type: 'forecast', amount: imp.revenue_delta })
                            if (imp.cost_delta) costInserts.push({ contract_period_id: pid, cost_type: 'forecast', amount: imp.cost_delta })
                        }
                    }
                } else {
                    // Headline Fallback
                    // Normalize effective date to 1st of month
                    const effDate = new Date(change.effective_date)
                    effDate.setDate(1)
                    const dateKey = effDate.toISOString().slice(0, 10)
                    const pid = periodMap.get(dateKey)

                    if (pid) {
                        if (change.revenue_delta) revInserts.push({ contract_period_id: pid, revenue_type: 'forecast', amount: change.revenue_delta })
                        if (change.cost_delta) costInserts.push({ contract_period_id: pid, cost_type: 'forecast', amount: change.cost_delta })
                    }
                }
            }

            if (revInserts.length) await supabase.from('contract_revenue').insert(revInserts)
            if (costInserts.length) await supabase.from('contract_costs').insert(costInserts)

            // 4. Unlink from Scenario (Cleanup)
            await supabase.from('contract_scenario_changes').delete().eq('scenario_id', id)

        },
        onSuccess: () => {
            queryClient.invalidateQueries(['scenarios', contractId])
            queryClient.invalidateQueries(['contract', contractId])
            queryClient.invalidateQueries(['financials', contractId]) // Force chart refresh
            alert('Scenario promoted! Changes are now Approved and added to the Forecast.')
        }
    })

    // Delete Scenario
    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            const { error } = await supabase
                .from('contract_scenarios')
                .delete()
                .eq('id', id)
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['scenarios', contractId])
            if (selectedScenarioId) onScenarioSelect(null)
        }
    })

    if (isLoading) return <div>Loading scenarios...</div>

    return (
        <Card className="h-full">
            <CardHeader className="flex flex-col gap-2 pb-2 border-b">
                <div className="flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-medium">Saved Scenarios</CardTitle>
                </div>
                {!isCreating && (
                    <Button size="sm" variant="outline" className="w-full flex items-center justify-center gap-2 text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => setIsCreating(true)}>
                        <Plus size={16} />
                        Create New Scenario
                    </Button>
                )}
            </CardHeader>
            <CardContent className="p-0">
                {isCreating && (
                    <div className="p-3 border-b bg-blue-50 flex gap-2">
                        <input
                            className="flex-1 px-2 py-1 text-sm border rounded"
                            placeholder="Scenario Name..."
                            value={newScenarioName}
                            onChange={e => setNewScenarioName(e.target.value)}
                            autoFocus
                        />
                        <Button size="sm" onClick={() => createMutation.mutate(newScenarioName)} disabled={!newScenarioName}>
                            <Check size={14} />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setIsCreating(false)}>
                            <X size={14} />
                        </Button>
                    </div>
                )}

                <div className="max-h-[300px] overflow-y-auto">
                    {scenarios?.length === 0 && !isCreating && (
                        <div className="p-8 text-center text-gray-400 text-xs">
                            No scenarios created yet.
                        </div>
                    )}

                    {scenarios?.map(scenario => (
                        <div
                            key={scenario.id}
                            className={`flex flex-col p-3 border-b cursor-pointer hover:bg-gray-50 transition-colors ${selectedScenarioId === scenario.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
                            onClick={() => onScenarioSelect(scenario.id)}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-800">{scenario.name}</span>
                                {selectedScenarioId === scenario.id && (
                                    <button
                                        className="text-gray-400 hover:text-red-500 p-1"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            if (confirm('Delete this scenario?')) deleteMutation.mutate(scenario.id)
                                        }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                            <span className="text-xs text-gray-500 mb-2">{scenario.scenario_type}</span>

                            {selectedScenarioId === scenario.id && (
                                <Button
                                    size="sm"
                                    className="w-full mt-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        if (confirm('Promote this scenario? \n\nThis will APPROVE all associated changes and add them to the official forecast.')) {
                                            promoteMutation.mutate(scenario.id)
                                        }
                                    }}
                                >
                                    Promote to Forecast
                                </Button>
                            )}
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
