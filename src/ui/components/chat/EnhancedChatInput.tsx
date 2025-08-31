import React, {useEffect} from "react";
import {Box, Text, useInput, useStdout} from "ink";
import {useSnapshot} from "valtio";
import {store, actions} from "../../../store";

/**
 * EnhancedChatInput component - chat input with vim-like modes
 */
export const EnhancedChatInput: React.FC = React.memo(() => {
    const snap = useSnapshot(store);
    const inputValue = snap.inputValue;
    const cursorPosition = snap.cursorPosition;
    const isProcessing = snap.isProcessing;
    const isStreaming = snap.isStreaming;
    const vimMode = snap.chatVimMode;
    const {stdout} = useStdout();
    const isTTY = stdout?.isTTY ?? false;
    
    // Vim mode indicator and tips
    const getModeIndicator = () => {
        if (vimMode === 'insert') {
            return {
                color: 'green',
                text: 'INSERT',
                tip: 'ESC: normal mode • Enter: send'
            };
        }
        return {
            color: 'yellow', 
            text: 'NORMAL',
            tip: 'i: insert mode • q/e: page up/down • /: command'
        };
    };
    
    const modeInfo = getModeIndicator();
    
    // Handle vim mode keyboard input
    useInput((input, key) => {
        // Don't handle input if processing
        if (isProcessing || isStreaming) return;
        
        // ESC always goes to normal mode
        if (key.escape) {
            actions.setChatVimMode('normal');
            return;
        }
        
        // Handle based on current mode
        if (vimMode === 'normal') {
            // Normal mode commands
            if (input === 'i') {
                actions.setChatVimMode('insert');
            } else if (input === 'q') {
                // Page up - emit custom event that ChatHistory can listen to
                process.stdout.emit('chat:pageUp');
            } else if (input === 'e') {
                // Page down
                process.stdout.emit('chat:pageDown');
            } else if (input === '/') {
                // Start command - switch to insert and add /
                actions.setChatVimMode('insert');
                actions.setInputValue('/');
            }
            
            // Don't process other keys in normal mode
            return;
        }
        
        // Insert mode - handled by existing input handler
    }, {isActive: isTTY});
    
    // Split input for cursor display
    const beforeCursor = inputValue.slice(0, cursorPosition);
    const atCursor = inputValue[cursorPosition] || ' ';
    const afterCursor = inputValue.slice(cursorPosition + 1);
    
    return (
        <Box 
            borderStyle="single" 
            borderColor={vimMode === 'insert' ? 'gray' : 'yellow'}
            borderTop={true}
            borderLeft={false}
            borderRight={false}
            borderBottom={false}
            paddingX={2} 
            paddingY={0}
            marginTop={1}
            marginBottom={1}
            width="100%"
        >
            <Text color="gray">❯ </Text>
            <Text>
                {beforeCursor}
                {!isProcessing && !isStreaming && vimMode === 'insert' && (
                    <Text inverse>{atCursor}</Text>
                )}
                {!isProcessing && !isStreaming && vimMode === 'normal' && (
                    <Text color="yellow" inverse>{atCursor}</Text>
                )}
                {afterCursor}
            </Text>
        </Box>
    );
});