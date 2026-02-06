import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { Plus, Trash2, Calendar, DollarSign, Calculator } from 'lucide-react'
import { Button } from './ui/Button'
import { AlertDialog } from './ui/AlertDialog'


// Simple UUID generator fallback
const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID()
    }
    return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

const emptyChange = (contractId, userId) => ({
    id: generateId(),
    contract_id: contractId,
    change_code: '',
    title: '',
    description: '',
    change_type: 'other',
    // Ownership
    raised_by: userId || '',
    commercial_owner: '',
    technical_owner: '',
    customer_contact: '',
    // Timing
    effective_date: new Date().toISOString().split('T')[0],
    applies_from_period: '',
    applies_to_period: '',
    is_retrospective: false,
    requires_rebaseline: false,
    // Commercial
    revenue_delta: 0,
    cost_delta: 0,
    customer_share_pct: 0,
    company_share_pct: 100,
    // Breakdown
    cost_breakdown: [], // {id, category_id, cost_delta, notes}
    // Time-Phased
    impacts: [], // {id, period_month, revenue_delta, cost_delta, cost_category_id, is_scenario_only}
    // Forecasting
    conversion_probability_pct: 100,
    potential_disallowed_costs: 0,
    disallowed_cost_notes: '',
    // Risk
    risk_level: 'low',
    tags: [],
    risk_narrative: '',
    opportunity_narrative: '',
    // Governance
    status: 'proposed',
    customer_approval_received: false,
    approval_date: ''
})

