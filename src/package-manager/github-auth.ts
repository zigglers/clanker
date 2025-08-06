/**
 * GitHub CLI authentication helper for private repositories
 */

import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import { debug } from '../utils/debug-logger';

const execAsync = promisify(exec);

export interface GitHubAuthConfig {
  useGitHubCLI: boolean;
  token?: string;
}

export class GitHubAuth {
  private config: GitHubAuthConfig;
  private cachedToken?: string;
  private isAuthenticated: boolean = false;

  constructor(config: GitHubAuthConfig = { useGitHubCLI: true }) {
    this.config = config;
  }

  /**
   * Check if GitHub CLI is installed and authenticated
   */
  async checkGitHubCLI(): Promise<boolean> {
    try {
      // Check if gh is installed
      execSync('which gh', { stdio: 'ignore' });
      
      // Check if gh is authenticated
      const result = execSync('gh auth status', { encoding: 'utf8', stdio: 'pipe' });
      
      // Check if logged in to github.com
      if (result.includes('Logged in to github.com')) {
        debug.log('[GitHubAuth] GitHub CLI is authenticated');
        this.isAuthenticated = true;
        return true;
      }
      
      return false;
    } catch (error) {
      debug.log('[GitHubAuth] GitHub CLI not available or not authenticated');
      return false;
    }
  }

  /**
   * Get GitHub token using GitHub CLI
   */
  async getToken(): Promise<string | undefined> {
    if (this.cachedToken) {
      return this.cachedToken;
    }

    if (!this.config.useGitHubCLI) {
      return this.config.token;
    }

    try {
      // Try to get token from gh CLI
      const { stdout } = await execAsync('gh auth token', { encoding: 'utf8' });
      const token = stdout.trim();
      
      if (token) {
        debug.log('[GitHubAuth] Successfully retrieved GitHub token from CLI');
        this.cachedToken = token;
        return token;
      }
    } catch (error) {
      debug.log('[GitHubAuth] Failed to get token from GitHub CLI:', error);
    }

    // Fallback to environment variable
    const envToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    if (envToken) {
      debug.log('[GitHubAuth] Using token from environment variable');
      this.cachedToken = envToken;
      return envToken;
    }

    return undefined;
  }

  /**
   * Fetch content from a GitHub repository (public or private)
   */
  async fetchRepoContent(repoUrl: string, path: string): Promise<string> {
    // Parse repository URL
    const match = repoUrl.match(/github\.com[/:]([^/]+)\/([^/\s.]+)/);
    if (!match) {
      throw new Error('Invalid GitHub repository URL');
    }

    const [, owner, repo] = match;
    const repoName = repo.replace(/\.git$/, '');

    // Try GitHub CLI first for private repos
    if (await this.checkGitHubCLI()) {
      try {
        debug.log(`[GitHubAuth] Fetching ${owner}/${repoName}/${path} using GitHub CLI`);
        
        // Use gh api to fetch raw content
        const apiPath = `/repos/${owner}/${repoName}/contents/${path}`;
        const { stdout } = await execAsync(`gh api ${apiPath} --jq .content`, { 
          encoding: 'utf8',
          maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        });
        
        // Content is base64 encoded
        const content = Buffer.from(stdout.trim(), 'base64').toString('utf8');
        return content;
      } catch (error) {
        debug.log(`[GitHubAuth] GitHub CLI fetch failed, trying raw URL:`, error);
        // Fall through to try direct URL access
      }
    }

    // Try direct raw URL (works for public repos and with token)
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repoName}/main/${path}`;
    const token = await this.getToken();
    
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `token ${token}`;
    }

    const response = await fetch(rawUrl, { headers });
    
    if (!response.ok) {
      // Try with 'master' branch as fallback
      const masterUrl = `https://raw.githubusercontent.com/${owner}/${repoName}/master/${path}`;
      const masterResponse = await fetch(masterUrl, { headers });
      
      if (!masterResponse.ok) {
        throw new Error(`Failed to fetch ${path} from ${owner}/${repoName}: ${response.statusText}`);
      }
      
