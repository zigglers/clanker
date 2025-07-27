import {EventEmitter} from "events";
import {store} from "../store";

export interface ConfirmationOptions {
    operation: string;
    filename: string;
    content?: string; // Content to show in confirmation dialog
}

export interface ConfirmationResult {
    confirmed: boolean;
    dontAskAgain?: boolean;
    feedback?: string;
}

export class ConfirmationService extends EventEmitter {
    private static instance: ConfirmationService;
    private pendingConfirmation: Promise<ConfirmationResult> | null = null;
    private resolveConfirmation: ((result: ConfirmationResult) => void) | null =
        null;

    // Session flags for different operation types
    private sessionFlags = {
        fileOperations: false,
        bashCommands: false,
        allOperations: false,
        createFiles: false,
        editFiles: false,
    };

    static getInstance(): ConfirmationService {
        if (!ConfirmationService.instance) {
            ConfirmationService.instance = new ConfirmationService();
        }
        return ConfirmationService.instance;
    }

    constructor() {
        super();
    }

    async requestConfirmation(
        options: ConfirmationOptions,
        operationType: "file" | "bash" | "file_create" | "file_edit" = "file"
    ): Promise<ConfirmationResult> {
        // Check if dangerously bypass permission is enabled
        if (store.dangerousBypassPermission) {
            return {confirmed: true};
        }

        // Check if auto-edit is enabled for file operations only
        if (store.autoEditEnabled && (operationType === "file_edit" || operationType === "file_create")) {
            return {confirmed: true};
        }

        // Check session flags
        if (
            this.sessionFlags.allOperations ||
            (operationType === "file" && this.sessionFlags.fileOperations) ||
            (operationType === "bash" && this.sessionFlags.bashCommands) ||
            (operationType === "file_create" && this.sessionFlags.createFiles) ||
            (operationType === "file_edit" && this.sessionFlags.editFiles)
        ) {
            return {confirmed: true};
        }


        // Create a promise that will be resolved by the UI component
        this.pendingConfirmation = new Promise<ConfirmationResult>((resolve) => {
            this.resolveConfirmation = resolve;
        });

        // Emit custom event that the UI can listen to (using setImmediate to ensure the UI updates)
        setImmediate(() => {
            this.emit("confirmation-requested", options);
        });

        const result = await this.pendingConfirmation;

        if (result.dontAskAgain) {
            // Set the appropriate session flag based on operation type
            if (operationType === "file") {
                this.sessionFlags.fileOperations = true;
            } else if (operationType === "bash") {
                this.sessionFlags.bashCommands = true;
            } else if (operationType === "file_create") {
                this.sessionFlags.createFiles = true;
            } else if (operationType === "file_edit") {
                this.sessionFlags.editFiles = true;
            }
            // Could also set allOperations for global skip
        }

        return result;
    }

    confirmOperation(confirmed: boolean, dontAskAgain?: boolean): void {
        if (this.resolveConfirmation) {
            this.resolveConfirmation({confirmed, dontAskAgain});
            this.resolveConfirmation = null;
            this.pendingConfirmation = null;
        }
    }

    rejectOperation(feedback?: string): void {
        if (this.resolveConfirmation) {
            this.resolveConfirmation({confirmed: false, feedback});
            this.resolveConfirmation = null;
            this.pendingConfirmation = null;
        }
    }


    isPending(): boolean {
        return this.pendingConfirmation !== null;
    }

    resetSession(): void {
        this.sessionFlags = {
            fileOperations: false,
            bashCommands: false,
            allOperations: false,
            createFiles: false,
            editFiles: false,
        };
    }

    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    getSessionFlags() {
        return {...this.sessionFlags};
    }

    setSessionFlag(
        flagType: "fileOperations" | "bashCommands" | "allOperations",
        value: boolean
    ): void {
        this.sessionFlags[flagType] = value;
    }

    setAlwaysYes(b: boolean) {
        this.sessionFlags.allOperations = b;
        this.sessionFlags.fileOperations = b;
        this.sessionFlags.bashCommands = b;
        this.sessionFlags.createFiles = b;
        this.sessionFlags.editFiles = b;
    }
}

export const useConfirmationService = () => {
    const server = ConfirmationService.getInstance();
    return {
        requestConfirmation: server.requestConfirmation.bind(server),
        confirmOperation: server.confirmOperation.bind(server),
        rejectOperation: server.rejectOperation.bind(server),
        isPending: server.isPending.bind(server),
        resetSession: server.resetSession.bind(server),
        sessionFlags: server.getSessionFlags.bind(server),
        setSessionFlag: server.setSessionFlag.bind(server)
    };
}
