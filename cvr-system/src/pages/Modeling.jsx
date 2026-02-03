import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'

export default function Modeling() {
    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-2xl font-bold">What-If Modeling</h1>
            <Card>
                <CardHeader><CardTitle>Scenario Analysis</CardTitle></CardHeader>
                <CardContent>
                    <p className="text-gray-500">Create and compare scenarios to forecast outcomes based on potential changes.</p>
                </CardContent>
            </Card>
        </div>
    )
}
