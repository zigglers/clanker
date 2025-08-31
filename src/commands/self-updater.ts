/**
 * Self-updater for Clanker CLI using GitHub releases
 * Replaces npm-based updates with direct GitHub source builds
 */

import { execSync, spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { GitHubAuth, getGitHubAuth } from '../package-manager/github-auth';

export class SelfUpdater {
  private githubAuth: GitHubAuth;
  private readonly REPO_OWNER = 'zigglers';
  private readonly REPO_NAME = 'clanker';  
  private readonly INSTALL_DIR = path.join(os.homedir(), '.clanker', 'cli');

  constructor() {
    this.githubAuth = getGitHubAuth();
  }

  /**
   * Check for updates
   */
  async checkForUpdates(): Promise<{ hasUpdate: boolean; latestVersion: string; currentVersion: string }> {
    try {
      console.log('🔍 Checking for updates...');
      
      // Get current version from package.json
      // Try multiple possible locations
      let packageJson: any;
      let currentVersion: string;
      
      const possiblePaths = [
        path.join(__dirname, '..', 'package.json'),  // From dist/commands
        path.join(__dirname, '..', '..', 'package.json'),  // From dist
        path.join(process.cwd(), 'package.json'),  // Current directory
        path.join(this.INSTALL_DIR, 'current', 'package.json'),  // Installed location
      ];
      
      for (const packagePath of possiblePaths) {
        try {
          packageJson = JSON.parse(await fs.readFile(packagePath, 'utf8'));
          currentVersion = packageJson.version;
          break;
        } catch {
          // Try next path
        }
      }
      
      if (!currentVersion) {
        // Fallback to a default version if we can't find package.json
        currentVersion = '0.0.0';
        console.log('⚠️  Could not determine current version, assuming 0.0.0');
      }
      
      // Get latest release from GitHub
      const releases = await this.githubAuth.listReleases(`https://github.com/${this.REPO_OWNER}/${this.REPO_NAME}`);
      
      if (!releases || releases.length === 0) {
        console.log('No releases found on GitHub. Checking main branch...');
        return { hasUpdate: false, latestVersion: currentVersion, currentVersion };
      }
      
      const latestRelease = releases[0];
      const latestVersion = latestRelease.tag_name?.replace(/^v/, '') || 'main';
      
      // Compare versions
      const hasUpdate = this.compareVersions(currentVersion, latestVersion) < 0;
      
      return { hasUpdate, latestVersion, currentVersion };
    } catch (error) {
      console.error('Failed to check for updates:', error);
      throw error;
    }
  }

  /**
   * Perform self-update
   */
  async selfUpdate(force: boolean = false): Promise<void> {
    try {
      const updateInfo = await this.checkForUpdates();
      
      if (!updateInfo.hasUpdate && !force) {
        console.log(`✅ You are already on the latest version (${updateInfo.currentVersion})`);
        return;
      }
      
      console.log(`📦 Updating Clanker from ${updateInfo.currentVersion} to ${updateInfo.latestVersion}...`);
      
      // Create temp directory for download
      const tempDir = path.join(os.tmpdir(), `clanker-update-${Date.now()}`);
      await fs.mkdir(tempDir, { recursive: true });
      
      try {
        // Clone the repository
        console.log('📥 Downloading latest source from GitHub...');
        await this.cloneRepository(tempDir, updateInfo.latestVersion);
        
        // Install dependencies (including dev dependencies for building)
        console.log('📦 Installing dependencies...');
        execSync('npm install', {
          cwd: path.join(tempDir, 'clanker'),
          stdio: 'inherit'
        });
        
        // Build the project
        console.log('🔨 Building Clanker...');
        execSync('npm run build', {
          cwd: path.join(tempDir, 'clanker'),
          stdio: 'inherit'
        });
        
        // Backup current installation
        const backupDir = path.join(this.INSTALL_DIR, `backup-${updateInfo.currentVersion}`);
        console.log(`📂 Backing up current installation to ${backupDir}...`);
        
        // Ensure install directory exists
        await fs.mkdir(this.INSTALL_DIR, { recursive: true });
        
        // Check if we're updating from npm or a previous GitHub install
        const globalClankerPath = this.getGlobalClankerPath();
        if (globalClankerPath && !globalClankerPath.includes('.clanker/cli')) {
          console.log('📍 Detected npm installation, migrating to GitHub-based installation...');
          
          // Create symlink to replace npm version
          await this.replaceNpmInstallation(path.join(tempDir, 'clanker'));
        } else {
          // Regular update for GitHub-based installation
          if (await this.pathExists(path.join(this.INSTALL_DIR, 'current'))) {
            await fs.rename(
              path.join(this.INSTALL_DIR, 'current'),
              backupDir
            );
          }
          
          // Move new version to install directory
          console.log('📁 Installing new version...');
          await fs.rename(
            path.join(tempDir, 'clanker'),
            path.join(this.INSTALL_DIR, 'current')
          );
        }
        
        // Create or update global command
        await this.setupGlobalCommand();
        
        console.log('✅ Clanker has been successfully updated to version ' + updateInfo.latestVersion);
        console.log('🎉 Restart your terminal or run `clanker --version` to verify the update.');
        
      } finally {
        // Clean up temp directory
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
      
    } catch (error) {
      console.error('❌ Update failed:', error);
      console.log('💡 You can try updating manually by cloning the repository and building from source.');
      throw error;
    }
  }

  /**
   * Clone repository from GitHub
   */
  private async cloneRepository(targetDir: string, version: string): Promise<void> {
    const repoUrl = `https://github.com/${this.REPO_OWNER}/${this.REPO_NAME}`;
    
    // Use GitHub CLI if available for better auth support
    if (await this.githubAuth.checkGitHubCLI()) {
      execSync(`gh repo clone ${this.REPO_OWNER}/${this.REPO_NAME} clanker -- --branch ${version === 'main' ? 'main' : `v${version}`}`, {
        cwd: targetDir,
        stdio: 'inherit'
      });
    } else {
      // Fallback to git clone
      execSync(`git clone ${repoUrl} clanker`, {
        cwd: targetDir,
        stdio: 'inherit'
      });
      
      if (version !== 'main') {
        execSync(`git checkout v${version}`, {
          cwd: path.join(targetDir, 'clanker'),
          stdio: 'inherit'
        });
      }
    }
  }

  /**
   * Get current global clanker installation path
   */
  private getGlobalClankerPath(): string | null {
    try {
      const result = execSync('which clanker', { encoding: 'utf8' }).trim();
      return result;
    } catch {
      return null;
    }
  }

  /**
   * Replace npm installation with GitHub-based installation
   */
  private async replaceNpmInstallation(newInstallPath: string): Promise<void> {
    const targetPath = path.join(this.INSTALL_DIR, 'current');
    
    // Check if target directory exists and remove it
    if (await this.pathExists(targetPath)) {
      console.log('📦 Removing existing installation...');
      await fs.rm(targetPath, { recursive: true, force: true });
    }
    
    // Move new installation to CLI directory
    await fs.rename(newInstallPath, targetPath);
    
    // Try to get npm global bin directory for cleanup
    try {
      // Use npm prefix -g instead of npm bin -g (removed in npm v9+)
      const npmPrefix = execSync('npm prefix -g', { encoding: 'utf8' }).trim();
      const npmBin = process.platform === 'win32' 
        ? npmPrefix // On Windows, binaries are in the prefix root
        : path.join(npmPrefix, 'bin'); // On Unix-like systems, binaries are in prefix/bin
      
      const clankerBinPath = path.join(npmBin, 'clanker');
      
      // Remove npm's clanker command
      try {
        await fs.unlink(clankerBinPath);
        console.log('📤 Removed npm-installed clanker command');
      } catch {
        // May not exist or may not have permissions
      }
      
      // Uninstall from npm to clean up
      try {
        console.log('🧹 Uninstalling npm package...');
        execSync('npm uninstall -g @ziggler/clanker', { stdio: 'inherit' });
      } catch {
        // Might fail but that's okay
      }
    } catch (error) {
      // If npm commands fail, just skip the cleanup
      console.log('⚠️  Could not clean up npm installation (npm may not be available)');
    }
  }

  /**
   * Setup global command
   */
  private async setupGlobalCommand(): Promise<void> {
    const binPath = path.join(this.INSTALL_DIR, 'current', 'dist', 'index.js');
    const linkPath = '/usr/local/bin/clanker';
    
    // Create executable wrapper script that properly handles ESM modules
    // This uses dynamic import() instead of require() to support ES modules with top-level await
    const scriptContent = `#!/usr/bin/env node
import('${binPath}').catch(err => {
  console.error('Failed to load Clanker:', err.message);
  process.exit(1);
});
`;
    
    const scriptPath = path.join(this.INSTALL_DIR, 'clanker');
    await fs.writeFile(scriptPath, scriptContent);
    await fs.chmod(scriptPath, 0o755);
    
    // Try to create symlink in /usr/local/bin
    try {
      // Remove existing link if present
      try {
        await fs.unlink(linkPath);
      } catch {
        // Doesn't exist, that's fine
      }
      
      // Create new symlink
      await fs.symlink(scriptPath, linkPath);
      console.log(`✅ Created global command at ${linkPath}`);
    } catch (error) {
      // Might not have permissions, provide alternative
      console.log(`⚠️  Could not create global command (permission denied).`);
      console.log(`\n📝 To complete installation, run:`);
      console.log(`   sudo ln -sf ${scriptPath} /usr/local/bin/clanker`);
      console.log(`\n   Or add this to your PATH:`);
      console.log(`   export PATH="${this.INSTALL_DIR}:$PATH"`);
    }
  }

  /**
   * Compare semantic versions
   */
  private compareVersions(current: string, latest: string): number {
    const parseVersion = (v: string) => {
      const parts = v.split('.').map(p => parseInt(p, 10) || 0);
      return {
        major: parts[0] || 0,
        minor: parts[1] || 0,
        patch: parts[2] || 0
      };
    };
    
    const c = parseVersion(current);
    const l = parseVersion(latest);
    
    if (c.major !== l.major) return c.major - l.major;
    if (c.minor !== l.minor) return c.minor - l.minor;
    return c.patch - l.patch;
  }

  /**
   * Check if path exists
   */
  private async pathExists(p: string): Promise<boolean> {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Install from source (for development)
   */
  async installFromSource(sourcePath?: string): Promise<void> {
    const repoPath = sourcePath || process.cwd();
    
    console.log(`🔨 Building Clanker from source at ${repoPath}...`);
    
    // Check if it's a valid Clanker repository
    const packageJsonPath = path.join(repoPath, 'package.json');
    if (!await this.pathExists(packageJsonPath)) {
      throw new Error('Not a valid Clanker repository (package.json not found)');
    }
    
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    if (packageJson.name !== '@ziggler/clanker') {
      throw new Error('Not a Clanker repository');
    }
    
    // Install dependencies if needed
    const nodeModulesPath = path.join(repoPath, 'node_modules');
    if (!await this.pathExists(nodeModulesPath)) {
      console.log('📦 Installing dependencies...');
      execSync('npm install', {
        cwd: repoPath,
        stdio: 'inherit'
      });
    }
    
    // Build the project
    console.log('🔨 Building project...');
    execSync('npm run build', {
      cwd: repoPath,
      stdio: 'inherit'
    });
    
    // Create installation directory
    await fs.mkdir(this.INSTALL_DIR, { recursive: true });
    
    // Backup existing installation
    if (await this.pathExists(path.join(this.INSTALL_DIR, 'current'))) {
      const backupDir = path.join(this.INSTALL_DIR, `backup-${Date.now()}`);
      await fs.rename(
        path.join(this.INSTALL_DIR, 'current'),
        backupDir
      );
      console.log(`📂 Backed up existing installation to ${backupDir}`);
    }
    
    // Copy to installation directory
    console.log('📁 Installing to ' + this.INSTALL_DIR);
    await this.copyDirectory(repoPath, path.join(this.INSTALL_DIR, 'current'));
    
    // Setup global command
    await this.setupGlobalCommand();
    
    console.log('✅ Clanker has been installed from source');
    console.log('🎉 Run `clanker --version` to verify the installation');
  }

  /**
   * Copy directory recursively
   */
  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      // Skip node_modules and .git
      if (entry.name === 'node_modules' || entry.name === '.git') {
        continue;
      }
      
      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }
}