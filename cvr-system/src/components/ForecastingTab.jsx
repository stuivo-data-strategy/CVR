import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from './ui/Button'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from './ui/Card'
import { Wand2, AlertTriangle, Calendar } from 'lucide-react'
import { AlertDialog } from './ui/AlertDialog'

import ForecastGeneratorModal from './ForecastGeneratorModal'
import ForecastingGrid from './ForecastingGrid'

export default function ForecastingTab({ contractId }) {
    const queryClient = useQueryClient()
    const [isCleaning, setIsCleaning] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const [cutoffDate, setCutoffDate] = useState(new Date().toISOString().slice(0, 7) + '-01') // Default to 1st of current month
    const [alertConfig, setAlertConfig] = useState({ open: false, title: '', description: '', variant: 'primary', onConfirm: null })

    // Fetch periods for the modal to know what's future
    const { data: periods } = useQueryClient().getQueryData(['forecasting_periods', contractId])?.periods || { data: [] }
    // Actually easier to just pass same query hook or let modal fetch. 
    // Let's pass the data from the grid query if we can, but hooks rules prevent conditional.
    // Let's refactor: ForecastingGrid fetches data. We might need to lift that state or just refetch in modal.
    // Modal refetch is safer.

    const confirmCleanup = () => {
        setAlertConfig({
            open: true,
            title: 'Split Actuals vs Forecast',
            description: `Are you sure? This will mark all periods BEFORE or ON ${cutoffDate} as ACTUALS, and all periods AFTER as FORECAST. This cannot be easily undone.`,
            variant: 'destructive',
            confirmText: 'Yes, Split Data',
            onConfirm: performCleanup
        })
    }

    const performCleanup = async () => {
        setIsCleaning(true)
        try {
            const { error } = await supabase.rpc('split_actuals_forecast', {
                p_contract_id: contractId,
                p_cutoff_date: cutoffDate
            })

            if (error) throw error

            setAlertConfig({
                open: true,
                title: 'Success',
                description: 'Data successfully split into Actuals vs Forecast.',
                variant: 'primary',
                confirmText: 'OK',
                cancelText: '', // Hide cancel button
                onConfirm: null
            })

            queryClient.invalidateQueries(['contract_summary', contractId])
            queryClient.invalidateQueries(['financials', contractId])
            queryClient.invalidateQueries(['forecasting_periods', contractId])

        } catch (err) {
            setAlertConfig({
                open: true,
                title: 'Error',
                description: 'Error running cleanup: ' + err.message,
                variant: 'destructive',
                confirmText: 'Close',
                cancelText: ''
            })
        } finally {
            setIsCleaning(false)
        }
    }

    // Fetch categories for modal
    const { data: categories } = useQueryClient().getQueryData(['cost_categories']) || { data: [] }
    // Again, rely on cached data or let modal fetch. Modal fetches.

    return (
        <div className="flex flex-col gap-6">
            <Card className="border-blue-100 bg-blue-50/50">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Wand2 className="text-blue-600" size={20} />
                        <CardTitle className="text-base text-blue-900">Forecast Utilities</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-4">
                        {/* Row 1: Splitter */}
                        <div className="flex flex-col md:flex-row gap-4 items-end border-b border-blue-200 pb-4">
                            <div className="flex-1">
                                <label className="text-sm font-medium text-gray-700 mb-1 block">Actuals Cutoff Date</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="date"
                                        className="border rounded px-3 py-2 text-sm bg-white"
                                        value={cutoffDate}
                                        onChange={(e) => setCutoffDate(e.target.value)}
                                    />
                                    <span className="text-xs text-gray-500">
                                        Periods on/before this date will be locked as ACTUALS.
                                    </span>
                                </div>
                            </div>
                            <Button
                                onClick={confirmCleanup}
                                disabled={isCleaning}
                                variant="outline"
                                className="bg-white hover:bg-blue-50 text-blue-700 border-blue-200"
                            >
                                {isCleaning ? 'Processing...' : 'Split Actuals / Forecast'}
                            </Button>
                        </div>

                        {/* Row 2: Generator */}
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-600">
                                Need to smooth out your forecast? Use the generator to apply linear spreads or run-rates.
                            </div>
                            <Button onClick={() => setIsGenerating(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
                                <Wand2 size={16} className="mr-2" /> Smart Generate
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <ForecastingGrid contractId={contractId} />

            {/* Modal */}
            <ForecastGeneratorModal
                isOpen={isGenerating}
                onClose={() => setIsGenerating(false)}
                contractId={contractId}
                // Pass cached periods/cats if avail, else let it fetch.
                // We'll let it fetch its own data for simplicity in this turn
                periods={queryClient.getQueryData(['forecasting_periods', contractId])}
                categories={queryClient.getQueryData(['cost_categories'])}
            />

            <AlertDialog
                open={alertConfig.open}
                onOpenChange={(val) => setAlertConfig(prev => ({ ...prev, open: val }))}
                title={alertConfig.title}
                description={alertConfig.description}
                variant={alertConfig.variant}
                confirmText={alertConfig.confirmText}
                cancelText={alertConfig.cancelText}
                onConfirm={alertConfig.onConfirm}
            />
        </div>
    )
}
