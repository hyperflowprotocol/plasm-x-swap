# Overview

This repository appears to be in its initial setup phase, containing primarily configuration files for development tools and security scanning. The project includes Hardhat configuration for Ethereum/blockchain development and Semgrep security rules for code analysis. The repository structure suggests this may be intended as a blockchain development project or smart contract development environment.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Development Environment
- **Hardhat Framework**: Configured for Ethereum development with Node.js runtime
- **Security Scanning**: Semgrep integration with custom rules for Bicep/Azure resource templates
- **Configuration Management**: Centralized config directory structure for tool-specific settings

## Code Quality & Security
- **Static Analysis**: Semgrep rules configured to detect security vulnerabilities, specifically targeting:
  - Sensitive parameter handling in Azure Bicep templates
  - Prevention of secret logging and exposure
  - CWE-532 compliance for sensitive information in logs

## Project Structure
- Minimal setup with focus on configuration and security
- Telemetry disabled for privacy
- No application code or business logic present yet

# External Dependencies

## Development Tools
- **Hardhat**: Ethereum development environment and testing framework
- **Node.js**: Runtime environment for Hardhat

## Security & Analysis
- **Semgrep**: Static analysis security scanner with custom rule definitions
- **Azure Bicep**: Infrastructure as Code template language (referenced in security rules)

## Cloud & Infrastructure
- **Azure**: Cloud platform integration suggested through Bicep security rules
- **Azure CLI/PowerShell**: Deployment and management tools referenced in security configurations