      return masterResponse.text();
    }

    return response.text();
  }

  /**
   * Download a tool bundle from GitHub releases or repository
   */
  async downloadFromGitHub(repoUrl: string, toolPath: string): Promise<Buffer> {
    // Parse repository URL
    const match = repoUrl.match(/github\.com[/:]([^/]+)\/([^/\s.]+)/);
    if (!match) {
      throw new Error('Invalid GitHub repository URL');
    }

    const [, owner, repo] = match;
    const repoName = repo.replace(/\.git$/, '');

    // Try GitHub CLI for private repos
    if (await this.checkGitHubCLI()) {
      try {
        debug.log(`[GitHubAuth] Downloading ${toolPath} from ${owner}/${repoName} using GitHub CLI`);
        
        // Use gh api to get the file content
        const apiPath = `/repos/${owner}/${repoName}/contents/${toolPath}`;
        const { stdout } = await execAsync(`gh api ${apiPath} --jq .content`, {
          encoding: 'utf8',
          maxBuffer: 50 * 1024 * 1024 // 50MB buffer for larger files
        });
        
        // Content is base64 encoded
        const buffer = Buffer.from(stdout.trim(), 'base64');
        return buffer;
      } catch (error) {
        debug.log(`[GitHubAuth] GitHub CLI download failed:`, error);
        // Fall through to direct download
      }
    }

    // Try direct download with token
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repoName}/main/${toolPath}`;
    const token = await this.getToken();
    
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `token ${token}`;
    }

    const response = await fetch(rawUrl, { headers });
    
    if (!response.ok) {
      // Try master branch
      const masterUrl = `https://raw.githubusercontent.com/${owner}/${repoName}/master/${toolPath}`;
      const masterResponse = await fetch(masterUrl, { headers });
      
      if (!masterResponse.ok) {
        throw new Error(`Failed to download ${toolPath} from ${owner}/${repoName}: ${response.statusText}`);
      }
      
      const arrayBuffer = await masterResponse.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Clone a repository using GitHub CLI (supports private repos)
   */
  async cloneRepository(repoUrl: string, destination: string): Promise<void> {
    if (await this.checkGitHubCLI()) {
      try {
        debug.log(`[GitHubAuth] Cloning ${repoUrl} using GitHub CLI`);
        await execAsync(`gh repo clone ${repoUrl} ${destination}`, {
          encoding: 'utf8'
        });
        return;
      } catch (error) {
        debug.log(`[GitHubAuth] GitHub CLI clone failed:`, error);
      }
    }

    // Fallback to git clone with token
    const token = await this.getToken();
    if (token) {
      const authUrl = repoUrl.replace('https://', `https://${token}@`);
      await execAsync(`git clone ${authUrl} ${destination}`, {
        encoding: 'utf8'
      });
    } else {
      // Try regular clone (works for public repos)
      await execAsync(`git clone ${repoUrl} ${destination}`, {
        encoding: 'utf8'
      });
    }
  }

  /**
   * List releases from a GitHub repository
   */
  async listReleases(repoUrl: string): Promise<any[]> {
    const match = repoUrl.match(/github\.com[/:]([^/]+)\/([^/\s.]+)/);
    if (!match) {
      throw new Error('Invalid GitHub repository URL');
    }

    const [, owner, repo] = match;
    const repoName = repo.replace(/\.git$/, '');

    if (await this.checkGitHubCLI()) {
      try {
        debug.log(`[GitHubAuth] Listing releases for ${owner}/${repoName} using GitHub CLI`);
        const { stdout } = await execAsync(
          `gh api /repos/${owner}/${repoName}/releases --jq '.[] | {tag_name, name, published_at}'`,
          { encoding: 'utf8' }
        );
        
        // Parse the JSON lines output
        const releases = stdout.trim().split('\n').map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        }).filter(Boolean);
        
        return releases;
      } catch (error) {
        debug.log(`[GitHubAuth] GitHub CLI releases list failed:`, error);
      }
    }

    // Fallback to API with token
    const token = await this.getToken();
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json'
    };
    
    if (token) {
      headers['Authorization'] = `token ${token}`;
    }

    const response = await fetch(`https://api.github.com/repos/${owner}/${repoName}/releases`, {
      headers
    });

    if (!response.ok) {
      throw new Error(`Failed to list releases: ${response.statusText}`);
    }

    return response.json();
  }
}

// Singleton instance
let githubAuth: GitHubAuth | undefined;

export function getGitHubAuth(config?: GitHubAuthConfig): GitHubAuth {
  if (!githubAuth) {
    githubAuth = new GitHubAuth(config);
  }
  return githubAuth;
}