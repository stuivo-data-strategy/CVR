import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'

export default function Reports() {
    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-2xl font-bold">Reports</h1>
            <Card>
                <CardHeader><CardTitle>Portfolio Reports</CardTitle></CardHeader>
                <CardContent>
                    <p className="text-gray-500">Reporting dashboards and export functionality will be implemented here.</p>
                </CardContent>
            </Card>
        </div>
    )
}