export const ContractChangeForm = ({ contractId, onClose, onSuccess, initialData }) => {
    const { user } = useAuth()
    const [formData, setFormData] = useState(initialData || emptyChange(contractId, user?.id))
    const [costCategories, setCostCategories] = useState([])
    const [profiles, setProfiles] = useState([])
    const [activeTab, setActiveTab] = useState('identification') // identification, financial, forecasting, governance

    const [alertState, setAlertState] = useState({
        open: false,
        title: '',
        description: '',
        variant: 'default',
        showCancel: true,
        onConfirm: null
    })
    const closeAlert = () => setAlertState(prev => ({ ...prev, open: false }))

    useEffect(() => {
        const fetchRefData = async () => {
            const { data: cats } = await supabase.from('cost_categories').select('*').order('sort_order')
            if (cats) setCostCategories(cats)

            const { data: profs } = await supabase.from('profiles').select('id, full_name, email')
            if (profs) setProfiles(profs)
        }
        fetchRefData()
    }, [])

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    // --- SUB-COMPONENT HANDLERS ---

    // Cost Breakdown
    const addCostRow = () => {
        if (!costCategories.length) return
        setFormData(prev => ({
            ...prev,
            cost_breakdown: [...(prev.cost_breakdown || []), {
                id: generateId(),
                category_id: costCategories[0].id,
                cost_delta: 0,
                notes: ''
            }]
        }))
    }

    const updateCostRow = (id, field, value) => {
        setFormData(prev => ({
            ...prev,
            cost_breakdown: prev.cost_breakdown.map(r => r.id === id ? { ...r, [field]: value } : r)
        }))
    }

    const removeCostRow = (id) => {
        setFormData(prev => ({
            ...prev,
            cost_breakdown: prev.cost_breakdown.filter(r => r.id !== id)
        }))
    }

    // Auto-calc Cost Delta from Breakdown
    useEffect(() => {
        if (formData.cost_breakdown?.length > 0) {
            const total = formData.cost_breakdown.reduce((sum, r) => sum + (parseFloat(r.cost_delta) || 0), 0)
            setFormData(prev => {
                if (prev.cost_delta !== total) return { ...prev, cost_delta: total }
                return prev
            })
        }
    }, [formData.cost_breakdown])

    // Time-Phased Impacts
    const addImpactRow = () => {
        setFormData(prev => ({
            ...prev,
            impacts: [...(prev.impacts || []), {
                id: generateId(),
                period_month: new Date().toISOString().slice(0, 7) + '-01', // Default to current month 1st
                revenue_delta: 0,
                cost_delta: 0,
                cost_category_id: costCategories[0]?.id || null,
                is_scenario_only: false
            }]
        }))
    }
    const updateImpactRow = (id, field, value) => {
        setFormData(prev => ({
            ...prev,
            impacts: prev.impacts.map(r => r.id === id ? { ...r, [field]: value } : r)
        }))
    }

    const removeImpactRow = (id) => {
        setFormData(prev => ({
            ...prev,
            impacts: prev.impacts.filter(r => r.id !== id)
        }))
    }

    // --- SUBMIT ---
    const saveChanges = async () => {
        try {
            // 2. Upsert Contract Change
            const { cost_breakdown, impacts, ...mainChangeData } = formData

            const insertData = {
                contract_id: contractId,
                change_code: mainChangeData.change_code,
                title: mainChangeData.title,
                description: mainChangeData.description,
                reason_for_change: mainChangeData.reason_for_change,
                change_type: mainChangeData.change_type,
                effective_date: mainChangeData.effective_date,
                applies_from_period: mainChangeData.applies_from_period || null,
                applies_to_period: mainChangeData.applies_to_period || null,
                is_retrospective: mainChangeData.is_retrospective,
                requires_rebaseline: mainChangeData.requires_rebaseline,
                revenue_delta: mainChangeData.revenue_delta,
                cost_delta: mainChangeData.cost_delta,
                customer_share_pct: mainChangeData.customer_share_pct,
                company_share_pct: mainChangeData.company_share_pct,
                status: mainChangeData.status,
                risk_level: mainChangeData.risk_level,
                customer_reference: mainChangeData.customer_reference,
                commercial_owner: mainChangeData.commercial_owner || null,
                technical_owner: mainChangeData.technical_owner || null,
                customer_contact: mainChangeData.customer_contact,
                customer_approval_received: mainChangeData.customer_approval_received,
                approval_date: mainChangeData.approval_date || null
                // ... forecast fields
            }

            // Update or Insert
            const { data: changeParams, error: mainError } = await supabase
                .from('contract_changes')
                .upsert(insertData)
                .select()
                .single()

            if (mainError) throw mainError

            // 3. Handle Impacts (Delete all and re-insert for simplicity)
            let finalId = formData.id // if we decide to force UUID client side

            const { error: upsertErr } = await supabase.from('contract_changes').upsert({
                id: finalId,
                ...insertData
            })
            if (upsertErr) throw upsertErr

            // Delete existing impacts
            await supabase.from('contract_change_impacts').delete().eq('contract_change_id', finalId)

            // Insert new impacts
            if (formData.impacts?.length > 0) {
                const impactRows = formData.impacts.map(i => ({
                    contract_change_id: finalId,
                    period_month: i.period_month, // ensure YYYY-MM-DD
                    revenue_delta: i.revenue_delta,
                    cost_delta: i.cost_delta,
                    cost_category_id: i.cost_category_id,
                    is_scenario_only: i.is_scenario_only
                }))
                const { error: impErr } = await supabase.from('contract_change_impacts').insert(impactRows)
                if (impErr) throw impErr
            }

            onSuccess()
            onClose()

        } catch (err) {
            console.error(err)
            setAlertState({
                open: true,
                title: 'Error',
                description: 'Error saving change: ' + err.message,
                variant: 'destructive',
                showCancel: false,
                onConfirm: () => closeAlert()
            })
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        // 1. Validate totals (Client side check)
        const sumImpactRev = formData.impacts.reduce((s, i) => s + (parseFloat(i.revenue_delta) || 0), 0)

        // Warnings (soft validation)
        if (Math.abs(sumImpactRev - formData.revenue_delta) > 1) {
            setAlertState({
                open: true,
                title: 'Revenue Mismatch',
                description: `Warning: Time-phased revenue (${sumImpactRev}) does not match headline revenue (${formData.revenue_delta}). Continue?`,
                variant: 'default',
                showCancel: true,
                onConfirm: () => saveChanges()
            })
            return
        }

        await saveChanges()
    }

    // --- RENDERERS ---
    const renderNav = () => (
        <div className="flex border-b border-gray-200 bg-white px-6">
            {['identification', 'financial', 'forecasting', 'governance'].map(tab => (
                <button
                    key={tab}
                    type="button"
                    className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors focus:outline-none ${activeTab === tab
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    onClick={() => setActiveTab(tab)}
                >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
            ))}
        </div>
    )

    const renderIdentification = () => (
        <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b">Change Identification</h3>
            <div className="grid grid-cols-2 gap-6">
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Change Code <span className="text-red-500">*</span></label>
                    <input className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" required value={formData.change_code} onChange={e => handleChange('change_code', e.target.value)} />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Title <span className="text-red-500">*</span></label>
                    <input className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" required value={formData.title} onChange={e => handleChange('title', e.target.value)} />
                </div>
                <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-sm font-medium text-gray-700">Description <span className="text-red-500">*</span></label>
                    <textarea className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" required rows={3} value={formData.description} onChange={e => handleChange('description', e.target.value)} />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Change Type</label>
                    <select className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={formData.change_type} onChange={e => handleChange('change_type', e.target.value)}>
                        <option value="scope_addition">Scope Addition</option>
                        <option value="scope_reduction">Scope Reduction</option>
                        <option value="rate_change">Rate Change</option>
                        <option value="duration_change">Duration Change</option>
                        <option value="termination">Termination</option>
                        <option value="other">Other</option>
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Reason</label>
                    <textarea className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" rows={1} value={formData.reason_for_change} onChange={e => handleChange('reason_for_change', e.target.value)} />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Customer Ref</label>
                    <input className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={formData.customer_reference} onChange={e => handleChange('customer_reference', e.target.value)} />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Customer Contact</label>
                    <input className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={formData.customer_contact} onChange={e => handleChange('customer_contact', e.target.value)} />
                </div>
            </div>

            <h4 className="text-sm font-semibold text-gray-600 mt-8 mb-4 uppercase tracking-wider">Ownership</h4>
            <div className="grid grid-cols-3 gap-6">
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Commercial Owner</label>
                    <select className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={formData.commercial_owner} onChange={e => handleChange('commercial_owner', e.target.value)}>
                        <option value="">Select...</option>
                        {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Technical Owner</label>
                    <select className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={formData.technical_owner} onChange={e => handleChange('technical_owner', e.target.value)}>
                        <option value="">Select...</option>
                        {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
                    </select>
                </div>
            </div>
        </div>
    )

    const renderFinancial = () => (
        <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b">Commercial & Financial Impact</h3>

            {/* Headline */}
            <div className="p-5 bg-blue-50/50 border border-blue-100 rounded-lg mb-6 shadow-sm">
                <h4 className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-4">Headline Deltas</h4>
                <div className="grid grid-cols-4 gap-6">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-500">Revenue Change</label>
                        <div className="relative">
                            <DollarSign size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input type="number"
                                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                                value={formData.revenue_delta}
                                onChange={e => handleChange('revenue_delta', parseFloat(e.target.value))}
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-500">Cost Change</label>
                        <div className="relative">
                            <DollarSign size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input type="number"
                                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                                value={formData.cost_delta}
                                onChange={e => handleChange('cost_delta', parseFloat(e.target.value))}
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-500">Net Margin Impact</label>
                        <input disabled
                            value={((formData.revenue_delta - formData.cost_delta)).toFixed(2)}
                            className={`w-full px-3 py-2 bg-gray-50 border border-dotted border-gray-300 rounded text-sm font-bold ${formData.revenue_delta - formData.cost_delta >= 0 ? 'text-green-600' : 'text-red-500'}`}
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-500">Effective Date</label>
                        <input type="date"
                            className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.effective_date}
                            onChange={e => handleChange('effective_date', e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex gap-6 mt-4 pt-4 border-t border-blue-100">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500" checked={formData.is_retrospective} onChange={e => handleChange('is_retrospective', e.target.checked)} />
                        Is Retrospective?
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500" checked={formData.requires_rebaseline} onChange={e => handleChange('requires_rebaseline', e.target.checked)} />
                        Requires Re-baseline?
                    </label>
                </div>
            </div>

            {/* Cost Breakdown UI (Calculator) */}
            <div className="mb-8 p-4 border border-gray-200 rounded-lg">
                <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-semibold text-gray-700">Cost Breakdown (Calculator)</h4>
                    <button type="button" onClick={addCostRow} className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium">+ Add Item</button>
                </div>
                {formData.cost_breakdown?.length > 0 && (
                    <table className="w-full text-sm">
                        <thead className="text-xs text-gray-500 font-medium bg-gray-50 border-b">
                            <tr>
                                <th className="text-left py-2 px-3">Category</th>
                                <th className="text-left py-2 px-3">Amount</th>
                                <th className="text-left py-2 px-3">Notes</th>
                                <th className="w-8"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {formData.cost_breakdown.map(row => (
                                <tr key={row.id}>
                                    <td className="py-2 px-3">
                                        <select className="w-full border-gray-200 rounded text-sm py-1" value={row.category_id} onChange={e => updateCostRow(row.id, 'category_id', e.target.value)}>
                                            {costCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </td>
                                    <td className="py-2 px-3"><input type="number" className="w-full border-gray-200 rounded text-sm py-1" value={row.cost_delta} onChange={e => updateCostRow(row.id, 'cost_delta', e.target.value)} /></td>
                                    <td className="py-2 px-3"><input type="text" className="w-full border-gray-200 rounded text-sm py-1" value={row.notes} onChange={e => updateCostRow(row.id, 'notes', e.target.value)} /></td>
                                    <td className="py-2 px-3 text-center"><button type="button" className="text-gray-400 hover:text-red-500" onClick={() => removeCostRow(row.id)}><Trash2 size={14} /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {(!formData.cost_breakdown || formData.cost_breakdown.length === 0) && (
                    <div className="text-xs text-gray-400 text-center py-4 bg-gray-50 rounded">No items in breakdown match.</div>
                )}
            </div>

            {/* Time Phased Impacts */}
            <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                    <h4 className="text-sm font-semibold text-gray-700">Time-Phased Impact (Detailed)</h4>
                    <button type="button" onClick={addImpactRow} className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium">+ Add Period</button>
                </div>
                {formData.impacts?.length > 0 ? (
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                        <table className="w-full text-sm">
                            <thead className="text-xs text-gray-500 font-medium bg-gray-50 border-b">
                                <tr>
                                    <th className="text-left py-2 px-3 whitespace-nowrap">Period</th>
                                    <th className="text-left py-2 px-3 whitespace-nowrap">Rev Delta</th>
                                    <th className="text-left py-2 px-3 whitespace-nowrap">Cost Delta</th>
                                    <th className="text-left py-2 px-3 whitespace-nowrap">Cost Category</th>
                                    <th className="text-center py-2 px-3 whitespace-nowrap">Scenario Only</th>
                                    <th className="w-8"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {formData.impacts.map(row => (
                                    <tr key={row.id}>
                                        <td className="py-2 px-3"><input type="month" className="w-full border-gray-200 rounded text-sm py-1" value={row.period_month?.slice(0, 7)} onChange={e => updateImpactRow(row.id, 'period_month', e.target.value + '-01')} /></td>
                                        <td className="py-2 px-3"><input type="number" className="w-full border-gray-200 rounded text-sm py-1" value={row.revenue_delta} onChange={e => updateImpactRow(row.id, 'revenue_delta', parseFloat(e.target.value))} /></td>
                                        <td className="py-2 px-3"><input type="number" className="w-full border-gray-200 rounded text-sm py-1" value={row.cost_delta} onChange={e => updateImpactRow(row.id, 'cost_delta', parseFloat(e.target.value))} /></td>
                                        <td className="py-2 px-3">
                                            <select className="w-full border-gray-200 rounded text-sm py-1" value={row.cost_category_id} onChange={e => updateImpactRow(row.id, 'cost_category_id', e.target.value)}>
                                                {costCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </td>
                                        <td className="py-2 px-3 text-center"><input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500" checked={row.is_scenario_only} onChange={e => updateImpactRow(row.id, 'is_scenario_only', e.target.checked)} /></td>
                                        <td className="py-2 px-3 text-center"><button type="button" className="text-gray-400 hover:text-red-500" onClick={() => removeImpactRow(row.id)}><Trash2 size={14} /></button></td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-50 border-t font-semibold">
                                <tr>
                                    <td className="py-2 px-3 text-gray-500">Total</td>
                                    <td className="py-2 px-3 text-gray-800">{formData.impacts.reduce((s, i) => s + (i.revenue_delta || 0), 0).toFixed(2)}</td>
                                    <td className="py-2 px-3 text-gray-800">{formData.impacts.reduce((s, i) => s + (i.cost_delta || 0), 0).toFixed(2)}</td>
                                    <td colSpan={3}></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                ) : <div className="p-4 border border-dashed border-gray-300 rounded-lg text-center text-gray-400 text-sm">No time-phased impacts added.</div>}
            </div>
        </div>
    )

    const renderGovernance = () => (
        <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b">Governance & Risk</h3>
            <div className="grid grid-cols-2 gap-6">
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Status</label>
                    <select className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={formData.status} onChange={e => handleChange('status', e.target.value)}>
                        <option value="proposed">Proposed</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="implemented">Implemented</option>
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Risk Level</label>
                    <select className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={formData.risk_level} onChange={e => handleChange('risk_level', e.target.value)}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="flex items-center gap-2 mt-6">
                        <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500" checked={formData.customer_approval_received} onChange={e => handleChange('customer_approval_received', e.target.checked)} />
                        Customer Approval Received?
                    </label>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Approval Date</label>
                    <input className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" type="date" value={formData.approval_date} onChange={e => handleChange('approval_date', e.target.value)} />
                </div>
            </div>

            <h4 className="text-sm font-semibold text-gray-600 mt-8 mb-4 uppercase tracking-wider">Forecasting Factors</h4>
            <div className="grid grid-cols-2 gap-6">
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Conv. Prob. (%)</label>
                    <input className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" type="number" min="0" max="100" value={formData.conversion_probability_pct} onChange={e => handleChange('conversion_probability_pct', parseFloat(e.target.value))} />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Pot. Disallowed Costs</label>
                    <input className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" type="number" value={formData.potential_disallowed_costs} onChange={e => handleChange('potential_disallowed_costs', parseFloat(e.target.value))} />
                </div>
                <div className="flex flex-col gap-1 col-span-2">
                    <label className="text-sm font-medium text-gray-700">Tags (comma sep)</label>
                    <input className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. claim, vo, disputed" value={formData.tags?.join(', ')} onChange={e => handleChange('tags', e.target.value.split(',').map(s => s.trim()))} />
                </div>

                <div className="col-span-2 mt-4 pt-4 border-t">
                    <h4 className="text-sm font-semibold text-gray-600 mb-4 uppercase tracking-wider">Narrative & Review</h4>
                    <div className="grid grid-cols-2 gap-6">
                        <div className="flex flex-col gap-1">
                            <label className="text-sm font-medium text-gray-700">Risk Narrative</label>
                            <textarea className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" rows={4} value={formData.risk_narrative || ''} onChange={e => handleChange('risk_narrative', e.target.value)} placeholder="Describe risks..." />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-sm font-medium text-gray-700">Opportunity Narrative</label>
                            <textarea className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" rows={4} value={formData.opportunity_narrative || ''} onChange={e => handleChange('opportunity_narrative', e.target.value)} placeholder="Describe opportunities..." />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )

    return (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-[1000]">
            <div className="bg-white w-[1200px] max-w-[95vw] h-[90vh] rounded-lg shadow-2xl flex flex-col overflow-hidden">
                <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <h2 className="text-xl font-semibold text-gray-800">Contract Change Request (CCR)</h2>
                    <div className="flex items-center gap-2">
                        {formData.status === 'approved' && <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium border border-green-200">Approved</span>}
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl leading-none">&times;</button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden bg-white">
                    {renderNav()}

                    <div className="flex-1 overflow-y-auto bg-white">
                        {activeTab === 'identification' && renderIdentification()}
                        {activeTab === 'financial' && renderFinancial()}
                        {activeTab === 'forecasting' && <div className="p-4">Forecasting options included in Governance tab for now. <button type="button" className="text-blue-600 underline" onClick={() => setActiveTab('governance')}>Go to Governance</button></div>}
                        {activeTab === 'governance' && renderGovernance()}
                    </div>

                    <div className="flex justify-end px-6 py-4 border-t border-gray-200 bg-gray-50">
                        <div className="flex justify-between w-full">
                            <div className="text-xs text-gray-500 flex flex-col justify-center gap-1">
                                <span className="flex items-center gap-2">Total Revenue: <span className="font-semibold text-gray-700">{formData.revenue_delta}</span></span>
                                <span className="flex items-center gap-2">Total Cost: <span className="font-semibold text-gray-700">{formData.cost_delta}</span></span>
                            </div>
                            <div className="flex gap-2">
                                <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                                <Button type="submit">Save Change Request</Button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
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
