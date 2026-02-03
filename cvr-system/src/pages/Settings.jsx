import React, { useState } from 'react'
import { Button } from '../components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { supabase } from '../lib/supabase'

export default function Settings() {
    const [seeding, setSeeding] = useState(false)
    const [message, setMessage] = useState('')

    const seedData = async () => {
        if (!confirm('This will insert sample data. Continue?')) return

        setSeeding(true)
        setMessage('')

        try {
            // 1. Create a sample contract
            const { data: contract, error: err1 } = await supabase.from('contracts').insert({
                contract_code: 'BS-2024-001',
                name: 'Alpha Tower Construction',
                customer_name: 'Metro Corp',
                start_date: '2024-01-01',
                end_date: '2024-12-31',
                original_value: 5000000,
                target_margin_pct: 12.5,
                status: 'active',
                business_unit: 'Construction',
                sector: 'Commercial'
            }).select().single()

            if (err1) throw err1

            // 2. Create periods (Jan - Mar)
            const periods = ['2024-01-01', '2024-02-01', '2024-03-01', '2024-04-01']
            for (const date of periods) {
                const { data: p, error: ep } = await supabase.from('contract_periods').insert({
                    contract_id: contract.id,
                    period_month: date,
                    is_baseline: false,
                    version: 1
                }).select().single()

                if (ep) throw ep

                // 3. Add revenue/cost (Actuals)
                // Revenue ~400k
                await supabase.from('contract_revenue').insert({
                    contract_period_id: p.id,
                    revenue_type: 'actual',
                    amount: 400000 + (Math.random() * 50000)
                })

                // Cost ~350k
                await supabase.from('contract_costs').insert({
                    contract_period_id: p.id,
                    cost_type: 'actual',
                    category: 'labour',
                    amount: 350000 + (Math.random() * 20000)
                })
            }

            // 4. Add a change
            await supabase.from('contract_changes').insert({
                contract_id: contract.id,
                change_code: 'VO-001',
                description: 'Additional Groundworks',
                change_type: 'scope_addition',
                revenue_delta: 50000,
                cost_delta: 42000,
                status: 'approved',
                effective_date: '2024-02-15'
            })

            setMessage('Seeding complete! Check Contracts page.')
        } catch (err) {
            setMessage('Error: ' + err.message)
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
                        <p className="text-sm text-gray-500">Use this to populate the database with sample data for demonstration.</p>
                        <Button onClick={seedData} disabled={seeding}>
                            {seeding ? 'Seeding...' : 'Seed Sample Data'}
                        </Button>
                        {message && <p className="text-sm font-medium text-green-600">{message}</p>}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
