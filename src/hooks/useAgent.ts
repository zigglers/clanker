import { useEffect, useState } from 'react';
import { subscribe } from 'valtio';
import { store } from '../store';
import { GrokAgent } from '../clanker/agent';

/**
 * Hook to safely get the agent from the store without causing infinite re-renders
 */
export function useAgent(): GrokAgent | null {
    const [agent, setAgent] = useState<GrokAgent | null>(null);
    
    useEffect(() => {
        // Set initial value
        setAgent(store.agent);
        
        // Subscribe to changes
        const unsubscribe = subscribe(store, () => {
            setAgent(store.agent);
        });
        
        return unsubscribe;
    }, []);
    
    return agent;
}