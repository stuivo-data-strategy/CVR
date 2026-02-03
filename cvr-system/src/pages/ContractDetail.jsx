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
import { format } from 'date-fns'

export default function ContractDetail() {
    const { id } = useParams()

    const { data: contract, isLoading } = useQuery({
        queryKey: ['contract', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('contracts')
                .select('*')
                .eq('id', id)
                .single()

            if (error) throw error
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
            <div className="flex items-center gap-4">
                <Link to="/contracts">
                    <Button variant="ghost" size="sm">
                        <ArrowLeft size={16} className="mr-2" />
                        Back
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold">{contract.contract_code} - {contract.name}</h1>
                    <p className="text-gray-500">{contract.customer_name}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Value</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{currencyFormatter.format(contract.original_value || 0)}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Target Margin</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{contract.target_margin_pct}%</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-lg font-medium capitalize">{contract.status.replace('_', ' ')}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Start Date</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-lg font-medium">
                            {contract.start_date ? format(new Date(contract.start_date), 'MMM d, yyyy') : '-'}
                        </div>
                    </CardContent>
                </Card>
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
                    <Card>
                        <CardContent className="pt-6">
                            <p className="text-gray-500">Scenario modelling module not yet implemented.</p>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
