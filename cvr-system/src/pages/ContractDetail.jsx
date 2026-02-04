import React from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import FinancialsGrid from '../components/FinancialsGrid'
import ChangeLog from '../components/ChangeLog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs'
import { ForecastingChart } from '../components/ForecastingChart'
import { format } from 'date-fns'
import ScenarioManager from '../components/scenarios/ScenarioManager'
import ScenarioComparisonChart from '../components/scenarios/ScenarioComparisonChart'
import ScenarioChangeBundler from '../components/scenarios/ScenarioChangeBundler'
import { useScenarioForecasting } from '../hooks/useScenarioForecasting'

export default function ContractDetail() {
    const { id } = useParams()

    const { data: contract, isLoading } = useQuery({
        queryKey: ['contract', id],
        queryFn: async () => {
            const { data, error } = await supabase.from('contracts').select('*').eq('id', id).single()
            if (error) throw error
            return data
        }
    })

    const { data: financials } = useQuery({
        queryKey: ['financials', id],
        queryFn: async () => {
            const { data } = await supabase.from('contract_monthly_summary_view')
                .select('*')
                .eq('contract_id', id)
                .order('period_month', { ascending: true })
            return data
        }
    })

    // Format currency
    const currencyFormatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    })

    if (isLoading) return <div className="p-8">Loading contract details...</div>
    if (!contract) return <div className="p-8">Contract not found</div>

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 border-b pb-6">
                <div className="flex items-center gap-4">
                    <Link to="/contracts">
                        <Button variant="ghost" size="sm">
                            <ArrowLeft size={16} className="mr-2" />
                            Back
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-3">
                            {contract.contract_code} - {contract.name}
                            <span className={`text-sm px-2 py-1 rounded-full border ${contract.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                                {contract.status.replace('_', ' ')}
                            </span>
                        </h1>
                        <p className="text-gray-500">{contract.customer_name} • {contract.portfolio} • {contract.sector}</p>
                    </div>
                </div>

                <div className="flex gap-8 ml-24 bg-gray-50 p-4 rounded-lg border border-gray-100 w-fit">
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Value</p>
                        <p className="text-xl font-bold text-gray-900">{currencyFormatter.format(contract.original_value || 0)}</p>
                    </div>
                    <div className="w-px bg-gray-200"></div>
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Target Margin</p>
                        <p className="text-xl font-bold text-blue-600">{contract.target_margin_pct}%</p>
                    </div>
                    <div className="w-px bg-gray-200"></div>
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Start Date</p>
                        <p className="text-lg font-medium text-gray-700">{contract.start_date ? format(new Date(contract.start_date), 'MMM d, yyyy') : '-'}</p>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="financials">
                <TabsList>
                    <TabsTrigger value="financials">Monthly Financials</TabsTrigger>
                    <TabsTrigger value="changes">Change Log</TabsTrigger>
                    <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
                </TabsList>

                <TabsContent value="financials">
                    <Card>
                        <CardHeader>
                            <CardTitle>Financial Performance</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {financials && financials.length > 0 && (
                                <div className="mb-8 border p-4 rounded bg-gray-50">
                                    <ForecastingChart data={financials} />
                                </div>
                            )}
                            <FinancialsGrid contractId={id} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="changes">
                    <Card>
                        <CardContent className="pt-6">
                            <ChangeLog contractId={id} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="scenarios">
                    <ScenarioModule contractId={id} />
                </TabsContent>
            </Tabs>
        </div>
    )
}

function ScenarioModule({ contractId }) {
    const [selectedScenarioId, setSelectedScenarioId] = React.useState(null)
    const { data: forecastData, isLoading } = useScenarioForecasting(contractId, selectedScenarioId)

    // Dynamically load hook to avoid circular dep issues in this single-file edit if they were in same file
    // But since they are imported, we need to add imports at top. 
    // For this Replace, I will assume imports are added. 

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="col-span-1">
                <ScenarioManager
                    contractId={contractId}
                    selectedScenarioId={selectedScenarioId}
                    onScenarioSelect={setSelectedScenarioId}
                />
            </div>
            <div className="md:col-span-3 flex flex-col gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Scenario Impact Analysis</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div>Loading Analysis...</div>
                        ) : (
                            <ScenarioComparisonChart data={forecastData} />
                        )}
                    </CardContent>
                </Card>

                {selectedScenarioId && (
                    <ScenarioChangeBundler contractId={contractId} scenarioId={selectedScenarioId} />
                )}
            </div>
        </div>
    )
}
