import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/Card'
import { ArrowRight, Calculator } from 'lucide-react'
import { Button } from '../components/ui/Button'

export default function Modeling() {
    const { data: contracts, isLoading } = useQuery({
        queryKey: ['contracts'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('contracts')
                .select('*')
                .eq('status', 'active')
                .order('name')
            if (error) throw error
            return data
        }
    })

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-bold">What-If Modeling</h1>
                <p className="text-gray-500">Select a contract to manage scenarios and forecast outcomes.</p>
            </div>

            {isLoading ? (
                <div>Loading contracts...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {contracts?.length === 0 && (
                        <div className="col-span-3 text-center p-12 text-gray-400 bg-gray-50 rounded border border-dashed">
                            No active contracts found.
                        </div>
                    )}

                    {contracts?.map(contract => (
                        <Card key={contract.id} className="hover:shadow-md transition-shadow">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg flex justify-between items-start">
                                    {contract.name}
                                    <span className="text-xs font-normal px-2 py-1 bg-blue-50 text-blue-700 rounded-full">{contract.contract_code}</span>
                                </CardTitle>
                                <CardDescription>{contract.customer_name}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex justify-between items-center mt-4">
                                    <div className="text-sm text-gray-500">
                                        <div className="flex items-center gap-1">
                                            <Calculator size={14} />
                                            <span>Scenario Analysis</span>
                                        </div>
                                    </div>
                                    <Link to={`/contracts/${contract.id}`}>
                                        <Button variant="outline" size="sm" className="gap-2">
                                            Open Scenarios <ArrowRight size={14} />
                                        </Button>
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
