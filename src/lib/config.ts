// 🎯 SINGLE PLACE TO CHANGE THE GOAL
export const GOAL_OVERRIDE = 1500000;

// Helper function to apply goal override to any data
export function applyGoalOverride(data: any): any {
    if (!data) return data;
    
    if (Array.isArray(data)) {
        return data.map(item => ({ ...item, goal: GOAL_OVERRIDE }));
    }
    
    return { ...data, goal: GOAL_OVERRIDE };
}