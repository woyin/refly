# Resource Resolution Guide

## Overview

This guide explains how to configure resource field resolution in tool configurations. The system now supports automatic conversion of Drive file IDs into different formats (buffer, base64, URL, or text).

## Configuration

### Resource Field Definition

In your tool's method configuration, use `inputResourceFields` to specify which parameters should be resolved from Drive file IDs:

```typescript
{
  inputResourceFields: [
    {
      fieldPath: 'audio',              // Parameter path in request
      type: 'audio',                   // Resource type: 'audio' | 'video' | 'image' | 'document'
      isArray: false,                  // Whether this is an array of resources
      outputFormat: 'buffer'           // Optional: 'buffer' | 'base64' | 'url' | 'text' (default: buffer)
    }
  ]
}
```

### Output Formats

- **`buffer`** (default): Returns the file content as a Buffer object
  - Best for binary data and direct file processing
  - Most efficient for internal processing

- **`base64`**: Returns a base64-encoded data URL
  - Format: `data:{mimeType};base64,{base64Data}`
  - Useful for embedding in HTML or JSON
  - Example: `data:image/png;base64,iVBORw0KG...`

- **`url`**: Returns a signed URL for the file
  - Requires object storage with URL signing support
  - Useful for external API calls or frontend display
  - URL is time-limited (configurable expiry)

- **`text`**: Returns the file content as a UTF-8 string
  - Only suitable for text files
  - Useful for processing text documents or scripts

## Examples

### Example 1: Single Image File (Buffer Format)

```typescript
// Tool configuration
const config = {
  inputResourceFields: [
    {
      fieldPath: 'referenceImage',
      type: 'image',
      isArray: false,
      outputFormat: 'buffer'  // Will resolve to Buffer
    }
  ]
};

// Request parameters (before resolution)
const request = {
  params: {
    referenceImage: 'file_abc123',  // Drive file ID
    prompt: 'Generate a similar image'
  }
};

// After resolution
const resolvedRequest = {
  params: {
    referenceImage: Buffer.from(...),  // Actual file buffer
    prompt: 'Generate a similar image'
  }
};
```

### Example 2: Multiple Audio Files (Base64 Format)

```typescript
// Tool configuration
const config = {
  inputResourceFields: [
    {
      fieldPath: 'audioFiles',
      type: 'audio',
      isArray: true,
      outputFormat: 'base64'  // Will resolve to base64 data URLs
    }
  ]
};

// Request parameters (before resolution)
const request = {
  params: {
    audioFiles: ['file_xyz789', 'file_abc456'],
    volume: 0.8
  }
};

// After resolution
const resolvedRequest = {
  params: {
    audioFiles: [
      'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAA...',
      'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAB...'
    ],
    volume: 0.8
  }
};
```

### Example 3: Video File with URL Format

```typescript
// Tool configuration
const config = {
  inputResourceFields: [
    {
      fieldPath: 'video',
      type: 'video',
      isArray: false,
      outputFormat: 'url'  // Will resolve to signed URL
    }
  ]
};

// Request parameters (before resolution)
const request = {
  params: {
    video: 'file_video123',
    duration: 30
  }
};

// After resolution
const resolvedRequest = {
  params: {
    video: 'https://storage.example.com/videos/abc.mp4?signature=...',
    duration: 30
  }
};
```

### Example 4: Text Document Processing

```typescript
// Tool configuration
const config = {
  inputResourceFields: [
    {
      fieldPath: 'document',
      type: 'document',
      isArray: false,
      outputFormat: 'text'  // Will resolve to text content
    }
  ]
};

// Request parameters (before resolution)
const request = {
  params: {
    document: 'file_doc789',
    action: 'summarize'
  }
};

// After resolution
const resolvedRequest = {
  params: {
    document: 'This is the full text content of the document...',
    action: 'summarize'
  }
};
```

### Example 5: Mixed Resource Types

```typescript
// Tool configuration
const config = {
  inputResourceFields: [
    {
      fieldPath: 'config.backgroundImage',
      type: 'image',
      isArray: false,
      outputFormat: 'base64'
    },
    {
      fieldPath: 'config.voiceFiles',
      type: 'audio',
      isArray: true,
      outputFormat: 'buffer'
    }
  ]
};

// Request parameters (before resolution)
const request = {
  params: {
    config: {
      backgroundImage: 'file_img123',
      voiceFiles: ['file_audio1', 'file_audio2'],
      speed: 1.5
    }
  }
};

// After resolution
const resolvedRequest = {
  params: {
    config: {
      backgroundImage: 'data:image/png;base64,iVBORw0KG...',
      voiceFiles: [Buffer.from(...), Buffer.from(...)],
      speed: 1.5
    }
  }
};
```

## Implementation Details

### ResourceResolver Interface

The `ResourceResolver` interface now includes a new method:

```typescript
interface ResourceResolver {
  /**
   * Resolve drive file by file ID and convert to specified format
   * @param fileId - Drive file ID
   * @param format - Output format (base64, url, buffer, text)
   * @returns Resolved file content in the specified format
   */
  resolveDriveFile: (
    fileId: string,
    format?: 'base64' | 'url' | 'buffer' | 'text'
  ) => Promise<string | Buffer>;
}
```

### Process Flow

1. **Request Received**: Tool receives request with file IDs
2. **Field Detection**: System detects fields marked in `inputResourceFields`
3. **File Resolution**: For each field:
   - Retrieve file from DriveService by ID
   - Get file metadata (MIME type, size, etc.)
   - Convert file content to specified format
4. **Parameter Replacement**: Replace file IDs with resolved content
5. **Tool Execution**: Tool receives request with resolved files

### Error Handling

- If a file ID is not found, the original value is kept and a warning is logged
- If format conversion fails, an error is logged but other fields continue processing
- URL format requires proper object storage configuration

## Best Practices

1. **Choose the Right Format**:
   - Use `buffer` for most internal processing (default, most efficient)
   - Use `base64` when you need to embed files in JSON/HTML
   - Use `url` for external API calls or frontend display
   - Use `text` only for text-based files

2. **Consider File Sizes**:
   - `base64` increases file size by ~33%
   - `url` is best for large files as it doesn't transfer content
   - `buffer` is most memory-efficient for processing

3. **Array Handling**:
   - Set `isArray: true` when the field accepts multiple files
   - All files in the array will use the same `outputFormat`

4. **Nested Paths**:
   - Use dot notation for nested fields: `config.image`
   - Supports deep nesting: `options.media.backgroundImage`

## Migration from Old System

If you're using the old `resolveFile` and `getFileMetadata` methods:

```typescript
// Old way (deprecated)
const metadata = await resolver.getFileMetadata(fileId);
const buffer = await resolver.resolveFile(fileId);

// New way
const buffer = await resolver.resolveDriveFile(fileId, 'buffer');
const base64 = await resolver.resolveDriveFile(fileId, 'base64');
const url = await resolver.resolveDriveFile(fileId, 'url');
```

The system automatically detects which method to use for backward compatibility.
