import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

// If uuid is not in package.json from snippet, we might need to install it or use crypto.randomUUID()
import './ContractChangeForm.css';

// Simple uuid fallback if package not available, though snippet implied it might be.
// Checking package.json earlier showed no 'uuid'. I will use crypto.randomUUID() or a simple generator.
const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

const emptyChange = (userId) => ({
    id: generateId(),
    change_code: '',
    title: '',
    description: '',
    change_type: 'other',
    raised_by: '', // Will be filled with identifier or name
    effective_date: new Date().toISOString().split('T')[0],
    is_retrospective: false,
    requires_rebaseline: false,
    revenue_delta: 0,
    cost_delta: 0,
    customer_share_pct: 0,
    company_share_pct: 0,
    status: 'proposed',
    customer_approval_received: false,
    cost_breakdown: []
});

export const ContractChangeForm = ({ onClose, onSubmit, initialData }) => {
    const { user } = useAuth();
    const [formData, setFormData] = useState(initialData || emptyChange(user?.email || ''));
    const [costCategories, setCostCategories] = useState([]);
    const [people, setPeople] = useState([]);

    useEffect(() => {
        if (!initialData && user) {
            setFormData(prev => ({ ...prev, raised_by: user.email /* or name? */ }));
        }
    }, [user, initialData]);

    useEffect(() => {
        const fetchCats = async () => {
            const { data, error } = await supabase.from('cost_categories').select('*').order('sort_order', { ascending: true });
            if (data) setCostCategories(data);
        };
        const fetchPeople = async () => {
            const { data, error } = await supabase.from('profiles').select('id, full_name, email');
            if (data) setPeople(data.map(p => ({ id: p.id, name: p.full_name || p.email })));
        }
        fetchCats();
        fetchPeople();
    }, []);

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleCostBreakdownAdd = () => {
        if (!costCategories.length) return;
        const newRow = {
            id: generateId(),
            contract_change_id: formData.id,
            category_id: costCategories[0].id,
            cost_delta: 0,
            notes: ''
        };
        setFormData(prev => ({
            ...prev,
            cost_breakdown: [...(prev.cost_breakdown || []), newRow]
        }));
    };

    const handleCostBreakdownUpdate = (id, field, value) => {
        setFormData(prev => ({
            ...prev,
            cost_breakdown: (prev.cost_breakdown || []).map(row =>
                row.id === id ? { ...row, [field]: value } : row
            )
        }));
    };

    const handleCostBreakdownDelete = (id) => {
        setFormData(prev => ({
            ...prev,
            cost_breakdown: (prev.cost_breakdown || []).filter(row => row.id !== id)
        }));
    };

    // Calculate totals from breakdown to update main form cost_delta automatically if desired
    // Or just let user type it. For now, let's auto-sum if breakdown exists.
    useEffect(() => {
        if (formData.cost_breakdown && formData.cost_breakdown.length > 0) {
            const total = formData.cost_breakdown.reduce((sum, item) => sum + (parseFloat(item.cost_delta) || 0), 0);
            if (total !== formData.cost_delta) {
                setFormData(prev => ({ ...prev, cost_delta: total }));
            }
        }
    }, [formData.cost_breakdown]);


    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(formData);
    };

    const renderSectionA = () => (
        <fieldset className="form-section">
            <legend>Section A: Change Identification</legend>
            <div className="form-row">
                <div className="form-group">
                    <label>Change Code *</label>
                    <input required value={formData.change_code} onChange={e => handleChange('change_code', e.target.value)} />
                </div>
                <div className="form-group" style={{ flex: 2 }}>
                    <label>Title *</label>
                    <input required value={formData.title} onChange={e => handleChange('title', e.target.value)} />
                </div>
                <div className="form-group">
                    <label>Type</label>
                    <select value={formData.change_type} onChange={e => handleChange('change_type', e.target.value)}>
                        <option value="scope_addition">Scope Addition</option>
                        <option value="scope_reduction">Scope Reduction</option>
                        <option value="rate_change">Rate Change</option>
                        <option value="duration_change">Duration Change</option>
                        <option value="termination">Termination</option>
                        <option value="other">Other</option>
                    </select>
                </div>
            </div>
            <div className="form-group">
                <label>Description *</label>
                <textarea required rows={3} value={formData.description} onChange={e => handleChange('description', e.target.value)} />
            </div>
            <div className="form-row">
                <div className="form-group">
                    <label>Reason for Change</label>
                    <textarea value={formData.reason_for_change} onChange={e => handleChange('reason_for_change', e.target.value)} />
                </div>
                <div className="form-group">
                    <label>Customer Reference</label>
                    <input value={formData.customer_reference} onChange={e => handleChange('customer_reference', e.target.value)} />
                </div>
            </div>
            <h4>Ownership</h4>
            <div className="form-row">
                <div className="form-group">
                    <label>Raised By</label>
                    <input disabled value={formData.raised_by || ''} />
                </div>
                <div className="form-group">
                    <label>Commercial Owner</label>
                    <select value={formData.commercial_owner || ''} onChange={e => handleChange('commercial_owner', e.target.value)}>
                        <option value="">Select...</option>
                        {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label>Technical Owner</label>
                    <select value={formData.technical_owner || ''} onChange={e => handleChange('technical_owner', e.target.value)}>
                        <option value="">Select...</option>
                        {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
            </div>
        </fieldset>
    );

    const renderSectionB = () => (
        <fieldset className="form-section">
            <legend>Section B: Commercial Impact</legend>
            <div className="form-row">
                <div className="form-group">
                    <label>Revenue Delta</label>
                    <input type="number" value={formData.revenue_delta} onChange={e => handleChange('revenue_delta', parseFloat(e.target.value))} />
                </div>
                <div className="form-group">
                    <label>Cost Delta</label>
                    <input type="number" value={formData.cost_delta} onChange={e => handleChange('cost_delta', parseFloat(e.target.value))} />
                </div>
                <div className="form-group">
                    <label>Effective Date</label>
                    <input type="date" value={formData.effective_date} onChange={e => handleChange('effective_date', e.target.value)} />
                </div>
            </div>

            <div className="form-row">
                <div className="form-group">
                    <label>Status</label>
                    <select value={formData.status} onChange={e => handleChange('status', e.target.value)}>
                        <option value="proposed">Proposed</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="implemented">Implemented</option>
                    </select>
                </div>
                <div className="form-group">
                    <label>Risk Level</label>
                    <select value={formData.risk_level || 'low'} onChange={e => handleChange('risk_level', e.target.value)}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                    </select>
                </div>
            </div>
        </fieldset>
    );

    const renderSectionCostBreakdown = () => (
        <fieldset className="form-section">
            <legend>Cost Breakdown</legend>
            <button type="button" onClick={handleCostBreakdownAdd} className="btn btn-secondary" style={{ marginBottom: '10px' }}>+ Add Line Item</button>

            {formData.cost_breakdown && formData.cost_breakdown.length > 0 ? (
                <table>
                    <thead>
                        <tr>
                            <th>Category</th>
                            <th>Amount</th>
                            <th>Notes</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {formData.cost_breakdown.map(row => (
                            <tr key={row.id}>
                                <td>
                                    <select value={row.category_id} onChange={e => handleCostBreakdownUpdate(row.id, 'category_id', e.target.value)}>
                                        {costCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </td>
                                <td>
                                    <input type="number" value={row.cost_delta} onChange={e => handleCostBreakdownUpdate(row.id, 'cost_delta', parseFloat(e.target.value))} />
                                </td>
                                <td>
                                    <input type="text" value={row.notes || ''} onChange={e => handleCostBreakdownUpdate(row.id, 'notes', e.target.value)} />
                                </td>
                                <td>
                                    <button type="button" onClick={() => handleCostBreakdownDelete(row.id)} className="text-danger">Recall</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : <p>No breakdown items.</p>}
        </fieldset>
    );

    return (
        <div className="contract-change-form-overlay">
            <div className="ccr-modal-content">
                <div className="form-header">
                    <h2>Contract Change Request (CCR)</h2>
                    <button onClick={onClose} className="btn-close">×</button>
                </div>
                <form onSubmit={handleSubmit} className="ccr-form">
                    {renderSectionA()}
                    {renderSectionB()}
                    {renderSectionCostBreakdown()}
                    <div className="form-actions">
                        <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
                        <button type="submit" className="btn btn-primary">Save Change Request</button>
                    </div>
                </form>
            </div>
        </div>
    );
};
