import React from "react";
import {Box, Text} from "ink";
import {useSnapshot} from "valtio";
import {store} from "../../../store";

/**
 * ChatInput component - displays the current input with a cursor
 * Uses Valtio store directly - no props needed
 */
export const ChatInput: React.FC = React.memo(() => {
    // Get state values - Valtio handles reactivity automatically
    const snap = useSnapshot(store);
    const inputValue = snap.inputValue;
    const cursorPosition = snap.cursorPosition;
    const isProcessing = snap.isProcessing;
    const isStreaming = snap.isStreaming;
    
    // Split input into parts for cursor display
    const beforeCursor = inputValue.slice(0, cursorPosition);
    const atCursor = inputValue[cursorPosition] || ' ';
    const afterCursor = inputValue.slice(cursorPosition + 1);
    
    return (
        <Box 
            borderStyle="single" 
            borderColor="gray" 
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
                {!isProcessing && !isStreaming && (
                    <Text inverse>{atCursor}</Text>
                )}
                {afterCursor}
            </Text>
        </Box>
    );
})
