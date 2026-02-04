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
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
                <CardTitle className="text-sm font-medium">Saved Scenarios</CardTitle>
                <Button size="sm" variant="ghost" onClick={() => setIsCreating(true)} disabled={isCreating}>
                    <Plus size={16} />
                </Button>
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
                            className={`flex items-center justify-between p-3 border-b cursor-pointer hover:bg-gray-50 transition-colors ${selectedScenarioId === scenario.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
                            onClick={() => onScenarioSelect(scenario.id)}
                        >
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-800">{scenario.name}</span>
                                <span className="text-xs text-gray-500">{scenario.scenario_type}</span>
                            </div>
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
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
