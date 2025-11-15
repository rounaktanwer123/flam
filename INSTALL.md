# Installation Guide

Complete installation instructions for queuectl.

## System Requirements

- **Node.js**: Version 16.0.0 or higher
- **npm**: Comes with Node.js
- **Operating System**: Windows, macOS, or Linux

## Check Node.js Version

```bash
node --version
```

If you don't have Node.js or need to upgrade, download from: https://nodejs.org/

## Installation Steps

### Step 1: Navigate to Project Directory

```bash
cd queuectl
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install:
- `commander` (v11.1.0) - CLI framework
- `better-sqlite3` (v9.2.2) - SQLite database

### Step 3: Verify Installation

Test that the CLI is working:

```bash
node src/app.js --version
node src/app.js --help
```

You should see the version number and help text.

### Step 4 (Optional): Global Installation

To use `queuectl` command from anywhere:

```bash
npm link
```

Now you can run:

```bash
queuectl --help
```

**Note:** On Windows, you may need to run PowerShell or Command Prompt as Administrator.

### Alternative: Use npm Scripts

Instead of `npm link`, you can add to your PATH or use npm scripts:

```bash
npm start -- <command>
```

Example:
```bash
npm start -- status
```

## Platform-Specific Notes

### Windows

1. If using PowerShell, you may need to enable script execution:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

2. Better-sqlite3 may require Windows Build Tools:
```bash
npm install --global windows-build-tools
```

3. Use PowerShell demo script:
```powershell
.\demo.ps1
```

### macOS

1. You may need Xcode Command Line Tools:
```bash
xcode-select --install
```

2. Use bash demo script:
```bash
chmod +x demo.sh
./demo.sh
```

### Linux

1. You may need build essentials:
```bash
# Debian/Ubuntu
sudo apt-get install build-essential

# RHEL/CentOS/Fedora
sudo yum groupinstall "Development Tools"
```

2. Use bash demo script:
```bash
chmod +x demo.sh
./demo.sh
```

## Troubleshooting Installation

### Error: "Cannot find module 'commander'"

**Solution:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### Error: "node-gyp rebuild failed" (better-sqlite3)

**Solution:**
1. Install build tools for your platform (see above)
2. Try installing with:
```bash
npm install --build-from-source
```

### Error: "Permission denied"

**On Unix/Linux:**
```bash
# Make scripts executable
chmod +x src/app.js

# Or run with node explicitly
node src/app.js <command>
```

**On Windows:**
Run PowerShell as Administrator

### Error: "EACCES: permission denied" (npm link)

**On Unix/Linux:**
```bash
# Option 1: Use sudo
sudo npm link

# Option 2: Configure npm to use different directory
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
npm link
```

## Uninstallation

### Remove Global Link

```bash
npm unlink -g queuectl
```

### Remove Dependencies

```bash
rm -rf node_modules
rm package-lock.json
```

### Remove Database

```bash
# Unix/Linux/macOS
rm -rf src/db

# Windows
rmdir /s src\db
```

## Development Installation

For contributing or development:

```bash
# Clone repository
git clone <repository-url>
cd queuectl

# Install dependencies
npm install

# Run tests
npm test

# Run in development mode
npm start -- <command>
```

## Docker Installation (Optional)

Create a `Dockerfile`:

```dockerfile
FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ENTRYPOINT ["node", "src/app.js"]
CMD ["--help"]
```

Build and run:

```bash
docker build -t queuectl .
docker run queuectl status
```

## Next Steps

After installation:

1. Read [QUICKSTART.md](QUICKSTART.md) for basic usage
2. Run the demo script to see features in action
3. Read [README.md](README.md) for comprehensive documentation
4. Run tests to verify everything works: `npm test`

## Getting Help

If you encounter issues:

1. Check [QUICKSTART.md](QUICKSTART.md) troubleshooting section
2. Verify Node.js version: `node --version` (must be >= 16.0.0)
3. Check that dependencies installed: `ls node_modules`
4. Try reinstalling: `rm -rf node_modules && npm install`

---

**Installation complete! Run `queuectl --help` to get started.**

