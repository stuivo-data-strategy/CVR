import React, { useState } from 'react'
import { Button } from './ui/Button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/Dialog'
import { Upload, FileDown, AlertTriangle } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'

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

    const handleFileUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        setLoading(true)
        setLog(['Reading file...'])

        try {
            const data = await file.arrayBuffer()
            const workbook = XLSX.read(data)
            const worksheet = workbook.Sheets[workbook.SheetNames[0]]
            const jsonData = XLSX.utils.sheet_to_json(worksheet)

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

                // Insert to Supabase
                const { error } = await supabase.from('contracts').upsert({
                    contract_code: code,
                    name: name,
                    customer_name: row['Customer'] || 'Unknown',
                    original_value: row['Value'] || 0,
                    start_date: row['Start Date (YYYY-MM-DD)'] || new Date().toISOString(),
                    end_date: row['End Date'],
                    business_unit: row['BU'],
                    sector: row['Sector'],
                    status: row['Status']?.toLowerCase() || 'active'
                }, { onConflict: 'contract_code' })

                if (error) {
                    addLog(`Error importing ${code}: ${error.message}`)
                    invalidCount++
                } else {
                    successCount++
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
