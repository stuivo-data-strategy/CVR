import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ContractChangeForm } from '../components/ContractChangeForm';
import { useAuth } from '../hooks/useAuth';
// Reuse existing UI components if available, or standard HTML/CSS for now as per migration pack
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Plus, Filter, Search } from 'lucide-react'

// Simple CSS for the page layout if not using modules or existing global styles
const styles = {
    container: 'p-6 max-w-[1600px] mx-auto',
    header: 'flex justify-between items-center mb-6',
    title: 'text-2xl font-bold text-gray-900',
    table: 'w-full text-sm text-left',
    th: 'px-4 py-3 bg-gray-50 font-medium text-gray-500',
    td: 'px-4 py-3 border-t border-gray-100',
    badge: 'px-2 py-1 rounded-full text-xs font-medium',
    status_proposed: 'bg-blue-100 text-blue-700',
    status_approved: 'bg-green-100 text-green-700',
    status_rejected: 'bg-red-100 text-red-700',
    status_implemented: 'bg-purple-100 text-purple-700',
};

export default function ContractChanges() {
    const { isManager, isAdmin } = useAuth();
    const [changes, setChanges] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [selectedChange, setSelectedChange] = useState(undefined);
    const [loading, setLoading] = useState(true);

    const fetchChanges = async () => {
        setLoading(true);
        const { data: changeData, error } = await supabase
            .from('contract_changes')
            .select('*, cost_breakdown:contract_change_cost_breakdown(*)')
            .order('effective_date', { ascending: false });

        if (changeData) setChanges(changeData);
        if (error) console.error("Error fetching changes:", error);

        setLoading(false);
    };

    useEffect(() => { fetchChanges(); }, []);

    const handleSubmit = async (change) => {
        // Separate nested data
        const { cost_breakdown, ...changeData } = change;

        // Upsert Change
        const { data, error } = await supabase.from('contract_changes').upsert(changeData).select().single();

        if (error) {
            alert("Error saving: " + error.message);
            return;
        }

        // Handle Breakdown
        if (data && cost_breakdown) {
            // Basic strategy: delete all for this change and re-insert (safe for small lists, inefficient for huge ones)
            // or upsert if IDs are stable. 
            // Ideally we should handle inserts/updates/deletes more carefully.
            // For prototype/migration speed:
            const validRows = cost_breakdown.map(r => ({
                ...r,
                contract_change_id: data.id,
                cost_delta: parseFloat(r.cost_delta) || 0
            }));

            // For simplicity, we might just upsert them all. 
            // To handle deletes, we'd need to know which ones were removed. The form logic handles local state.
            // Let's delete existing for this ID first to be safe (if not too destructive) or just upsert.
            // Using delete-all-insert requires knowing we have the FULL list. The form passes the full list.
            await supabase.from('contract_change_cost_breakdown').delete().eq('contract_change_id', data.id);
            if (validRows.length > 0) {
                await supabase.from('contract_change_cost_breakdown').insert(validRows);
            }
        }

        setShowForm(false);
        fetchChanges();
    };

    const handleEdit = (change) => {
        setSelectedChange(change);
        setShowForm(true);
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Contract Change Requests</h1>
                <Button onClick={() => { setSelectedChange(undefined); setShowForm(true); }}>
                    <Plus size={16} className="mr-2" /> New Change Request
                </Button>
            </div>

            <Card>
                <div style={{ overflowX: 'auto' }}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th className={styles.th}>Code</th>
                                <th className={styles.th}>Title</th>
                                <th className={styles.th}>Type</th>
                                <th className={styles.th}>Status</th>
                                <th className={styles.th}>Effective Date</th>
                                <th className={styles.th}>Revenue</th>
                                <th className={styles.th}>Cost</th>
                                <th className={styles.th}>Margin</th>
                                <th className={styles.th}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {changes.length === 0 ? (
                                <tr>
                                    <td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                                        No change requests found.
                                    </td>
                                </tr>
                            ) : changes.map(change => (
                                <tr key={change.id} onClick={() => handleEdit(change)} style={{ cursor: 'pointer' }}>
                                    <td className={styles.td}>{change.change_code}</td>
                                    <td className={styles.td}>{change.title}</td>
                                    <td className={styles.td} style={{ textTransform: 'capitalize' }}>{change.change_type?.replace('_', ' ')}</td>
                                    <td className={styles.td}>
                                        <span className={`${styles.badge} ${styles['status_' + change.status]}`}>
                                            {change.status}
                                        </span>
                                    </td>
                                    <td className={styles.td}>{change.effective_date}</td>
                                    <td className={styles.td}>{(change.revenue_delta || 0).toLocaleString()}</td>
                                    <td className={styles.td}>{(change.cost_delta || 0).toLocaleString()}</td>
                                    <td className={styles.td}>{((change.revenue_delta || 0) - (change.cost_delta || 0)).toLocaleString()}</td>
                                    <td className={styles.td}>
                                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEdit(change); }}>Edit</Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {showForm && (
                <ContractChangeForm
                    onClose={() => setShowForm(false)}
                    onSubmit={handleSubmit}
                    initialData={selectedChange}
                />
            )}
        </div>
    );
};
