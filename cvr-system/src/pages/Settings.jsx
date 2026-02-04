import React, { useState } from 'react'
import { Button } from '../components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { supabase } from '../lib/supabase'
import { addMonths, startOfMonth, format, subMonths } from 'date-fns'

export default function Settings() {
    const [seeding, setSeeding] = useState(false)
    const [message, setMessage] = useState('')

    const generateRandom = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

    const clearData = async () => {
        if (!confirm('WARNING: This will delete ALL contracts, changes, and financial data. Are you sure?')) return
        setSeeding(true)
        setMessage('Clearing database...')
        try {
            const { error: e1 } = await supabase.from('contract_change_impacts').delete().neq('id', '00000000-0000-0000-0000-000000000000')
            const { error: e2 } = await supabase.from('contract_changes').delete().neq('id', '00000000-0000-0000-0000-000000000000')
            const { error: e3 } = await supabase.from('contract_costs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
            const { error: e4 } = await supabase.from('contract_revenue').delete().neq('id', '00000000-0000-0000-0000-000000000000')
            const { error: e5 } = await supabase.from('contract_periods').delete().neq('id', '00000000-0000-0000-0000-000000000000')
            const { error: e6 } = await supabase.from('contracts').delete().neq('id', '00000000-0000-0000-0000-000000000000')

            if (e1 || e2 || e3 || e4 || e5 || e6) throw new Error('Failed to delete some records')

            setMessage('Database cleared.')
        } catch (err) {
            setMessage('Error: ' + err.message)
        } finally {
            setSeeding(false)
        }
    }

    const seedData = async () => {
        if (!confirm('This will insert MULTIPLE contracts for FY25-FY27. Continue?')) return

        setSeeding(true)
        setMessage('Starting enhanced seed...')

        try {
            // 0. Ensure Cost Categories exist
            let { data: cats } = await supabase.from('cost_categories').select('*')

            if (!cats || cats.length === 0) {
                setMessage('Seeding cost categories...')
                const defaultCats = [
                    { code: 'LAB', name: 'Labour', sort_order: 10 },
                    { code: 'MAT', name: 'Materials', sort_order: 20 },
                    { code: 'SUB', name: 'Subcontractors', sort_order: 30 },
                    { code: 'EXP', name: 'Expenses', sort_order: 40 },
                    { code: 'OTH', name: 'Other', sort_order: 50 },
                ]
                const { error: catErr } = await supabase.from('cost_categories').insert(defaultCats)
                if (catErr) throw catErr

                // Refetch
                const { data: newCats } = await supabase.from('cost_categories').select('*')
                cats = newCats
            }

            const getCatId = (code) => cats.find(c => c.code === code)?.id || cats[0].id

            // contracts blueprint
            const blueprints = [
                { code: 'INFRA-001', name: 'Highway Maintenance Framework', bu: 'Infrastructure', sector: 'Public', val: 15_000_000 },
                { code: 'CONST-002', name: 'City Hospital Wing B', bu: 'Construction', sector: 'Public', val: 45_000_000 },
                { code: 'SERV-003', name: 'Council Facilities Mgmt', bu: 'Services', sector: 'Public', val: 5_000_000 },
                { code: 'CONST-004', name: 'Tech Park Phase 1', bu: 'Construction', sector: 'Commercial', val: 22_000_000 },
                { code: 'INFRA-005', name: 'Rail Signaling Upgrade', bu: 'Infrastructure', sector: 'Public', val: 8_500_000 },
                { code: 'SERV-006', name: 'Office Cleaning Corp', bu: 'Services', sector: 'Commercial', val: 1_200_000 },
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
                    business_unit: bp.bu,
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
                    const { error: revErr } = await supabase.from('contract_revenue').insert({
                        contract_period_id: p.id,
                        revenue_type: 'actual',
                        amount: actualRev
                    })
                    if (revErr) throw new Error(`Revenue Insert Failed: ${revErr.message}`)

                    // Costs (Target margin is roughly kept)
                    const margin = (contract.target_margin_pct / 100)
                    const targetCost = actualRev * (1 - margin)
                    const actualCost = targetCost + (Math.random() * (targetCost * 0.1) - (targetCost * 0.05)) // +/- variance

                    // Split costs into categories
                    const ratios = { LAB: 0.4, MAT: 0.3, SUB: 0.2, EXP: 0.1 }

                    for (const [code, ratio] of Object.entries(ratios)) {
                        const { error: costErr } = await supabase.from('contract_costs').insert({
                            contract_period_id: p.id,
                            cost_type: 'actual',
                            category_id: getCatId(code),
                            amount: actualCost * ratio
                        })
                        if (costErr) throw new Error(`Cost Insert Failed for ${code}: ${costErr.message}`)
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
                            <strong>Enhanced Seed:</strong> generates contracts, cost categories, and detailed financial data (Revenue & Cost splits) for FY25-27.
                        </div>
                        <Button onClick={seedData} disabled={seeding}>
                            {seeding ? 'Seeding Database...' : 'Run Enhanced Seeding (FY25-27)'}
                        </Button>

                        <div className="mt-4 pt-4 border-t border-gray-100 w-full">
                            <h4 className="text-sm font-semibold text-red-600 mb-2">Danger Zone</h4>
                            <Button variant="destructive" onClick={clearData} disabled={seeding}>
                                Clear All Data
                            </Button>
                        </div>
                        {message && <p className="text-sm font-medium text-green-600">{message}</p>}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
