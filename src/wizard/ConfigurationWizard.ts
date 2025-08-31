/**
 * Interactive Configuration Wizard for first-time Clanker setup
 * Guides users through API key configuration, provider selection, and tool installation
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {prompt} from 'enquirer';
import chalk from 'chalk';
import {SettingsManager, Settings, ProviderModels} from '../utils/settings-manager';
import {execSync} from 'child_process';

export class ConfigurationWizard {
    private settingsManager: SettingsManager;
    private settings: Partial<Settings> = {};

    constructor() {
        this.settingsManager = SettingsManager.getInstance();
    }

    /**
     * Check if this is the first run (no config file exists)
     */
    isFirstRun(): boolean {
        return !this.settingsManager.hasSettings();
    }

    /**
     * Run the configuration wizard
     */
    async run(skipCheck = false): Promise<void> {
        if (!skipCheck && !this.isFirstRun()) {
            const {runAnyway} = await prompt<{runAnyway: boolean}>({
                type: 'confirm',
                name: 'runAnyway',
                message: 'Configuration already exists. Run setup wizard anyway?',
                initial: false
            });

            if (!runAnyway) {
                console.log(chalk.gray('Setup wizard cancelled.'));
                return;
            }
        }

        console.clear();
        this.showWelcome();

        try {
            // Step 1: Provider selection
            await this.selectProvider();

            // Step 2: API key configuration
            await this.configureApiKey();

            // Step 3: Model selection
            await this.selectModel();

            // Step 4: Additional settings
            await this.configureAdditionalSettings();

            // Step 5: Tool recommendations
            await this.recommendTools();

            // Step 6: Save configuration
            await this.saveConfiguration();

            // Show completion message
            this.showCompletion();

        } catch (error) {
            if (error instanceof Error && error.message === 'cancelled') {
                console.log(chalk.yellow('\n⚠️  Setup wizard cancelled.'));
            } else {
                console.error(chalk.red('\n❌ Setup failed:'), error);
            }
            process.exit(1);
        }
    }

    private showWelcome(): void {
        console.log(chalk.cyan.bold(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║             Welcome to Clanker Setup Wizard             ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
`));
        console.log(chalk.gray('This wizard will help you configure Clanker for first use.\n'));
    }

    private async selectProvider(): Promise<void> {
        console.log(chalk.cyan.bold('\n📡 Step 1: Select AI Provider\n'));

        const providers = [
            {name: 'Grok (Recommended)', value: 'grok'},
            {name: 'OpenAI', value: 'openai'},
            {name: 'Custom Provider', value: 'custom'}
        ];

        const {provider} = await prompt<{provider: string}>({
            type: 'select',
            name: 'provider',
            message: 'Which AI provider would you like to use?',
            choices: providers
        });

        this.settings.provider = provider as any;

        if (provider === 'custom') {
            const {baseURL} = await prompt<{baseURL: string}>({
                type: 'input',
                name: 'baseURL',
                message: 'Enter the base URL for your custom provider:',
                validate: (value) => {
                    try {
                        new URL(value);
                        return true;
                    } catch {
                        return 'Please enter a valid URL';
                    }
                }
            });
            this.settings.customBaseURL = baseURL;
        }
    }

    private async configureApiKey(): Promise<void> {
        console.log(chalk.cyan.bold('\n🔑 Step 2: API Key Configuration\n'));

        const provider = this.settings.provider || 'grok';
        
        // Show provider-specific instructions
        this.showApiKeyInstructions(provider);

        const {apiKey} = await prompt<{apiKey: string}>({
            type: 'password',
            name: 'apiKey',
            message: `Enter your ${provider === 'custom' ? 'provider' : provider.toUpperCase()} API key:`,
            validate: async (value) => {
                if (!value || value.length < 10) {
                    return 'API key seems too short. Please enter a valid key.';
                }

                // Try to validate the API key
                const isValid = await this.validateApiKey(value, provider);
                if (!isValid) {
                    return 'API key validation failed. Please check your key and try again.';
                }

                return true;
            }
        });

        this.settings.apiKey = apiKey;
        console.log(chalk.green('✅ API key validated successfully!'));
    }

    private showApiKeyInstructions(provider: string): void {
        switch (provider) {
            case 'grok':
                console.log(chalk.gray(`To get a Grok API key:
1. Visit ${chalk.blue('https://x.ai')}
2. Sign in or create an account
3. Navigate to API settings
4. Generate a new API key
`));
                break;
            case 'openai':
                console.log(chalk.gray(`To get an OpenAI API key:
1. Visit ${chalk.blue('https://platform.openai.com')}
2. Sign in or create an account
3. Go to API Keys section
4. Create a new secret key
`));
                break;
            case 'custom':
                console.log(chalk.gray('Please enter the API key for your custom provider.\n'));
                break;
        }
    }

    private async validateApiKey(apiKey: string, provider: string): Promise<boolean> {
        try {
            // Simple validation - just check format for now
            // In a real implementation, we'd make a test API call
            return apiKey.length > 10;
        } catch {
            return false;
        }
    }

    private async selectModel(): Promise<void> {
        console.log(chalk.cyan.bold('\n🤖 Step 3: Model Selection\n'));

        const provider = this.settings.provider || 'grok';
        let models: Array<{value: string, label: string}> = [];

        if (provider === 'grok') {
            models = ProviderModels.grok.models;
        } else if (provider === 'openai') {
            models = ProviderModels.openai.models;
        } else {
            // For custom provider, ask for model name
            const {model} = await prompt<{model: string}>({
                type: 'input',
                name: 'model',
                message: 'Enter the model name for your custom provider:',
                initial: 'default-model'
            });
            this.settings.model = model;
            return;
        }

        const {model} = await prompt<{model: string}>({
            type: 'select',
            name: 'model',
            message: 'Which model would you like to use as default?',
            choices: models.map(m => ({name: m.label, value: m.value})),
            initial: models[0].value
        });

        this.settings.model = model;
    }

    private async configureAdditionalSettings(): Promise<void> {
        console.log(chalk.cyan.bold('\n⚙️  Step 4: Additional Settings\n'));

        const {autoEdit} = await prompt<{autoEdit: boolean}>({
            type: 'confirm',
            name: 'autoEdit',
            message: 'Enable auto-edit mode? (automatically apply file changes without confirmation)',
            initial: false
        });

        const {vsCode} = await prompt<{vsCode: boolean}>({
            type: 'confirm',
            name: 'vsCode',
            message: 'Enable VS Code integration? (open files in VS Code when editing)',
            initial: false
        });

        this.settings.autoEditEnabled = autoEdit;
        this.settings.vsCodeOpenEnabled = vsCode;
        this.settings.virtualScrollingEnabled = true;
        this.settings.confirmationSettings = {
            alwaysEdit: false,
            alwaysBash: false,
            alwaysSearch: false
        };
    }

    private async recommendTools(): Promise<void> {
        console.log(chalk.cyan.bold('\n🛠️  Step 5: Recommended Tools\n'));

        const {installTools} = await prompt<{installTools: boolean}>({
            type: 'confirm',
            name: 'installTools',
            message: 'Would you like to install recommended tools?',
            initial: true
        });

        if (!installTools) {
            console.log(chalk.gray('You can install tools later using: clanker -I <tool-name>'));
            return;
        }

        const essentialTools = [
            {name: 'bash - Execute shell commands', value: 'ziggle-dev/bash'},
            {name: 'view-file - View file contents', value: 'ziggle-dev/view-file'},
            {name: 'write-to-file - Create and edit files', value: 'ziggle-dev/write-to-file'},
            {name: 'multi-edit - Edit multiple files', value: 'ziggle-dev/multi-edit'},
            {name: 'search - Search in files', value: 'ziggle-dev/search'}
        ];

        const {selectedTools} = await prompt<{selectedTools: string[]}>({
            type: 'multiselect',
            name: 'selectedTools',
            message: 'Select tools to install:',
            choices: essentialTools,
            initial: essentialTools.map(t => t.value)
        });

        if (selectedTools.length > 0) {
            console.log(chalk.gray('\nInstalling selected tools...'));
            
            for (const tool of selectedTools) {
                try {
                    console.log(chalk.gray(`Installing ${tool}...`));
                    execSync(`clanker -I ${tool}`, {stdio: 'inherit'});
                    console.log(chalk.green(`✅ ${tool} installed`));
                } catch (error) {
                    console.log(chalk.yellow(`⚠️  Failed to install ${tool}. You can try again later.`));
                }
            }
        }
    }

    private async saveConfiguration(): Promise<void> {
        console.log(chalk.cyan.bold('\n💾 Saving Configuration...\n'));

        try {
            // Ensure all required fields are set
            const finalSettings: Settings = {
                apiKey: this.settings.apiKey || '',
                provider: this.settings.provider || 'grok',
                model: this.settings.model || ProviderModels.grok.defaultModel,
                theme: 'auto',
                autoEditEnabled: this.settings.autoEditEnabled || false,
                vsCodeOpenEnabled: this.settings.vsCodeOpenEnabled || false,
                dangerousBypassPermission: false,
                virtualScrollingEnabled: true,
                confirmationSettings: this.settings.confirmationSettings || {
                    alwaysEdit: false,
                    alwaysBash: false,
                    alwaysSearch: false
                },
                cacheTimeoutMinutes: 5,
                version: 1,
                customBaseURL: this.settings.customBaseURL
            };

            this.settingsManager.saveSettings(finalSettings);
            console.log(chalk.green('✅ Configuration saved successfully!'));
        } catch (error) {
            throw new Error(`Failed to save configuration: ${error}`);
        }
    }

    private showCompletion(): void {
        console.log(chalk.green.bold(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║           🎉 Clanker Setup Complete! 🎉                 ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
`));

        console.log(chalk.white(`You're all set! Here are some commands to get started:

${chalk.cyan('clanker')}              - Start interactive chat
${chalk.cyan('clanker -p "prompt"')} - Run a single prompt
${chalk.cyan('clanker -L')}          - List installed tools
${chalk.cyan('clanker -I <tool>')}   - Install a new tool
${chalk.cyan('clanker --help')}      - Show all commands

${chalk.gray('Tip: You can always run')} ${chalk.cyan('clanker-setup')} ${chalk.gray('to reconfigure.')}
`));
    }

    /**
     * Skip wizard for experienced users
     */
    async quickSetup(apiKey: string, provider = 'grok', model?: string): Promise<void> {
        console.log(chalk.gray('Running quick setup...'));

        const settings: Settings = {
            apiKey,
            provider: provider as any,
            model: model || ProviderModels[provider as keyof typeof ProviderModels]?.defaultModel || 'default',
            theme: 'auto',
            autoEditEnabled: false,
            vsCodeOpenEnabled: false,
            dangerousBypassPermission: false,
            virtualScrollingEnabled: true,
            confirmationSettings: {
                alwaysEdit: false,
                alwaysBash: false,
                alwaysSearch: false
            },
            cacheTimeoutMinutes: 5,
            version: 1
        };

        this.settingsManager.saveSettings(settings);
        console.log(chalk.green('✅ Quick setup complete!'));
    }
}

// Export for use in main entry point
export default ConfigurationWizard;