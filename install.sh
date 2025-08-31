#!/bin/bash

# Clanker Installation Script
# One-liner installation from GitHub releases
# Usage: curl -fsSL https://raw.githubusercontent.com/zigglers/clanker/main/install.sh | bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
REPO_OWNER="zigglers"
REPO_NAME="clanker"
INSTALL_DIR="$HOME/.clanker/cli"
BIN_LINK="/usr/local/bin/clanker"
MIN_NODE_VERSION="16"
MIN_GIT_VERSION="2"

# Print colored output
print_color() {
    echo -e "${1}${2}${NC}"
}

print_error() {
    print_color "$RED" "❌ $1" >&2
}

print_success() {
    print_color "$GREEN" "✅ $1"
}

print_info() {
    print_color "$CYAN" "ℹ️  $1"
}

print_warning() {
    print_color "$YELLOW" "⚠️  $1"
}

# Header
print_header() {
    echo
    print_color "$CYAN" "╔══════════════════════════════════════════════════════════╗"
    print_color "$CYAN" "║                                                          ║"
    print_color "$CYAN" "║             Clanker Installation Script                  ║"
    print_color "$CYAN" "║                                                          ║"
    print_color "$CYAN" "╚══════════════════════════════════════════════════════════╝"
    echo
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Compare versions
version_ge() {
    # Returns 0 if version $1 >= version $2
    [ "$(printf '%s\n' "$2" "$1" | sort -V | head -n1)" = "$2" ]
}

# Get OS type
get_os() {
    case "$(uname -s)" in
        Darwin*)    echo "macos";;
        Linux*)     echo "linux";;
        CYGWIN*)    echo "windows";;
        MINGW*)     echo "windows";;
        *)          echo "unknown";;
    esac
}

# Install Node.js if missing
install_nodejs() {
    local os=$(get_os)
    
    print_info "Node.js not found. Installing Node.js..."
    
    if [ "$os" = "macos" ]; then
        if command_exists brew; then
            print_info "Installing Node.js via Homebrew..."
            brew install node
        else
            print_error "Homebrew not found. Please install Node.js manually from https://nodejs.org"
            exit 1
        fi
    elif [ "$os" = "linux" ]; then
        # Try to detect package manager
        if command_exists apt-get; then
            print_info "Installing Node.js via apt..."
            curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
            sudo apt-get install -y nodejs
        elif command_exists yum; then
            print_info "Installing Node.js via yum..."
            curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
            sudo yum install -y nodejs
        elif command_exists dnf; then
            print_info "Installing Node.js via dnf..."
            curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
            sudo dnf install -y nodejs
        else
            print_error "Could not detect package manager. Please install Node.js manually from https://nodejs.org"
            exit 1
        fi
    else
        print_error "Unsupported OS. Please install Node.js manually from https://nodejs.org"
        exit 1
    fi
}

# Install Git if missing
install_git() {
    local os=$(get_os)
    
    print_info "Git not found. Installing Git..."
    
    if [ "$os" = "macos" ]; then
        if command_exists brew; then
            print_info "Installing Git via Homebrew..."
            brew install git
        else
            print_error "Homebrew not found. Please install Git manually from https://git-scm.com"
            exit 1
        fi
    elif [ "$os" = "linux" ]; then
        if command_exists apt-get; then
            print_info "Installing Git via apt..."
            sudo apt-get update && sudo apt-get install -y git
        elif command_exists yum; then
            print_info "Installing Git via yum..."
            sudo yum install -y git
        elif command_exists dnf; then
            print_info "Installing Git via dnf..."
            sudo dnf install -y git
        else
            print_error "Could not detect package manager. Please install Git manually from https://git-scm.com"
            exit 1
        fi
    else
        print_error "Unsupported OS. Please install Git manually from https://git-scm.com"
        exit 1
    fi
}

# Check dependencies
check_dependencies() {
    print_info "Checking dependencies..."
    
    # Check Node.js
    if ! command_exists node; then
        install_nodejs
    else
        local node_version=$(node -v | cut -d'v' -f2)
        if ! version_ge "$node_version" "$MIN_NODE_VERSION"; then
            print_warning "Node.js version $node_version is below minimum required version $MIN_NODE_VERSION"
            print_info "Attempting to update Node.js..."
            install_nodejs
        else
            print_success "Node.js $node_version found"
        fi
    fi
    
    # Check npm
    if ! command_exists npm; then
        print_error "npm not found. Please reinstall Node.js"
        exit 1
    else
        print_success "npm $(npm -v) found"
    fi
    
    # Check Git
    if ! command_exists git; then
        install_git
    else
        print_success "Git $(git --version | cut -d' ' -f3) found"
    fi
}

# Get latest release version
get_latest_version() {
    local api_url="https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases/latest"
    
    if command_exists curl; then
        curl -s "$api_url" | grep '"tag_name":' | sed -E 's/.*"v?([^"]+)".*/\1/'
    elif command_exists wget; then
        wget -qO- "$api_url" | grep '"tag_name":' | sed -E 's/.*"v?([^"]+)".*/\1/'
    else
        print_error "Neither curl nor wget found. Cannot fetch latest version."
        exit 1
    fi
}

