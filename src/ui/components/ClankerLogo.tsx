import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { useInput } from 'ink';
import { GrokAgent } from '../../clanker/agent';
import { ToolDefinition } from '../../registry';

interface ClankerLogoProps {
    agent?: GrokAgent;
    onComplete?: () => void;
}

interface ToolInfo {
    id: string;
    name: string;
}

export const ClankerLogo: React.FC<ClankerLogoProps> = ({ agent, onComplete }) => {
    const [shouldSkip, setShouldSkip] = useState(false);
    const [colorIndex, setColorIndex] = useState(0);
    const [isVisible, setIsVisible] = useState(true);
    const [tools, setTools] = useState<ToolInfo[]>([]);
    const [toolsLoaded, setToolsLoaded] = useState(false);
    
    // Color cycle for the border
    const colors = ['red', 'yellow', 'green', 'cyan', 'blue', 'magenta'];
    
    // Handle escape key
    useInput((input, key) => {
        if (key.escape) {
            setShouldSkip(true);
        }
    });
    
    // Color cycling effect
    useEffect(() => {
        const colorInterval = setInterval(() => {
            setColorIndex((prev) => (prev + 1) % colors.length);
        }, 200);
        
        return () => clearInterval(colorInterval);
    }, []);
    
    // Load tools
    useEffect(() => {
        const loadTools = async () => {
            if (!agent) {
                setToolsLoaded(true);
                return;
            }
            
            try {
                // First check if tools are already loaded
                const toolRegistry = agent.getRegistry();
                let loadedTools: ToolInfo[] = [];
                
                // Try to get existing tools
                const existingTools = toolRegistry.list();
                if (existingTools.length === 0) {
                    // If no tools yet, wait for them to load
                    await agent.waitForToolsToLoad();
                }
                
                // Get all tools from the registry
                loadedTools = [];
                toolRegistry.list().forEach(toolId => {
                    const tool = toolRegistry.get(toolId);
                    if (tool) {
                        loadedTools.push({
                            id: toolId,
                            name: tool.definition.name || toolId
                        });
                    }
                });
                
                // If still no tools, check for installed tools in ~/.clanker/tools
                if (loadedTools.length === 0) {
                    // Add a small delay and retry once
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    toolRegistry.list().forEach(toolId => {
                        const tool = toolRegistry.get(toolId);
                        if (tool) {
                            loadedTools.push({
                                id: toolId,
                                name: tool.definition.name || toolId
                            });
                        }
                    });
                }
                
                console.log(`[ClankerLogo] Loaded ${loadedTools.length} tools:`, loadedTools.map(t => t.name));
                setTools(loadedTools);
                setToolsLoaded(true);
            } catch (error) {
                console.error('Failed to load tools:', error);
                setToolsLoaded(true);
            }
        };
        
        loadTools();
    }, [agent]);
    
    // Auto-advance after tools are loaded
    useEffect(() => {
        if (shouldSkip && onComplete) {
            setIsVisible(false);
            onComplete();
            return;
        }
        
        // Auto-advance after tools are loaded and a short delay
        if (toolsLoaded && onComplete) {
            const timer = setTimeout(() => {
                setIsVisible(false);
                onComplete();
            }, 5000); // Show for 5 seconds after tools load
            
            return () => clearTimeout(timer);
        }
    }, [onComplete, shouldSkip, toolsLoaded]);
    
    if (!isVisible) {
        return null;
    }
    
    // Get current working directory
    const cwd = process.cwd();
    const shortCwd = cwd.length > 50 ? '...' + cwd.slice(-47) : cwd;
    
    // Prepare tools grid
    const maxToolsToShow = 12; // 3x4 grid
    const maxToolNameLength = 15;
    
    const displayTools = tools.slice(0, maxToolsToShow).map(tool => {
        const name = tool.name.length > maxToolNameLength 
            ? tool.name.substring(0, maxToolNameLength - 3) + '...'
            : tool.name;
        return name;
    });
    
    const remainingTools = tools.length - maxToolsToShow;
    
    // Create grid layout (4 columns)
    const columns = 4;
    const rows = Math.ceil(displayTools.length / columns);
    
    return (
        <Box flexDirection="column" alignItems="center" justifyContent="center" height="100%">
            <Box 
                flexDirection="column" 
                borderStyle="round" 
                borderColor={colors[colorIndex]}
                paddingX={2}
                paddingY={1}
                width={80}
            >
                {/* Logo */}
                <Box justifyContent="center" marginBottom={1}>
                    <Text color={colors[colorIndex]}>
                        {'  ██████╗██╗      █████╗ ███╗   ██╗██╗  ██╗███████╗██████╗ \n'}
                        {' ██╔════╝██║     ██╔══██╗████╗  ██║██║ ██╔╝██╔════╝██╔══██╗\n'}
                        {' ██║     ██║     ███████║██╔██╗ ██║█████╔╝ █████╗  ██████╔╝\n'}
                        {' ██║     ██║     ██╔══██║██║╚██╗██║██╔═██╗ ██╔══╝  ██╔══██╗\n'}
                        {' ╚██████╗███████╗██║  ██║██║ ╚████║██║  ██╗███████╗██║  ██║\n'}
                        {'  ╚═════╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝'}
                    </Text>
                </Box>
                
                {/* Info Box */}
                <Box 
                    flexDirection="column" 
                    borderStyle="single" 
                    borderColor={colors[(colorIndex + 3) % colors.length]}
                    paddingX={1}
                    marginTop={1}
                >
                    {/* Current Working Directory */}
                    <Box marginBottom={1}>
                        <Text bold color="cyan">CWD: </Text>
                        <Text color="white">{shortCwd}</Text>
                    </Box>
                    
                    {/* Tools Section */}
                    <Box flexDirection="column">
                        <Text bold color="cyan">
                            Tools loaded: {toolsLoaded ? tools.length : '...'}
                        </Text>
                        
                        {toolsLoaded && tools.length > 0 ? (
                            <Box flexDirection="column" marginTop={1}>
                                {/* Render grid */}
                                {Array.from({ length: rows }, (_, rowIndex) => (
                                    <Box key={rowIndex}>
                                        {Array.from({ length: columns }, (_, colIndex) => {
                                            const toolIndex = rowIndex * columns + colIndex;
                                            if (toolIndex < displayTools.length) {
                                                return (
                                                    <Box key={colIndex} width={17} marginRight={1}>
                                                        <Text color="gray">• {displayTools[toolIndex]}</Text>
                                                    </Box>
                                                );
                                            }
                                            return <Box key={colIndex} width={17} marginRight={1} />;
                                        })}
                                    </Box>
                                ))}
                                
                                {/* Show remaining count if any */}
                                {remainingTools > 0 && (
                                    <Box marginTop={1}>
                                        <Text italic color="yellow">
                                            ... and {remainingTools} more
                                        </Text>
                                    </Box>
                                )}
                            </Box>
                        ) : toolsLoaded && tools.length === 0 ? (
                            <Box marginTop={1}>
                                <Text color="gray">No additional tools installed</Text>
                                <Text color="gray" fontSize={10}>Core tools are built-in</Text>
                            </Box>
                        ) : (
                            <Box marginTop={1}>
                                <Text color="yellow">Loading tools...</Text>
                            </Box>
                        )}
                    </Box>
                </Box>
            </Box>
            
            <Box marginTop={1}>
                <Text dimColor>Ctrl+C to exit</Text>
            </Box>
        </Box>
    );
};