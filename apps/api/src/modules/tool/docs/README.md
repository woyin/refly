# Tool Resource Resolution System

## Overview

This system provides automatic file resolution for tool integrations. Simply mark fields in your JSON Schema with `isResource: true`, and the system will automatically:

1. **Extract resource fields** from your schema definition
2. **Resolve file IDs** to actual file content from DriveService
3. **Convert formats** based on your specification (buffer/base64/url/text)
4. **Inject content** into tool parameters before execution

## Minimal Example

```json
{
  "schema": {
    "type": "object",
    "properties": {
      "image": {
        "type": "string",
        "isResource": true
      }
    }
  }
}
```

**Before resolution:**
```json
{ "image": "file_abc123" }
```

**After resolution:**
```json
{ "image": Buffer.from(...) }
```

## Key Features

### ✅ Fully Automatic
- **No manual configuration needed**: Resource fields are automatically extracted from schema
- **No `inputResourceFields` array**: Everything is defined in the schema itself

### ✅ Smart Type Inference
- **Resource type automatically detected**: Inferred from file MIME type
  - `image/png` → image type
  - `audio/mpeg` → audio type
  - `video/mp4` → video type
  - `application/pdf` → document type

### ✅ Flexible Output Formats
- **`buffer`** (default): Best performance, native Node.js Buffer
- **`base64`**: Data URL format for APIs and embedding
- **`url`**: Signed URL for large files and external references
- **`text`**: UTF-8 string for text documents

### ✅ Deep Nesting Support
- Works with nested objects: `config.image`
- Works with arrays: `images[]`
- Works with nested arrays: `config.images[]`

## Required Schema Properties

Only **one** property is required:

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `isResource` | boolean | ✅ Yes | - | Marks this field as a Drive file reference |
| `resourceOutputFormat` | string | ❌ No | `"buffer"` | Output format: `buffer`, `base64`, `url`, or `text` |

## Complete Examples

### Single File (Minimal)
```json
{
  "avatar": {
    "type": "string",
    "isResource": true
  }
}
```

### Single File (With Format)
```json
{
  "avatar": {
    "type": "string",
    "isResource": true,
    "resourceOutputFormat": "base64"
  }
}
```

### Array of Files
```json
{
  "attachments": {
    "type": "array",
    "items": {
      "type": "string",
      "isResource": true,
      "resourceOutputFormat": "url"
    }
  }
}
```

### Nested Object
```json
{
  "config": {
    "type": "object",
    "properties": {
      "background": {
        "type": "string",
        "isResource": true,
        "resourceOutputFormat": "base64"
      }
    }
  }
}
```

## Documentation

- **[Quick Start Guide](./resource-field-configuration.md)** - Complete configuration guide with examples
- **[Technical Details](./resource-resolution-guide.md)** - Implementation details and advanced usage
- **[Example Configuration](./resource-field-example.json)** - Real-world example

## Migration from Manual Configuration

### Before (Manual - Deprecated)
```typescript
{
  schema: { properties: { image: { type: "string" } } },
  inputResourceFields: [
    { fieldPath: "image", type: "image", isArray: false }
  ]
}
```

### After (Automatic - Recommended)
```json
{
  "schema": {
    "properties": {
      "image": {
        "type": "string",
        "isResource": true
      }
    }
  }
}
```

The `inputResourceFields` array is now **automatically generated** from your schema!

## Implementation

### Automatic Extraction

The `extractResourceFields()` function automatically traverses your schema and extracts resource fields:

```typescript
import { extractResourceFields } from './utils/resource';

const schema = {
  type: 'object',
  properties: {
    image: { type: 'string', isResource: true },
    audio: { type: 'string', isResource: true, resourceOutputFormat: 'base64' }
  }
};

const fields = extractResourceFields(schema);
// Returns:
// [
//   { fieldPath: 'image', isArray: false, outputFormat: undefined },
//   { fieldPath: 'audio', isArray: false, outputFormat: 'base64' }
// ]
```

### Resolution Process

1. **Schema Parsing**: Extract resource fields from JSON Schema
2. **Field Detection**: Identify file ID values in request parameters
3. **File Resolution**:
   - Retrieve file from DriveService by ID
   - Get file metadata including MIME type
   - Infer resource type from MIME type if not specified
4. **Format Conversion**: Convert file content to specified format
5. **Parameter Injection**: Replace file IDs with resolved content

## Benefits

1. **Simpler Configuration**: Just add `isResource: true`
2. **Type Safety**: TypeScript types automatically generated
3. **Smart Defaults**: Sensible defaults for all optional fields
4. **Auto-detection**: Resource types inferred from files
5. **Flexible**: Override defaults when needed
6. **Backward Compatible**: Old manual configuration still works

## Future Enhancements

- ✅ Automatic resource type detection (implemented)
- ⏳ Caching for frequently accessed files
- ⏳ Lazy loading for large files
- ⏳ Streaming support for video/audio
- ⏳ Format validation and conversion
- ⏳ Automatic thumbnail generation

## See Also

- [DriveService Documentation](../drive/README.md)
- [Tool Handler Documentation](../handlers/README.md)
- [OpenAPI Schema Types](../../../../packages/openapi-schema/README.md)
