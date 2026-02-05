import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { FileText, ArrowRight } from 'lucide-react'

export default function Reports() {
    // Fetch Contracts to provide quick links
    const { data: contracts } = useQuery({
        queryKey: ['contracts_list'],
        queryFn: async () => {
            const { data } = await supabase.from('contracts').select('id, contract_code, name, portfolio').limit(10)
            return data
        }
    })

    return (
        <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-bold">Reporting Hub</h1>
                <p className="text-gray-500">Access detailed analytics and margin forensics.</p>
            </div>

            <Card className="bg-blue-50 border-blue-100">
                <CardHeader>
                    <CardTitle className="text-blue-900">New: Contract Analytics Enabed</CardTitle>
                    <CardDescription className="text-blue-700">
                        We have deployed the new <strong>Margin Evolution & Risk Analysis</strong> tools.
                        Please select a contract below to view its specific Report Tab.
                    </CardDescription>
                </CardHeader>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Select a Contract</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {contracts?.map(c => (
                            <Link key={c.id} to={`/contracts/${c.id}?tab=reports`}>
                                <div className="p-4 border rounded hover:bg-gray-50 hover:border-blue-300 transition-colors group cursor-pointer">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{c.contract_code}</span>
                                        <ArrowRight size={16} className="text-gray-300 group-hover:text-blue-500" />
                                    </div>
                                    <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">{c.name}</h3>
                                    <p className="text-sm text-gray-500">{c.portfolio}</p>
                                    <div className="mt-4 flex items-center gap-2 text-xs text-blue-600 font-medium">
                                        <FileText size={12} />
                                        View Analytics Report
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
