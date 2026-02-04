import React, { useState } from 'react'
import { Button } from './ui/Button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/Dialog'
import { Upload, FileDown, AlertTriangle } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { addMonths, differenceInMonths, startOfMonth, format } from 'date-fns'

export default function ImportContractModal({ isOpen, onClose, onSuccess }) {
    const [loading, setLoading] = useState(false)
    const [log, setLog] = useState([])

    const addLog = (msg) => setLog(prev => [...prev, msg])

    const downloadTemplate = () => {
        const headers = [['Contract Code', 'Name', 'Customer', 'Value', 'Start Date (YYYY-MM-DD)', 'End Date', 'BU', 'Sector', 'Status']]
        const ws = XLSX.utils.aoa_to_sheet(headers)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Template")
        XLSX.writeFile(wb, "cvr_import_template.xlsx")
    }

    const parseDate = (val) => {
        if (!val) return null

        // If it's already a JS Date (from cellDates: true)
        if (val instanceof Date) return val.toISOString()

        // If it's an Excel serial number (fallback)
        if (typeof val === 'number') {
            return new Date(Math.round((val - 25569) * 86400 * 1000)).toISOString()
        }

        // If it's a string
        if (typeof val === 'string') {
            // Check for DD/MM/YYYY format (common in UK/EU)
            if (val.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                const [day, month, year] = val.split('/')
                return new Date(`${year}-${month}-${day}`).toISOString()
            }
            // Try standard parse
            const d = new Date(val)
            if (!isNaN(d.getTime())) return d.toISOString()
        }

        return null
    }

    const handleFileUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        setLoading(true)
        setLog(['Reading file...'])

        try {
            const data = await file.arrayBuffer()
            // cellDates: true forces Excel serials to be JS Date objects
            const workbook = XLSX.read(data, { cellDates: true })
            const worksheet = workbook.Sheets[workbook.SheetNames[0]]
            const jsonData = XLSX.utils.sheet_to_json(worksheet)

            // 0. Ensure Cost Categories exist (for simulation)
            let { data: cats } = await supabase.from('cost_categories').select('*')
            if (!cats || cats.length === 0) {
                addLog('Seeding default cost categories...')
                const defaultCats = [
                    { code: 'LAB', name: 'Labour', sort_order: 10 },
                    { code: 'MAT', name: 'Materials', sort_order: 20 },
                    { code: 'SUB', name: 'Subcontractors', sort_order: 30 },
                    { code: 'EXP', name: 'Expenses', sort_order: 40 },
                    { code: 'OTH', name: 'Other', sort_order: 50 },
                ]
                await supabase.from('cost_categories').insert(defaultCats)
                const { data: newCats } = await supabase.from('cost_categories').select('*')
                cats = newCats
            }
            const getCatId = (code) => cats.find(c => c.code === code)?.id || cats[0].id

            if (jsonData.length === 0) throw new Error('No data found in file')

            addLog(`Found ${jsonData.length} rows. Starting import...`)

            let successCount = 0
            let invalidCount = 0

            for (const row of jsonData) {
                // Basic Validation
                const code = row['Contract Code']
                const name = row['Name']

                if (!code || !name) {
                    addLog(`Skipping row (missing code/name): ${JSON.stringify(row)}`)
                    invalidCount++
                    continue
                }

                const startDate = parseDate(row['Start Date (YYYY-MM-DD)']) || new Date().toISOString()
                const endDate = parseDate(row['End Date']) || addMonths(new Date(startDate), 12).toISOString()

                // Validate Status
                const validStatuses = ['active', 'on_hold', 'completed', 'terminated']
                let status = row['Status']?.toLowerCase() || 'active'
                if (!validStatuses.includes(status)) {
                    status = 'active'
                }

                const originalValue = parseFloat(row['Value']) || 0

                // 1. Insert Contract
                const { data: contract, error } = await supabase.from('contracts').upsert({
                    contract_code: code,
                    name: name,
                    customer_name: row['Customer'] || 'Unknown',
                    original_value: originalValue,
                    start_date: startDate,
                    end_date: endDate,
                    business_unit: row['BU'],
                    sector: row['Sector'],
                    status: status
                }, { onConflict: 'contract_code' }).select().single()

                if (error) {
                    addLog(`Error importing ${code}: ${error.message}`)
                    invalidCount++
                    continue
                }

                successCount++

                // 2. Simulate Financial Data (Revenue & Costs)
                // Determine number of periods
                const start = new Date(startDate)
                const end = new Date(endDate)
                const numMonths = differenceInMonths(end, start) + 1
                if (numMonths <= 0) continue

                const monthlyAvgRev = originalValue / numMonths
                // Randomize Revenue slightly (+/- 10%)
                // Target Margin ~10% -> Cost is 90%

                addLog(`Simulating ${numMonths} months of data for ${code}...`)

                for (let i = 0; i < numMonths; i++) {
                    const periodDate = addMonths(start, i)
                    const periodStr = format(periodDate, 'yyyy-MM-dd')

                    // Create Period
                    const { data: period, error: pErr } = await supabase.from('contract_periods').upsert({
                        contract_id: contract.id,
                        period_month: periodStr,
                        version: 1,
                        is_baseline: false
                    }, { onConflict: 'contract_id, period_month, version' }).select().single()

                    if (pErr) continue

                    // Calc Financials
                    const variance = (Math.random() * 0.2) - 0.1 // +/- 10%
                    const actualRev = monthlyAvgRev * (1 + variance)

                    const margin = 0.10 + ((Math.random() * 0.05) - 0.025) // 7.5% to 12.5% margin
                    const totalCost = actualRev * (1 - margin)

                    // Insert Revenue
                    await supabase.from('contract_revenue').delete().eq('contract_period_id', period.id) // Clear exist
                    await supabase.from('contract_revenue').insert({
                        contract_period_id: period.id,
                        revenue_type: 'actual',
                        amount: actualRev
                    })

                    // Insert Costs (Split by Category)
                    const ratios = { LAB: 0.4, MAT: 0.35, SUB: 0.2, EXP: 0.05 }
                    await supabase.from('contract_costs').delete().eq('contract_period_id', period.id) // Clear exist

                    for (const [catCode, ratio] of Object.entries(ratios)) {
                        await supabase.from('contract_costs').insert({
                            contract_period_id: period.id,
                            cost_type: 'actual',
                            category_id: getCatId(catCode),
                            amount: totalCost * ratio
                        })
                    }
                }
            }

            addLog(`Import finished. Success: ${successCount}, Failed: ${invalidCount}`)
            if (invalidCount === 0) {
                setTimeout(() => {
                    onSuccess()
                    onClose()
                }, 1500)
            }

        } catch (err) {
            addLog(`Critical Error: ${err.message}`)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogHeader>
                <DialogTitle>Import Contracts from Excel</DialogTitle>
            </DialogHeader>
            <DialogContent className="sm:max-w-[500px]">
                <div className="flex flex-col gap-6 py-4">

                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-md">
                        <h4 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                            <FileDown size={16} /> Step 1: Download Template
                        </h4>
                        <p className="text-xs text-blue-600 mb-3">Use this template to format your data correctly.</p>
                        <Button variant="outline" size="sm" onClick={downloadTemplate}>Download .xlsx Template</Button>
                    </div>

                    <div className="p-4 bg-gray-50 border border-gray-100 rounded-md">
                        <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                            <Upload size={16} /> Step 2: Upload File
                        </h4>
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            onChange={handleFileUpload}
                            disabled={loading}
                            className="block w-full text-sm text-gray-500
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-full file:border-0
                                file:text-sm file:font-semibold
                                file:bg-violet-50 file:text-violet-700
                                hover:file:bg-violet-100"
                        />
                    </div>

                    {log.length > 0 && (
                        <div className="bg-black text-green-400 p-3 rounded text-xs font-mono h-32 overflow-y-auto">
                            {log.map((l, i) => <div key={i}>&gt; {l}</div>)}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