# Download and install Clanker
install_clanker() {
    local version="$1"
    local temp_dir=$(mktemp -d)
    
    print_info "Installing Clanker version $version..."
    
    # Clone repository
    print_info "Downloading Clanker from GitHub..."
    cd "$temp_dir"
    
    if [ -n "$version" ] && [ "$version" != "main" ]; then
        git clone --branch "v$version" --depth 1 "https://github.com/$REPO_OWNER/$REPO_NAME.git" clanker
    else
        git clone --branch main --depth 1 "https://github.com/$REPO_OWNER/$REPO_NAME.git" clanker
    fi
    
    cd clanker
    
    # Install dependencies
    print_info "Installing dependencies..."
    npm install
    
    # Build the project
    print_info "Building Clanker..."
    npm run build
    
    # Create installation directory
    print_info "Installing to $INSTALL_DIR..."
    mkdir -p "$INSTALL_DIR"
    
    # Backup existing installation if present
    if [ -d "$INSTALL_DIR/current" ]; then
        local backup_dir="$INSTALL_DIR/backup-$(date +%Y%m%d-%H%M%S)"
        print_warning "Existing installation found. Backing up to $backup_dir"
        mv "$INSTALL_DIR/current" "$backup_dir"
    fi
    
    # Move to installation directory
    mv "$temp_dir/clanker" "$INSTALL_DIR/current"
    
    # Create wrapper script
    print_info "Creating wrapper script..."
    cat > "$INSTALL_DIR/clanker" << 'EOF'
#!/usr/bin/env node
import('${INSTALL_DIR}/current/dist/index.js').catch(err => {
  console.error('Failed to load Clanker:', err.message);
  process.exit(1);
});
EOF
    
    # Replace placeholder with actual path
    sed -i.bak "s|\${INSTALL_DIR}|$INSTALL_DIR|g" "$INSTALL_DIR/clanker" && rm "$INSTALL_DIR/clanker.bak"
    chmod +x "$INSTALL_DIR/clanker"
    
    # Clean up temp directory
    rm -rf "$temp_dir"
}

# Create global command
create_global_command() {
    print_info "Setting up global command..."
    
    # Try to create symlink in /usr/local/bin
    if [ -w "/usr/local/bin" ] || [ -w "/usr/local" ]; then
        # Remove existing link if present
        [ -L "$BIN_LINK" ] && rm "$BIN_LINK"
        
        # Create new symlink
        ln -sf "$INSTALL_DIR/clanker" "$BIN_LINK"
        print_success "Created global command at $BIN_LINK"
    else
        print_warning "Cannot create global command (permission denied)"
        echo
        print_info "To complete installation, run:"
        echo "  sudo ln -sf $INSTALL_DIR/clanker /usr/local/bin/clanker"
        echo
        print_info "Or add this to your PATH:"
        echo "  export PATH=\"$INSTALL_DIR:\$PATH\""
        echo
    fi
}

# Verify installation
verify_installation() {
    print_info "Verifying installation..."
    
    if [ -x "$INSTALL_DIR/clanker" ]; then
        print_success "Clanker installed successfully!"
        
        # Try to get version
        if [ -L "$BIN_LINK" ] || [ -f "$BIN_LINK" ]; then
            local installed_version=$("$BIN_LINK" --version 2>/dev/null || echo "unknown")
            print_success "Version: $installed_version"
        fi
        
        return 0
    else
        print_error "Installation verification failed"
        return 1
    fi
}

# Show next steps
show_next_steps() {
    echo
    print_color "$GREEN" "🎉 Clanker installation complete!"
    echo
    print_info "Next steps:"
    echo "  1. Run 'clanker setup' to configure your API key"
    echo "  2. Run 'clanker' to start using the CLI"
    echo "  3. Run 'clanker --help' to see available commands"
    echo
    print_info "For updates, run:"
    echo "  clanker upgrade"
    echo
}

# Main installation flow
main() {
    print_header
    
    # Parse arguments
    local version=""
    while [ $# -gt 0 ]; do
        case "$1" in
            --version|-v)
                version="$2"
                shift 2
                ;;
            --help|-h)
                echo "Usage: $0 [--version VERSION]"
                echo "  --version VERSION  Install specific version (default: latest)"
                echo "  --help            Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Check OS
    local os=$(get_os)
    if [ "$os" = "unknown" ]; then
        print_error "Unsupported operating system"
        exit 1
    fi
    print_info "Detected OS: $os"
    
    # Check and install dependencies
    check_dependencies
    
    # Get version to install
    if [ -z "$version" ]; then
        print_info "Fetching latest version..."
        version=$(get_latest_version)
        if [ -z "$version" ]; then
            print_warning "Could not fetch latest version, using main branch"
            version="main"
        else
            print_info "Latest version: $version"
        fi
    fi
    
    # Install Clanker
    install_clanker "$version"
    
    # Create global command
    create_global_command
    
    # Verify installation
    if verify_installation; then
        show_next_steps
    else
        print_error "Installation failed. Please check the errors above."
        exit 1
    fi
}

# Run main function
main "$@"