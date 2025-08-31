import React, {useCallback, useRef} from "react";
import {Box, useInput} from "ink";
import {useSnapshot} from "valtio";
import {ChatLayout} from "../components/chat/ChatLayout";
import {CommandSuggestions} from "../components/command-suggestions";
import {ChatHistory} from "../components/chat-history";
import {EnhancedChatInput} from "../components/chat/EnhancedChatInput";
import {StatusBar} from "../components/chat/StatusBar";
import {LoadingAndStatus} from "../components/chat/LoadingAndStatus";
import {ModelSelection} from "../components/model-selection";
import {ConfirmationService} from "../../utils/confirmation-service";
import {useInputHandler} from "../../hooks/useInputHandler";
import {useConfirmationHandler} from "../../hooks/useConfirmationHandler";
import {useProcessingTimer} from "../../hooks/useProcessingTimer";
import {useRegistries} from "../../hooks/useRegistries";
import {store, actions} from "../../store";
import {StageType} from "../stage/types";
import {useAgent} from "../../hooks/useAgent";

/**
 * Main chat container component
 * Manages the overall chat interface and state
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function ChatContainer() {
    const agent = useAgent();
    // Use Valtio's useSnapshot as intended
    const snap = useSnapshot(store);

    // Get registries
    const {messageRegistry, executionRegistry} = useRegistries();
    const toolRegistry = agent?.getRegistry();
    const {handleConfirmation, handleRejection} = useConfirmationHandler();

    // Timer for processing duration
    const processingStartTime = useRef<number>(Date.now());
    useProcessingTimer();

    // Input handler state
    const {
        showCommandSuggestions,
        showModelSelection,
        handleEnter,
        handleUpArrow,
        handleDownArrow,
    } = useInputHandler({
        messageRegistry,
        executionRegistry,
        processingStartTime,
        confirmationOptions: snap.confirmationOptions,
    });

    // Confirmation service
    const confirmationService = ConfirmationService.getInstance();

    // Handle Ctrl+C
    const handleCtrlC = useCallback(() => {
        // Show exit confirmation modal
        actions.pushStage({ id: 'exit-confirmation', type: StageType.EXIT_CONFIRMATION });
    }, []);

    // Toggle auto-edit
    const toggleAutoEdit = useCallback(() => {
        const newAutoEditState = !snap.autoEditEnabled;
        actions.setAutoEdit(newAutoEditState);
        // Don't set session flag anymore - auto-edit only affects file operations
    }, [snap.autoEditEnabled]);


    // Handle keyboard input directly here
    const isTTY = process.stdin.isTTY;
    useInput((inputChar: string, key: { [key: string]: boolean }) => {
        // Skip all input if confirmation is active
        if (snap.confirmationOptions) return;
        
        // Only handle input in insert mode (normal mode handled by EnhancedChatInput)
        if (snap.chatVimMode === 'normal') {
            // Still handle Ctrl+C in normal mode
            if (inputChar.charCodeAt(0) === 3 || (key.ctrl && inputChar === 'c')) {
                handleCtrlC();
            }
            return;
        }

        // Check for Ctrl+C (ETX character, code 3)
        if (inputChar.charCodeAt(0) === 3 || (key.ctrl && inputChar === 'c')) {
            handleCtrlC();
            return;
        }


        // Shift+Tab: Toggle auto-edit
        if (key.shift && key.tab) {
            toggleAutoEdit();
            return;
        }

        // Enter key
        if (key.return) {
            handleEnter();
            return;
        }

        // Escape key - don't call handleEscape, let EnhancedChatInput handle it
        if (key.escape) {
            return;
        }

        // Arrow keys for navigation
        if (key.upArrow) {
            handleUpArrow();
            return;
        }

        if (key.downArrow) {
            handleDownArrow();
            return;
        }

        // Left arrow - move cursor left
        if (key.leftArrow) {
            const newPos = Math.max(0, snap.cursorPosition - 1);
            actions.setCursorPosition(newPos);
            return;
        }

        // Right arrow - move cursor right
        if (key.rightArrow) {
            const newPos = Math.min(snap.inputValue.length, snap.cursorPosition + 1);
            actions.setCursorPosition(newPos);
            return;
        }

        // Cmd/Ctrl + Left - jump to start of line (or Home key)
        if ((key.ctrl && key.leftArrow) || (key.meta && key.leftArrow) || inputChar === '\x01') {
            actions.setCursorPosition(0);
            return;
        }

        // Cmd/Ctrl + Right - jump to end of line (or End key)
        if ((key.ctrl && key.rightArrow) || (key.meta && key.rightArrow) || inputChar === '\x05') {
            actions.setCursorPosition(snap.inputValue.length);
            return;
        }

        // Ctrl + Left - jump by word backward
        if (key.ctrl && inputChar === 'b') {
            const text = snap.inputValue;
            let newPos = snap.cursorPosition;
            // Skip current whitespace
            while (newPos > 0 && text[newPos - 1] === ' ') newPos--;
            // Skip word characters
            while (newPos > 0 && text[newPos - 1] !== ' ') newPos--;
            actions.setCursorPosition(newPos);
            return;
        }

        // Ctrl + Right - jump by word forward
        if (key.ctrl && inputChar === 'f') {
            const text = snap.inputValue;
            let newPos = snap.cursorPosition;
            // Skip current word characters
            while (newPos < text.length && text[newPos] !== ' ') newPos++;
            // Skip whitespace
            while (newPos < text.length && text[newPos] === ' ') newPos++;
            actions.setCursorPosition(newPos);
            return;
        }

        // Backspace/Delete - delete at cursor position
        if (key.backspace || key.delete) {
            if (snap.cursorPosition > 0) {
                const newValue = snap.inputValue.slice(0, snap.cursorPosition - 1) + 
                                snap.inputValue.slice(snap.cursorPosition);
                actions.setInputValue(newValue);
                actions.setCursorPosition(snap.cursorPosition - 1);
            }
            return;
        }

        // Regular character input - insert at cursor position
        if (!key.ctrl && !key.meta && inputChar) {
            // Check for / command at start of input
            if (inputChar === '/' && snap.inputValue === '') {
                actions.pushStage({ id: 'command-palette', type: StageType.COMMAND_PALETTE });
                return;
            }
            const newValue = snap.inputValue.slice(0, snap.cursorPosition) + 
                            inputChar + 
                            snap.inputValue.slice(snap.cursorPosition);
            actions.setInputValue(newValue);
            actions.setCursorPosition(snap.cursorPosition + 1);
        }
    }, { isActive: isTTY });

    // Command execution is now handled in CommandPaletteScreen

    return (
        <ChatLayout>
            <Box flexDirection="column" height="100%" overflow="hidden">
                <Box flexDirection="column" flexGrow={1} overflow="hidden">
                    <Box paddingX={2} flexShrink={0}>
                        {showCommandSuggestions && <CommandSuggestions/>}
                        {showModelSelection && <ModelSelection/>}
                    </Box>
                    <Box paddingX={2} flexGrow={1} overflow="hidden" height="100%">
                        <ChatHistory messageRegistry={messageRegistry} executionRegistry={executionRegistry}
                                     toolRegistry={toolRegistry}/>
                    </Box>
                </Box>
                <Box flexDirection="column" flexShrink={0}>
                    <Box paddingX={2}>
                        <LoadingAndStatus/>
                    </Box>
                    <EnhancedChatInput/>
                    <Box paddingX={2}>
                        <StatusBar/>
                    </Box>
                </Box>
            </Box>
        </ChatLayout>
    );
}