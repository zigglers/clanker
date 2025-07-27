/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Shared state management for tools
 *
 * This module provides a way for tools to share state across invocations,
 * even when they are loaded as separate modules.
 */

import {debug} from '../utils/debug-logger';

/**
 * Global shared state storage
 */
const sharedState = new Map<string, any>();

/**
 * State change listeners
 */
const stateListeners = new Map<string, Set<(newValue: any, oldValue: any) => void>>();

/**
 * Get shared state value
 */
export function getSharedState<T = any>(key: string): T | undefined {
    return sharedState.get(key);
}

/**
 * Set shared state value
 */
export function setSharedState<T = never>(key: string, value: T): void {
    const oldValue = sharedState.get(key);
    sharedState.set(key, value);

    debug.log(`[SharedState] Set ${key} = ${JSON.stringify(value)}`);

    // Notify listeners
    const listeners = stateListeners.get(key);
    if (listeners) {
        listeners.forEach(listener => {
            try {
                listener(value, oldValue);
            } catch (error) {
                debug.error(`[SharedState] Listener error for ${key}:`, error);
            }
        });
    }
}

/**
 * Update shared state value using a function
 */
export function updateSharedState<T = any>(key: string, updater: (current: T | undefined) => T): T {
    const current = getSharedState<T>(key);
    const newValue = updater(current);
    setSharedState(key, newValue);
    return newValue;
}

/**
 * Delete shared state value
 */
export function deleteSharedState(key: string): boolean {
    const had = sharedState.has(key);
    sharedState.delete(key);

    if (had) {
        debug.log(`[SharedState] Deleted ${key}`);

        // Notify listeners with undefined as new value
        const listeners = stateListeners.get(key);
        if (listeners) {
            listeners.forEach(listener => {
                try {
                    listener(undefined, sharedState.get(key));
                } catch (error) {
                    debug.error(`[SharedState] Listener error for ${key}:`, error);
                }
            });
        }
    }

    return had;
}

/**
 * Check if shared state has a key
 */
export function hasSharedState(key: string): boolean {
    return sharedState.has(key);
}

/**
 * Get all shared state keys
 */
export function getSharedStateKeys(): string[] {
    return Array.from(sharedState.keys());
}

/**
 * Clear all shared state
 */
export function clearSharedState(): void {
    const keys = Array.from(sharedState.keys());
    sharedState.clear();

    debug.log('[SharedState] Cleared all state');

    // Notify all listeners
    keys.forEach(key => {
        const listeners = stateListeners.get(key);
        if (listeners) {
            listeners.forEach(listener => {
                try {
                    listener(undefined, undefined);
                } catch (error) {
                    debug.error(`[SharedState] Listener error for ${key}:`, error);
                }
            });
        }
    });
}

/**
 * Subscribe to state changes
 */
export function onSharedStateChange<T = any>(
    key: string,
    listener: (newValue: T | undefined, oldValue: T | undefined) => void
): () => void {
    if (!stateListeners.has(key)) {
        stateListeners.set(key, new Set());
    }

    stateListeners.get(key)!.add(listener);

    // Return unsubscribe function
    return () => {
        const listeners = stateListeners.get(key);
        if (listeners) {
            listeners.delete(listener);
            if (listeners.size === 0) {
                stateListeners.delete(key);
            }
        }
    };
}

/**
 * Create a namespaced state helper
 */
export function createNamespacedState<T = any>(namespace: string) {
    const getKey = (key: string) => `${namespace}:${key}`;

    return {
        get(key: string): T | undefined {
            return getSharedState<T>(getKey(key));
        },

        set(key: string, value: T): void {
            setSharedState(getKey(key), value);
        },

        update(key: string, updater: (current: T | undefined) => T): T {
            return updateSharedState<T>(getKey(key), updater);
        },

        delete(key: string): boolean {
            return deleteSharedState(getKey(key));
        },

        has(key: string): boolean {
            return hasSharedState(getKey(key));
        },

        keys(): string[] {
            const prefix = `${namespace}:`;
            return getSharedStateKeys()
                .filter(k => k.startsWith(prefix))
                .map(k => k.substring(prefix.length));
        },

        clear(): void {
            const prefix = `${namespace}:`;
            getSharedStateKeys()
                .filter(k => k.startsWith(prefix))
                .forEach(k => deleteSharedState(k));
        },

        onChange(key: string, listener: (newValue: T | undefined, oldValue: T | undefined) => void): () => void {
            return onSharedStateChange<T>(getKey(key), listener);
        }
    };
}

/**
 * Shared state interface for tools
 */
export interface SharedStateAPI {
    get<T = any>(key: string): T | undefined;

    set<T = any>(key: string, value: T): void;

    update<T = any>(key: string, updater: (current: T | undefined) => T): T;

    delete(key: string): boolean;

    has(key: string): boolean;

    keys(): string[];

    clear(): void;

    onChange<T = any>(key: string, listener: (newValue: T | undefined, oldValue: T | undefined) => void): () => void;

    namespace<T = any>(namespace: string): NamespacedState<T>;
}

/**
 * Namespaced state interface
 */
export interface NamespacedState<T = any> {
    get(key: string): T | undefined;

    set(key: string, value: T): void;

    update(key: string, updater: (current: T | undefined) => T): T;

    delete(key: string): boolean;

    has(key: string): boolean;

    keys(): string[];

    clear(): void;

    onChange(key: string, listener: (newValue: T | undefined, oldValue: T | undefined) => void): () => void;
}

/**
 * Create shared state API for tools
 */
export function createSharedStateAPI(): SharedStateAPI {
    return {
        get: getSharedState,
        set: setSharedState,
        update: updateSharedState,
        delete: deleteSharedState,
        has: hasSharedState,
        keys: getSharedStateKeys,
        clear: clearSharedState,
        onChange: onSharedStateChange,
        namespace: createNamespacedState
    };
}