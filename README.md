# NodeScope

A professional blockchain developer diagnostic dashboard for inspecting node connectivity, JSON-RPC responses, block height, latency, and node errors.

**Current Status:** Initial application shell. Demo mode active. Portaldot V3.0 integration pending official RPC endpoint verification.

## Project Overview

NodeScope is built for the Portaldot Hacker House 2026 (Track 3: Node Operations & Tooling). The application provides:

- **Generic JSON-RPC client** for inspecting node health and metrics
- **Professional dashboard UI** with dark navy theme, cyan/teal accents
- **RPC diagnostic workspace** for raw JSON-RPC testing
- **Modular, extensible architecture** for future Portaldot V3.0 integration

## Technology Stack

- **React 19** with TypeScript
- **Vite 8** for fast development and building
- **Tailwind CSS 4** for styling
- **Lucide React** for icons
- **Node.js & npm** for dependency management

## Requirements

- Node.js 18+ (LTS or later)
- npm 9+
- Windows, macOS, or Linux

## Installation & Development

### Setup

Clone or navigate to the project directory:

```bash
cd D:\Hackathon\nodescope
```

Install dependencies:

```bash
npm install
```

### Development Server

Start the local development server with hot module reloading (HMR):

```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or the port Vite assigns).

### Build for Production

```bash
npm run build
```

The production bundle will be generated in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

### Linting

```bash
npm run lint
```

## Current Features

- ✅ Professional dashboard UI shell with dark theme
- ✅ Header with NodeScope branding and connection status badge
- ✅ Sidebar navigation (Overview, RPC Diagnostics, History)
- ✅ Overview section with metric cards (Connection Status, Latency, Latest Block, RPC Client)
- ✅ Diagnostic workspace placeholder
- ✅ Demo Mode notice indicating development status
- ✅ TypeScript types for node metrics and JSON-RPC structures
- ✅ Lucide React icons integrated
- ✅ Responsive layout

## Not Yet Implemented

- ❌ Real JSON-RPC client implementation
- ❌ Portaldot V3.0 RPC endpoint integration
- ❌ Network latency measurement
- ❌ Block height polling
- ❌ RPC method testing & response inspection
- ❌ History tracking & logging
- ❌ Wallet connection or authentication
- ❌ Smart contract interaction
- ❌ Backend/database

## Architecture

```
src/
├── components/
│   ├── common/           # Reusable: Card, Badge
│   ├── dashboard/        # Overview, MetricCard, DiagnosticWorkspace
│   └── layout/           # Header, Sidebar
├── config/               # Chain presets, RPC endpoint defaults
├── hooks/                # Future: useRpcPolling, useNodePing
├── services/             # Generic JSON-RPC client, utilities
├── types/                # node.ts, rpc.ts (JSON-RPC types)
└── utils/                # Formatters, validators
```

## Design Principles

1. **Generic RPC Client**: The application does NOT assume EVM-specific methods. All RPC diagnostics use generic JSON-RPC 2.0 specification.
2. **Extensible**: Portaldot-specific adapters can be added without modifying the core client.
3. **No Hardcoded Endpoints**: RPC endpoints, Chain IDs, and Portaldot V3.0 parameters must come from official documentation or user input.
4. **Professional UI**: Dark navy background (#0f172a), cyan/teal accents (#06b6d4), restrained and clean.
5. **Realistic States**: Empty states show "Unavailable" or "—" rather than fabricated blockchain data.

## Important Notes

- **Portaldot V3.0 Integration Pending**: Official RPC endpoints and supported methods will be integrated once verified through Portaldot documentation.
- **No Smart Contracts Yet**: This is a diagnostic dashboard, not a contract deployment tool.
- **Windows Compatible**: All scripts and tooling work on Windows, macOS, and Linux.
- **Hackathon Constraint**: Code produced primarily during Oct 14 – Nov 6, 2026.

## Next Steps

1. Implement generic JSON-RPC client service
2. Add endpoint configuration UI
3. Build RPC diagnostic console with method testing
4. Integrate network latency measurement
5. Verify Portaldot V3.0 RPC specification
6. Deploy to Portaldot testnet
7. Add testing (unit & integration)

## License

MIT (as per Portaldot Hacker House requirements).

## References

- [Vite Documentation](https://vite.dev/)
- [React Documentation](https://react.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [Lucide Icons](https://lucide.dev/)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)
