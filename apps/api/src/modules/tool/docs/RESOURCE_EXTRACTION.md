# Resource Field Extraction System

## Overview

The resource field extraction system automatically identifies and processes file references in tool parameters by analyzing JSON Schema definitions. This document explains how the system works internally.

## Core Functionality

### Automatic Field Detection

The system uses the `extractResourceFields()` function to traverse JSON schemas and automatically detect fields marked with `isResource: true`.

#### Key Features

1. **Automatic Path Generation**: Field paths like `config.media.image` are automatically generated during traversal
2. **Array Detection**: Automatically identifies array vs single-value fields
3. **Format Extraction**: Reads `resourceOutputFormat` from schema
4. **No Manual Configuration**: Eliminates the need for separate `inputResourceFields` arrays

### How It Works

#### Step 1: Schema Traversal

```typescript
function extractResourceFields(schema: JsonSchema): ResourceField[] {
  // Recursively traverse schema tree
  // Find all fields with isResource: true
  // Generate field paths automatically
}
```

**Supported Patterns:**

1. **Simple Fields**
   ```json
   {
     "image": {
       "type": "string",
       "isResource": true
     }
   }
   ```
   → Generates: `{ fieldPath: "image", isArray: false }`

2. **Nested Objects**
   ```json
   {
     "config": {
       "type": "object",
       "properties": {
         "logo": {
           "isResource": true
         }
       }
     }
   }
   ```
   → Generates: `{ fieldPath: "config.logo", isArray: false }`

3. **Arrays**
   ```json
   {
     "images": {
       "type": "array",
       "items": {
         "isResource": true
       }
     }
   }
   ```
   → Generates: `{ fieldPath: "images", isArray: true }`

#### Step 2: Field Resolution

For each detected resource field:

1. **Read Value**: Use `getValueByPath(params, field.fieldPath)` to extract the file ID
2. **Download File**: Retrieve file from DriveService
3. **Convert Format**: Transform to specified format (buffer/base64/url/text)
4. **Replace Value**: Use `setValueByPath(params, field.fieldPath, content)` to inject content

## Implementation Details

### extractResourceFields()

**Location**: `apps/api/src/modules/tool/utils/resource.ts`

**Algorithm**:
```typescript
function traverse(property: SchemaProperty, path: string): void {
  // Case 1: Direct resource field
  if (property.isResource) {
    resourceFields.push({
      fieldPath: path,
      isArray: false,
      outputFormat: property.resourceOutputFormat
    });
    return;
  }

  // Case 2: Object with nested properties
  if (property.type === 'object' && property.properties) {
    for (const [key, subProperty] of Object.entries(property.properties)) {
      traverse(subProperty, path ? `${path}.${key}` : key);
    }
    return;
  }

  // Case 3: Array with resource items
  if (property.type === 'array' && property.items?.isResource) {
    resourceFields.push({
      fieldPath: path,
      isArray: true,
      outputFormat: property.items.resourceOutputFormat
    });
  }
}
```

**Complexity**: O(n) where n is the number of schema properties

### Path Utilities

**`getValueByPath(obj, path)`**: Reads nested values using dot notation
- Input: `getValueByPath({ a: { b: { c: 1 } } }, "a.b.c")`
- Output: `1`

**`setValueByPath(obj, path, value)`**: Writes nested values, creating intermediate objects
- Input: `setValueByPath({}, "a.b.c", 1)`
- Output: `{ a: { b: { c: 1 } } }`

## Integration Points

### 1. Tool Registration

**File**: `apps/api/src/modules/tool/core/registry/definition.ts`

```typescript
const inputResourceFields = extractResourceFields(schema);
const outputResourceFields = extractResourceFields(responseSchema);
```

### 2. Request Preprocessing

**File**: `apps/api/src/modules/tool/core/registry/factory.ts`

```typescript
if (parsedMethod.inputResourceFields?.length > 0) {
  const resourceHandler = this.getResourceHandler();
  processedRequest = await resourceHandler.preprocessInputResources(
    initialRequest,
    parsedMethod.inputResourceFields
  );
}
```

### 3. Response Postprocessing

**File**: `apps/api/src/modules/tool/handlers/post/base.ts`

```typescript
if (config.enableResourceUpload && context.outputResourceFields?.length > 0) {
  processedResponse = await resourceHandler.postprocessOutputResources(
    processedResponse,
    request,
    context.outputResourceFields
  );
}
```

## Benefits of This Approach

### 1. Declarative Configuration
All resource configuration lives in the schema, not in separate arrays.

**Before (Manual)**:
```typescript
{
  schema: { properties: { image: { type: "string" } } },
  inputResourceFields: [
    { fieldPath: "image", type: "image", isArray: false }
  ]
}
```

**After (Automatic)**:
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

### 2. Type Safety
Schema definitions and resource configurations stay synchronized automatically.

### 3. Reduced Maintenance
No need to manually maintain parallel `inputResourceFields` arrays.

### 4. Smart Defaults
- `outputFormat` defaults to `"buffer"` for best performance
- `type` is inferred from file MIME type
- `isArray` is detected automatically

## Output Formats

| Format | Description | Use Case | Example |
|--------|-------------|----------|---------|
| `buffer` | Node.js Buffer | Binary processing, best performance | `Buffer.from([...])` |
| `base64` | Base64 data URL | APIs, embedding | `"data:image/png;base64,..."` |
| `url` | Signed URL | Large files, external refs | `"https://..."` |
| `text` | UTF-8 string | Text documents | `"Hello world"` |

## Error Handling

The system gracefully handles errors:

1. **Missing Fields**: Logs debug message and continues
2. **Invalid Arrays**: Logs warning and skips field
3. **Download Failures**: Logs error and continues with other fields
4. **Format Conversion Errors**: Logs error and continues

This ensures that a single field failure doesn't block the entire request.

## Example: Complete Flow

**1. Schema Definition**:
```json
{
  "type": "object",
  "properties": {
    "avatar": {
      "type": "string",
      "isResource": true,
      "resourceOutputFormat": "base64"
    }
  }
}
```

**2. Automatic Extraction**:
```typescript
extractResourceFields(schema)
// Returns: [{ fieldPath: "avatar", isArray: false, outputFormat: "base64" }]
```

**3. Request Preprocessing**:
```typescript
// Input: { avatar: "file_abc123" }
preprocessInputResources(request, resourceFields)
// Output: { avatar: "data:image/png;base64,iVBORw0..." }
```

**4. Tool Execution**:
Tool receives fully resolved content, no file handling needed.

## Migration Guide

If you have existing tools with manual `inputResourceFields`:

1. Add `isResource: true` to schema fields
2. Optionally add `resourceOutputFormat` if not using default
3. Remove the `inputResourceFields` array
4. Test to ensure behavior is identical

The system is backward compatible - manually specified fields still work, but automatic extraction is preferred.
