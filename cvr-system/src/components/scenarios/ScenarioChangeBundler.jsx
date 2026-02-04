import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { Checkbox } from '../ui/Checkbox' // Assuming we have or will treat basic input
import { Badge } from 'lucide-react'

export default function ScenarioChangeBundler({ contractId, scenarioId }) {
    const queryClient = useQueryClient()

    // 1. Fetch ALL Proposed Changes for this Contract
    const { data: proposedChanges, isLoading: changesLoading } = useQuery({
        queryKey: ['proposed_changes', contractId],
        queryFn: async () => {
            const { data } = await supabase
                .from('contract_changes')
                .select('*')
                .eq('contract_id', contractId)
                .eq('status', 'proposed')
            return data || []
        }
    })

    // 2. Fetch Changes ALREADY in this Scenario
    const { data: scenarioChanges, isLoading: linkLoading } = useQuery({
        queryKey: ['scenario_changes_link', scenarioId],
        queryFn: async () => {
            const { data } = await supabase
                .from('contract_scenario_changes')
                .select('contract_change_id')
                .eq('scenario_id', scenarioId)
            return data?.map(d => d.contract_change_id) || []
        },
        enabled: !!scenarioId
    })

    // Toggle Mutation
    const toggleMutation = useMutation({
        mutationFn: async ({ changeId, isLinked }) => {
            if (isLinked) {
                // Remove
                await supabase
                    .from('contract_scenario_changes')
                    .delete()
                    .eq('scenario_id', scenarioId)
                    .eq('contract_change_id', changeId)
            } else {
                // Add
                await supabase
                    .from('contract_scenario_changes')
                    .insert({ scenario_id: scenarioId, contract_change_id: changeId })
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['scenario_changes_link', scenarioId])
            queryClient.invalidateQueries(['scenario_forecast', contractId, scenarioId])
        }
    })

    if (!scenarioId) return <div className="text-gray-400 text-sm p-4 text-center border rounded">Select a scenario to bundle changes</div>
    if (changesLoading || linkLoading) return <div>Loading changes...</div>

    return (
        <div className="border rounded-md bg-white">
            <div className="p-3 border-b bg-gray-50 flex justify-between items-center">
                <h4 className="font-semibold text-sm">Bundle Proposed Changes</h4>
                <span className="text-xs text-gray-500 bg-white border px-2 py-0.5 rounded">
                    {proposedChanges?.length} available
                </span>
            </div>
            <div className="max-h-[300px] overflow-y-auto p-2 space-y-2">
                {proposedChanges?.map(change => {
                    const isLinked = scenarioChanges?.includes(change.id)
                    return (
                        <div key={change.id} className={`flex items-center gap-3 p-3 rounded border text-sm transition-colors ${isLinked ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100 hover:bg-gray-50'}`}>
                            <input
                                type="checkbox"
                                checked={isLinked}
                                onChange={() => toggleMutation.mutate({ changeId: change.id, isLinked })}
                                className="h-4 w-4 text-blue-600 rounded"
                            />
                            <div className="flex-1">
                                <div className="flex justify-between">
                                    <span className="font-medium text-gray-900">{change.title || change.change_code}</span>
                                    <span className={`text-xs px-1.5 rounded ${change.margin_impact >= 0 ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'}`}>
                                        Margin: {change.revenue_delta ? ((change.revenue_delta - change.cost_delta) / change.revenue_delta * 100).toFixed(1) : 0}%
                                    </span>
                                </div>
                                <div className="text-xs text-gray-500 mt-1 flex gap-2">
                                    <span>Rev: ${change.revenue_delta}</span>
                                    <span>Cost: ${change.cost_delta}</span>
                                </div>
                            </div>
                        </div>
                    )
                })}
                {proposedChanges?.length === 0 && (
                    <div className="text-center p-4 text-gray-400 text-xs">
                        No 'Proposed' changes found to bundle.
                    </div>
                )}
            </div>
        </div>
    )
}
