import React, { useState, useEffect } from 'react';
import { useSnapshot } from 'valtio';
import { GrokAgent } from '../../clanker/agent';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { StageRouter } from '../stage/StageRouter';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SettingsManager, Settings, ProviderModels } from '../../utils/settings-manager';
import { actions, store } from '../../store';
import { registerBuiltinCommands } from '../../commands/builtin';

interface AppContainerProps {
    onRequestReload?: () => void;
}

export const AppContainer: React.FC<AppContainerProps> = ({ onRequestReload }) => {
    const snap = useSnapshot(store);
    const [showWelcome, setShowWelcome] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [agent, setAgent] = useState<GrokAgent | null>(null);
    const settingsManager = SettingsManager.getInstance();

    useEffect(() => {
        const initialize = async () => {
            // Clear the screen before showing anything
            console.clear();

            // Register built-in commands once on app startup
            registerBuiltinCommands();

            // Load settings from disk
            actions.loadSettings();
            
            // If agent already exists in store, use it
            if (store.agent) {
                setAgent(store.agent);
                setShowWelcome(true);
                setIsInitialized(true);
                return;
            }
            
            // Check if we have settings
            const { settings, isValid } = settingsManager.loadSettings();
            
            if (isValid && settings.apiKey) {
                // We have valid settings, create agent
                try {
                    let baseURL: string | undefined;
                    if (settings.provider === 'custom') {
                        baseURL = settings.customBaseURL;
                    } else {
                        const providerConfig = ProviderModels[settings.provider || 'grok'];
                        baseURL = providerConfig.baseURL;
                    }

                    const newAgent = new GrokAgent({
                        apiKey: settings.apiKey,
                        baseURL,
                        model: settings.model || ProviderModels.grok.defaultModel,
                        loadDynamicTools: true
                    });

                    // Wait for tools to load
                    await newAgent.waitForToolsToLoad();
                    
                    // Set agent in global store and local state
                    actions.setAgent(newAgent);
                    setAgent(newAgent);
                    
                    // Show welcome screen
                    setShowWelcome(true);
                } catch (error) {
                    console.error('Failed to initialize agent:', error);
                    // Show settings if agent creation failed
                    setShowSettings(true);
                }
            } else {
                // No valid settings, show settings screen
                setShowSettings(true);
            }
            
            setIsInitialized(true);
        };

        initialize();
    }, []);

    const handleWelcomeComplete = () => {
        setShowWelcome(false);
    };

    const handleSettingsComplete = async (settings: Settings) => {
        try {
            // Get the base URL from provider configuration
            let baseURL: string | undefined;
            if (settings.provider === 'custom') {
                baseURL = settings.customBaseURL;
            } else {
                const providerConfig = ProviderModels[settings.provider || 'grok'];
                baseURL = providerConfig.baseURL;
            }

            // Dispose of existing agent if any
            if (agent) {
                agent.dispose();
            }

            // Create new agent with all the proper settings
            const newAgent = new GrokAgent({
                apiKey: settings.apiKey,
                baseURL,
                model: settings.model || ProviderModels.grok.defaultModel,
                loadDynamicTools: true
            });

            // Wait for tools to load
            await newAgent.waitForToolsToLoad();

            // Update the global store and local state
            actions.setAgent(newAgent);
            setAgent(newAgent);
            actions.clearMessages();

            // Update store settings
            actions.setModel(settings.model);
            actions.setTheme(settings.theme);
            actions.setAutoEdit(settings.autoEditEnabled);
            actions.setVSCodeOpen(settings.vsCodeOpenEnabled);
            actions.setDangerousBypassPermission(settings.dangerousBypassPermission);
            actions.updateConfirmationSettings(settings.confirmationSettings);

            // Hide settings and show welcome for normal flow
            setShowSettings(false);
            console.clear();  // Clear screen before showing welcome
            setShowWelcome(true);

            console.log('Agent initialized successfully');
        } catch (error) {
            console.error('Failed to initialize agent:', error);
            // Keep showing settings on error
        }
    };

    const handleSettingsCancel = () => {
        // If we have an agent, just close settings
        if (agent) {
            setShowSettings(false);
        }
        // Otherwise, we can't proceed without settings
    };

    // Wait for initialization
    if (!isInitialized) {
        return null;
    }

    // Show settings if needed
    if (showSettings) {
        return (
            <SettingsScreen 
                onComplete={handleSettingsComplete}
                onCancel={agent ? handleSettingsCancel : undefined}
            />
        );
    }

    // Show welcome screen
    if (showWelcome && agent) {
        return <WelcomeScreen agent={agent} onComplete={handleWelcomeComplete} />;
    }

    // Show main app with agent
    if (agent) {
        return <StageRouter agent={agent} />;
    }

    // This shouldn't happen, but show settings as fallback
    return <SettingsScreen onComplete={handleSettingsComplete} />;
};