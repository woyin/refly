# Resource Field Configuration Guide

## Overview

Resource fields are automatically extracted from your JSON Schema definition. Simply mark any field with `isResource: true` and the system will automatically resolve file IDs to their content in the specified format.

## Quick Start

### Step 1: Mark Resource Fields in Schema

In your tool's JSON Schema, simply add `isResource: true` to any field that references a Drive file:

```json
{
  "fieldName": {
    "type": "string",
    "description": "Field description",
    "isResource": true,
    "resourceOutputFormat": "buffer"  // Optional, default is "buffer"
  }
}
```

**That's it!** The resource type (image/audio/video/document) is automatically inferred from the file's MIME type.

### Step 2: Use the Tool

The system will automatically:
1. Extract all resource fields from your schema
2. Resolve file IDs to actual file content
3. Convert content to the specified format
4. Replace the field value with the resolved content

## Field Properties

### Required Properties

- **`isResource`**: `true` - Marks this field as a resource reference

### Optional Properties

- **`resourceOutputFormat`**: Specifies the output format (default: `"buffer"`)
  - `"buffer"` - Returns Node.js Buffer object (best performance)
  - `"base64"` - Returns base64-encoded data URL
  - `"url"` - Returns signed URL (requires object storage support)
  - `"text"` - Returns file content as UTF-8 text string

## Complete Examples

### Example 1: Single Image File (Minimal Configuration)

```json
{
  "schema": {
    "type": "object",
    "properties": {
      "photo": {
        "type": "string",
        "description": "User photo file ID",
        "isResource": true,
        "resourceOutputFormat": "base64"
      }
    }
  }
}
```

**Note**: The resource type (image) is automatically detected from the file's MIME type (e.g., `image/png`, `image/jpeg`).

**Request sent by user:**
```json
{
  "photo": "file_abc123"
}
```

**Request received by tool (after resolution):**
```json
{
  "photo": "data:image/png;base64,iVBORw0KGgoAAAANS..."
}
```

### Example 2: Array of Audio Files

```json
{
  "schema": {
    "type": "object",
    "properties": {
      "audioTracks": {
        "type": "array",
        "description": "Multiple audio tracks",
        "items": {
          "type": "string",
          "isResource": true
        }
      }
    }
  }
}
```

**Note**:
- Resource type automatically detected from MIME type (e.g., `audio/mpeg`, `audio/wav`)
- `resourceOutputFormat` defaults to `buffer` when not specified

**Request sent by user:**
```json
{
  "audioTracks": ["file_audio1", "file_audio2", "file_audio3"]
}
```

**Request received by tool:**
```json
{
  "audioTracks": [Buffer, Buffer, Buffer]
}
```

### Example 3: Nested Resource Fields

```json
{
  "schema": {
    "type": "object",
    "properties": {
      "config": {
        "type": "object",
        "properties": {
          "backgroundImage": {
            "type": "string",
            "isResource": true,
            "resourceOutputFormat": "url"
          },
          "logoImage": {
            "type": "string",
            "isResource": true,
            "resourceOutputFormat": "base64"
          },
          "title": {
            "type": "string",
            "description": "Video title"
          }
        }
      }
    }
  }
}
```

**Request sent by user:**
```json
{
  "config": {
    "backgroundImage": "file_bg123",
    "logoImage": "file_logo456",
    "title": "My Video"
  }
}
```

**Request received by tool:**
```json
{
  "config": {
    "backgroundImage": "https://storage.example.com/file_bg123?signature=...",
    "logoImage": "data:image/png;base64,iVBORw0KG...",
    "title": "My Video"
  }
}
```

### Example 4: Mixed Resource Types

```json
{
  "schema": {
    "type": "object",
    "properties": {
      "script": {
        "type": "string",
        "description": "Video script document",
        "isResource": true,
        "resourceOutputFormat": "text"
      },
      "voiceover": {
        "type": "string",
        "description": "Voiceover audio",
        "isResource": true,
        "resourceOutputFormat": "buffer"
      },
      "thumbnail": {
        "type": "string",
        "description": "Video thumbnail",
        "isResource": true,
        "resourceOutputFormat": "base64"
      }
    }
  }
}
```

