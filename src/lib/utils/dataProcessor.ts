import { applyGoalOverride } from '$lib/config.js';

export function processChartData(historicalData: any[]): any[] {
    const hourlyData: Record<number, number[]> = {};
    
    historicalData.forEach(row => {
        const hour = new Date(row.timestamp).getHours();
        if (!hourlyData[hour]) {
            hourlyData[hour] = [];
        }
        hourlyData[hour].push(row.change_amount);
    });
    
    return Object.entries(hourlyData).map(([hour, changes]) => ({
        hour: `${hour}:00`,
        signatures: (changes as number[]).reduce((sum: number, change: number) => sum + change, 0),
        count: changes.length
    })).sort((a, b) => parseInt(a.hour) - parseInt(b.hour));
}

export function calculateStats(historicalData: any[], chartData: any[], liveData: any) {
    if (historicalData.length === 0) return {
        avgPerHour: 0,
        peakHour: 0,
        totalToday: 0,
        timeToGoal: 'Calculating...'
    };
    
    const totalChanges = historicalData.reduce((sum, row) => sum + row.change_amount, 0);
    const hours = historicalData.length > 0 ? 
        (Date.now() - new Date(historicalData[0].timestamp).getTime()) / (1000 * 60 * 60) : 1;
    
    const avgPerHour = Math.round(totalChanges / Math.max(hours, 1));
    const totalToday = totalChanges;
    
    const peakData = chartData.reduce((max, curr) => 
        curr.signatures > max.signatures ? curr : max, 
        { signatures: 0, hour: '0:00' }
    );
    const peakHour = parseInt(peakData.hour);
    
    let timeToGoal = 'Calculating...';
    if (liveData && avgPerHour > 0) {
        const remaining = liveData.goal - liveData.signatureCount;
        const hoursToGoal = remaining / avgPerHour;
        if (hoursToGoal < 24) {
            timeToGoal = `${Math.round(hoursToGoal)} hours`;
        } else {
            timeToGoal = `${Math.round(hoursToGoal / 24)} days`;
        }
    }
    
    return {
        avgPerHour,
        peakHour,
        totalToday,
        timeToGoal
    };
}

export function simulateData() {
    const now = new Date();
    const historicalData = [];
    let signatureCount = 850000;
    
    for (let i = 24; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - (i * 60 * 60 * 1000));
        const change = Math.floor(Math.random() * 5000) + 1000;
        signatureCount += change;
        
        historicalData.push({
            timestamp: timestamp.toISOString(),
            signature_count: signatureCount,
            change_amount: change
        });
    }
    
    const liveData = applyGoalOverride({
        signatureCount: signatureCount,
        goal: 1000000
    });
    
    return { historicalData, liveData };
}