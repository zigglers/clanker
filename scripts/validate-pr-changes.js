#!/usr/bin/env node

/**
 * Validates that a PR contains actual implementation changes, not just metadata updates
 * This prevents the automation from creating empty PRs with only version bumps
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Files that are considered metadata-only (not implementation)
const METADATA_FILES = [
    'package.json',
    'package-lock.json',
    'CHANGELOG.md',
    'VERSION',
    'README.md',
    '.github/workflows/*'
];

// Minimum number of source files that must be changed for a feature/fix
const MIN_SOURCE_FILES = 1;

// Source file patterns
const SOURCE_PATTERNS = [
    'src/**/*.ts',
    'src/**/*.tsx',
    'src/**/*.js',
    'src/**/*.jsx'
];

function getChangedFiles() {
    try {
        // Get list of changed files compared to main branch
        const output = execSync('git diff --name-only origin/main...HEAD', { encoding: 'utf8' });
        return output.trim().split('\n').filter(f => f);
    } catch (error) {
        console.error('Failed to get changed files:', error.message);
        return [];
    }
}

function isMetadataFile(filePath) {
    return METADATA_FILES.some(pattern => {
        if (pattern.includes('*')) {
            const regex = new RegExp(pattern.replace('*', '.*'));
            return regex.test(filePath);
        }
        return filePath === pattern;
    });
}

function isSourceFile(filePath) {
    return SOURCE_PATTERNS.some(pattern => {
        const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
        return regex.test(filePath);
    });
}

function validateChanges(submissionType) {
    const changedFiles = getChangedFiles();
    
    if (changedFiles.length === 0) {
        return {
            valid: false,
            message: 'No files changed in this PR'
        };
    }

    console.log(`Found ${changedFiles.length} changed files:`, changedFiles);

    // Separate metadata and source files
    const metadataFiles = changedFiles.filter(isMetadataFile);
    const sourceFiles = changedFiles.filter(isSourceFile);
    const otherFiles = changedFiles.filter(f => !isMetadataFile(f) && !isSourceFile(f));

    console.log(`Metadata files: ${metadataFiles.length}`, metadataFiles);
    console.log(`Source files: ${sourceFiles.length}`, sourceFiles);
    console.log(`Other files: ${otherFiles.length}`, otherFiles);

    // For features and fixes, require actual source code changes
    if (submissionType === 'feature' || submissionType === 'fix') {
        if (sourceFiles.length < MIN_SOURCE_FILES) {
            return {
                valid: false,
                message: `${submissionType} submissions must include at least ${MIN_SOURCE_FILES} source file change(s). Found ${sourceFiles.length}.`,
                details: {
                    metadataFiles,
                    sourceFiles,
                    otherFiles
                }
            };
        }
    }

    // For chores, allow metadata-only changes
    if (submissionType === 'chore') {
        // Chores can be metadata-only (like version bumps, dependency updates)
        if (changedFiles.length === metadataFiles.length) {
            console.log('Chore submission with metadata-only changes - allowed');
        }
    }

    // Check if changes are substantive (not just version bumps)
    if (sourceFiles.length === 0 && submissionType !== 'chore') {
        return {
            valid: false,
            message: `This ${submissionType} PR only contains metadata changes. Actual implementation is required.`,
            details: {
                metadataFiles,
                sourceFiles,
                otherFiles
            }
        };
    }

    return {
        valid: true,
        message: `Valid ${submissionType} PR with ${sourceFiles.length} source file(s) changed`,
        details: {
            metadataFiles,
            sourceFiles,
            otherFiles
        }
    };
}

// Main execution
if (require.main === module) {
    const submissionType = process.argv[2] || 'feature';
    
    console.log(`Validating PR changes for submission type: ${submissionType}`);
    
    const result = validateChanges(submissionType);
    
    if (!result.valid) {
        console.error(`❌ Validation failed: ${result.message}`);
        if (result.details) {
            console.error('Details:', JSON.stringify(result.details, null, 2));
        }
        process.exit(1);
    }
    
    console.log(`✅ ${result.message}`);
    if (result.details) {
        console.log('Details:', JSON.stringify(result.details, null, 2));
    }
    process.exit(0);
}

module.exports = { validateChanges, getChangedFiles, isMetadataFile, isSourceFile };