## Output Format Guidelines

### When to Use Each Format

#### `buffer` (Default)
- **Best for**: Direct file processing, passing to libraries
- **Pros**: Most efficient, no encoding overhead
- **Cons**: Not JSON-serializable
- **Example use cases**:
  - Processing images with Sharp
  - Audio processing with FFmpeg
  - Binary file manipulation

#### `base64`
- **Best for**: Embedding in JSON/HTML, API calls
- **Pros**: Easy to embed, works everywhere
- **Cons**: 33% larger than original, encoding overhead
- **Example use cases**:
  - Sending images to AI vision APIs
  - Embedding images in HTML emails
  - Inline data URLs in web pages

#### `url`
- **Best for**: Large files, external references
- **Pros**: No file transfer, minimal memory use
- **Cons**: Requires network access, time-limited
- **Example use cases**:
  - Video processing services
  - CDN references
  - Large file downloads

#### `text`
- **Best for**: Text documents only
- **Pros**: Easy to process as string
- **Cons**: Only works for text files
- **Example use cases**:
  - Processing markdown/text documents
  - Reading configuration files
  - Analyzing code files

## Automatic Extraction

The system automatically extracts resource fields using the `extractResourceFields()` function:

```typescript
import { extractResourceFields } from './utils/resource';

// Your JSON Schema
const schema = {
  type: 'object',
  properties: {
    image: {
      type: 'string',
      isResource: true,
      resourceOutputFormat: 'base64'
    }
  }
};

// Automatically extract resource fields
const resourceFields = extractResourceFields(schema);
// Result:
// [
//   {
//     fieldPath: 'image',
//     type: undefined,  // Will be inferred from file MIME type
//     isArray: false,
//     outputFormat: 'base64'
//   }
// ]
```

## No Manual Configuration Needed!

**Old way** (manual configuration - no longer needed):
```typescript
{
  inputResourceFields: [
    {
      fieldPath: 'image',
      type: 'image',
      isArray: false,
      outputFormat: 'base64'
    }
  ]
}
```

**New way** (automatic from schema):
```json
{
  "schema": {
    "properties": {
      "image": {
        "type": "string",
        "isResource": true,
        "resourceOutputFormat": "base64"
      }
    }
  }
}
```

The `inputResourceFields` are now automatically generated from your schema definition!

## Error Handling

### Invalid File ID
If a file ID doesn't exist, the original value is kept and a warning is logged:

```
WARN: File metadata not found for fileId: file_invalid123
```

### Conversion Failure
If format conversion fails, an error is logged but other fields continue processing:

```
ERROR: Failed to resolve resource field image: Buffer conversion failed
```

## Best Practices

1. **Mark resource fields** with `isResource: true`
2. **Choose appropriate output format** based on your use case
3. **Use buffer format** (default) unless you have a specific reason not to
4. **Document your resource fields** with clear descriptions
5. **Test with actual file IDs** to ensure proper resolution

## Migration Guide

If you have existing tools with manual `inputResourceFields` configuration:

### Before (Manual Configuration)
```typescript
const toolConfig = {
  schema: {
    properties: {
      image: { type: 'string' }
    }
  },
  inputResourceFields: [
    {
      fieldPath: 'image',
      type: 'image',
      isArray: false,
      outputFormat: 'base64'
    }
  ]
};
```

### After (Automatic from Schema)
```typescript
const toolConfig = {
  schema: {
    properties: {
      image: {
        type: 'string',
        isResource: true,
        resourceType: 'image',
        resourceOutputFormat: 'base64'
      }
    }
  }
  // inputResourceFields automatically extracted!
};
```

## See Also

- [Resource Resolution Guide](./resource-resolution-guide.md) - Technical implementation details
- [Example Configuration](./resource-field-example.json) - Complete example
