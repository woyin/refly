# MCP Selector Components

This directory contains two MCP (Model Context Protocol) selector components:

## Components

### 1. McpSelectorPanel
The original panel component that displays MCP servers in a fixed panel layout.

**Props:**
- `isOpen: boolean` - Controls whether the panel is visible
- `onClose: () => void` - Callback when the panel should be closed

**Usage:**
```tsx
import { McpSelectorPanel } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/mcp-selector-panel';

const [isOpen, setIsOpen] = useState(false);

<McpSelectorPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
```

### 2. McpSelectorPopover (New)
A popover wrapper around the MCP selector with a trigger button. This is the recommended component for most use cases.

**Props:**
- `trigger?: React.ReactNode` - Custom trigger element (optional)
- `placement?: 'top' | 'bottom' | 'left' | 'right' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'` - Popover placement (default: 'bottom')
- `align?: { offset: [number, number] }` - Custom alignment offset (default: [0, 8])

**Usage Examples:**

#### Basic Usage (Default Trigger)
```tsx
import { McpSelectorPopover } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/mcp-selector-panel';

<McpSelectorPopover />
```

#### Custom Trigger Button
```tsx
import { McpSelectorPopover } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/mcp-selector-panel';
import { Button } from 'antd';
import { ToolOutlined } from '@ant-design/icons';

<McpSelectorPopover
  trigger={
    <Button type="primary" icon={<ToolOutlined />}>
      Select MCP
    </Button>
  }
/>
```

#### Custom Placement and Alignment
```tsx
<McpSelectorPopover
  placement="top"
  align={{ offset: [10, 10] }}
  trigger={<Button>Custom MCP Button</Button>}
/>
```

## Migration Guide

### From McpSelectorPanel to McpSelectorPopover

**Before (using panel):**
```tsx
const [mcpSelectorOpen, setMcpSelectorOpen] = useState(false);

const handleMcpSelectorToggle = useCallback(() => {
  setMcpSelectorOpen(!mcpSelectorOpen);
}, [mcpSelectorOpen]);

// In JSX
<McpSelectorPanel isOpen={mcpSelectorOpen} onClose={() => setMcpSelectorOpen(false)} />
<Button onClick={handleMcpSelectorToggle}>Open MCP Selector</Button>
```

**After (using popover):**
```tsx
import { McpSelectorPopover } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/mcp-selector-panel';

// In JSX
<McpSelectorPopover
  trigger={<Button>Open MCP Selector</Button>}
/>
```

## Features

Both components provide:
- ✅ List of available MCP servers
- ✅ Server selection with visual feedback
- ✅ Refresh functionality
- ✅ Direct link to MCP store
- ✅ Loading states
- ✅ Empty state handling
- ✅ Dark mode support
- ✅ Responsive design

The popover version additionally provides:
- ✅ Built-in trigger button with badge
- ✅ Customizable placement and alignment
- ✅ Click-to-open/close behavior
- ✅ Better UX with floating UI

## Styling

Both components use Tailwind CSS classes and follow the project's design system:
- Primary color: `#00968f`
- Border radius: `rounded-lg`
- Shadows: `shadow-[0px_2px_6px_0px_rgba(0,0,0,0.1)]`
- Dark mode support with `dark:` prefixes 