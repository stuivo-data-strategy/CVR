import React, { useState } from 'react'
import { Button } from '../components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { supabase } from '../lib/supabase'
import { addMonths, startOfMonth, format, subMonths } from 'date-fns'
import { AlertDialog } from '../components/ui/AlertDialog'

export default function Settings() {
    const [seeding, setSeeding] = useState(false)
    const [message, setMessage] = useState('')
    const [alertState, setAlertState] = useState({ open: false, title: '', description: '', variant: 'default', showCancel: true, onConfirm: null })

    const generateRandom = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

    const executeSeed = async () => {
        setSeeding(true)
        setMessage('Starting enhanced seed...')

        try {
            // 0. Ensure Cost Categories exist
            const { data: cats } = await supabase.from('cost_categories').select('*')
            if (!cats || cats.length === 0) throw new Error('Cost categories missing.')

            const getCatId = (code) => cats.find(c => c.code === code)?.id || cats[0].id

            // contracts blueprint
            const blueprints = [
                { code: 'INFRA-001', name: 'Highway Maintenance Framework', portfolio: 'Infrastructure', sector: 'Public', val: 15_000_000 },
                { code: 'CONST-002', name: 'City Hospital Wing B', portfolio: 'Construction', sector: 'Public', val: 45_000_000 },
                { code: 'SERV-003', name: 'Council Facilities Mgmt', portfolio: 'Services', sector: 'Public', val: 5_000_000 },
                { code: 'CONST-004', name: 'Tech Park Phase 1', portfolio: 'Construction', sector: 'Commercial', val: 22_000_000 },
                { code: 'INFRA-005', name: 'Rail Signaling Upgrade', portfolio: 'Infrastructure', sector: 'Public', val: 8_500_000 },
                { code: 'SERV-006', name: 'Office Cleaning Corp', portfolio: 'Services', sector: 'Commercial', val: 1_200_000 },
            ]

            // 1. Loop through blueprints
            for (const bp of blueprints) {
                const { data: contract, error: err1 } = await supabase.from('contracts').insert({
                    contract_code: `${bp.code}-${generateRandom(100, 999)}`,
                    name: bp.name,
                    customer_name: 'Seed Corp Ltd',
                    start_date: '2025-04-01',
                    end_date: '2028-03-31',
                    original_value: bp.val,
                    target_margin_pct: generateRandom(5, 12),
                    status: 'active',
                    portfolio: bp.portfolio,
                    sector: bp.sector
                }).select().single()

                if (err1) throw err1

                // 2. Periods (3 Years)
                const startDate = new Date('2025-04-01')
                const periods = []
                for (let i = 0; i < 36; i++) periods.push(addMonths(startDate, i))

                for (const dateObj of periods) {
                    const dateStr = format(dateObj, 'yyyy-MM-dd')

                    const { data: p } = await supabase.from('contract_periods').insert({
                        contract_id: contract.id,
                        period_month: dateStr,
                        is_baseline: false,
                        version: 1
                    }).select().single()

                    // 3. Financials
                    // Base amount depends on contract value roughly spread over 36 months
                    const monthlyAvg = bp.val / 36
                    const variance = monthlyAvg * 0.2 // 20% variance
                    const actualRev = monthlyAvg + (Math.random() * variance - variance / 2)

                    // Revenue
                    await supabase.from('contract_revenue').insert({
                        contract_period_id: p.id,
                        revenue_type: 'actual', // For simplicity using 'actual' for all future too in this demo
                        amount: actualRev
                    })

                    // Costs (Target margin is roughly kept)
                    const margin = (contract.target_margin_pct / 100)
                    const targetCost = actualRev * (1 - margin)
                    const actualCost = targetCost + (Math.random() * (targetCost * 0.1) - (targetCost * 0.05)) // +/- variance

                    // Split costs into categories
                    const ratios = { LAB: 0.4, MAT: 0.3, SUB: 0.2, EXP: 0.1 }

                    for (const [code, ratio] of Object.entries(ratios)) {
                        await supabase.from('contract_costs').insert({
                            contract_period_id: p.id,
                            cost_type: 'actual',
                            category_id: getCatId(code),
                            amount: actualCost * ratio
                        })
                    }
                }

                // 4. Changes & Narratives
                // Generate 3-5 changes per contract
                const numChanges = generateRandom(3, 5)
                for (let k = 0; k < numChanges; k++) {
                    const isApproved = Math.random() > 0.5
                    await supabase.from('contract_changes').insert({
                        contract_id: contract.id,
                        change_code: `VO-${100 + k}`,
                        title: `Variation Order ${k + 1}`,
                        description: 'Generated sample change request for testing metrics.',
                        change_type: ['scope_addition', 'rate_change', 'other'][generateRandom(0, 2)],
                        status: isApproved ? 'approved' : 'proposed',
                        revenue_delta: generateRandom(10000, 50000),
                        cost_delta: generateRandom(8000, 40000),
                        risk_level: ['low', 'medium', 'high'][generateRandom(0, 2)],
                        effective_date: '2025-09-01',
                        reason_for_change: 'Client request for additional scope.',
                        // Narrative fields for review mechanism
                        risk_narrative: 'Potential supply chain delay risk identified.',
                        opportunity_narrative: 'Margin improvement possible if executed in Q3.',
                    })
                }
            }

            setMessage(`Seeding complete! Created ${blueprints.length} contracts.`)
        } catch (err) {
            setMessage('Error: ' + err.message)
            console.error(err)
        } finally {
            setSeeding(false)
        }
    }

    const seedData = () => {
        setAlertState({
            open: true,
            title: 'Confirm Seeding',
            description: 'This will insert MULTIPLE contracts for FY25-FY27. Continue?',
            onConfirm: executeSeed
        })
    }

    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-2xl font-bold">Settings</h1>

            <Card>
                <CardHeader><CardTitle>Developer Tools</CardTitle></CardHeader>
                <CardContent>
                    <div className="flex flex-col items-start gap-4">
                        <p className="text-sm text-gray-500">
                            Use this to populate the database with comprehensive sample data for demonstration.
                        </p>
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                            <strong>Enhanced Seed:</strong> Generates 6 contracts across different BUs/Sectors with full 3-year financials and changes.
                        </div>
                        <Button onClick={seedData} disabled={seeding}>
                            {seeding ? 'Seeding Database...' : 'Run Enhanced Seeding (FY25-27)'}
                        </Button>
                        {message && <p className="text-sm font-medium text-green-600">{message}</p>}
                    </div>
                </CardContent>
            </Card>

            <AlertDialog
                open={alertState.open}
                onOpenChange={val => setAlertState(prev => ({ ...prev, open: val }))}
                title={alertState.title}
                description={alertState.description}
                variant={alertState.variant}
                showCancel={alertState.showCancel}
                onConfirm={alertState.onConfirm}
            />
        </div>
    )
}
