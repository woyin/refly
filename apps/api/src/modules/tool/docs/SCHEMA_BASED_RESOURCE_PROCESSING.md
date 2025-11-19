# Schema-Based Resource Processing

## Overview

The resource processing system has been refactored to use **schema-based traversal** instead of fieldPath-based processing. This eliminates the need for manual path configuration and makes the system more maintainable.

## Key Changes

### 1. New Processing Function: `processResourcesInData`

```typescript
export async function processResourcesInData(
  schema: JsonSchema,
  data: Record<string, unknown>,
  processor: (value: unknown, schema: SchemaProperty) => Promise<unknown>,
): Promise<Record<string, unknown>>
```

This function:
- Traverses schema and data **simultaneously**
- Automatically detects fields marked with `isResource: true`
- Processes each resource field using the provided processor function
- Handles nested objects and arrays automatically
- No need for `fieldPath` - paths are computed during traversal

### 2. Updated ResourceHandler Methods

#### preprocessInputResources

**Old signature:**
```typescript
async preprocessInputResources(
  request: HandlerRequest,
  resourceFields: ResourceField[],  // ❌ Manual field list
): Promise<HandlerRequest>
```

**New signature:**
```typescript
async preprocessInputResources(
  request: HandlerRequest,
  schema: JsonSchema,  // ✅ Schema with isResource markers
): Promise<HandlerRequest>
```

**How it works:**
1. Takes the input schema (with `isResource` markers)
2. Traverses schema and `request.params` together
3. For each field marked `isResource: true`:
   - Downloads the file using fileId
   - Converts to specified format (buffer/base64/url/text)
   - Replaces the value in-place

#### postprocessOutputResources

**Old signature:**
```typescript
async postprocessOutputResources(
  response: HandlerResponse,
  request: HandlerRequest,
  resourceFields: ResourceField[],  // ❌ Manual field list
): Promise<HandlerResponse>
```

**New signature:**
```typescript
async postprocessOutputResources(
  response: HandlerResponse,
  request: HandlerRequest,
  schema: ResponseSchema,  // ✅ Response schema with isResource markers
): Promise<HandlerResponse>
```

**How it works:**
1. Takes the response schema (with `isResource` markers)
2. Traverses schema and `response.data` together
3. For each field marked `isResource: true`:
   - Uploads the resource content to DriveService
   - Replaces with `{ fileId: "..." }` reference

### 3. Removed Dependencies

- **Removed**: Custom path utilities (`getValueByPath`, `setValueByPath`, `hasPath`, `getAllPaths`)
- **Removed**: `lodash` dependency for get/set
- **Removed**: `fieldPath` configuration in `ResourceField`

### 4. Deprecated Functions

The following functions are now deprecated and return empty arrays:

```typescript
export function extractResourceFields(schema: JsonSchema): ResourceField[] {
  return []; // No longer needed
}

export function extractOutputResourceFields(schema: ResponseSchema): ResourceField[] {
  return []; // No longer needed
}
```

## Migration Guide

### For Tool Developers

**No changes needed!** Your tool schemas already use `isResource: true`, so everything continues to work.

### For Framework Developers

If you're calling `ResourceHandler` methods directly, update your code:

**Before:**
```typescript
const resourceFields = extractResourceFields(schema);
const processed = await resourceHandler.preprocessInputResources(
  request,
  resourceFields
);
```

**After:**
```typescript
const processed = await resourceHandler.preprocessInputResources(
  request,
  schema  // Pass schema directly
);
```

## Example

### Schema Definition
```json
{
  "type": "object",
  "properties": {
    "avatar": {
      "type": "string",
      "isResource": true,
      "resourceOutputFormat": "base64"
    },
    "documents": {
      "type": "array",
      "items": {
        "type": "string",
        "isResource": true
      }
    },
    "config": {
      "type": "object",
      "properties": {
        "logo": {
          "type": "string",
          "isResource": true,
          "resourceOutputFormat": "url"
        }
      }
    }
  }
}
```

### Processing Flow

**Input data:**
```json
{
  "avatar": { "fileId": "file1" },
  "documents": [
    { "fileId": "file2" },
    { "fileId": "file3" }
  ],
  "config": {
    "logo": { "fileId": "file4" }
  }
}
```

**After preprocessing:**
```json
{
  "avatar": "data:image/png;base64,iVBORw0KG...",
  "documents": [
    Buffer<...>,
    Buffer<...>
  ],
  "config": {
    "logo": "https://storage.example.com/files/file4?signed=..."
  }
}
```

## Benefits

1. **Simpler Code**: No need to generate and maintain fieldPath strings
2. **Type Safety**: Schema and data are processed together, reducing mismatches
3. **Less Configuration**: Just mark fields with `isResource: true`
4. **Better Performance**: Single traversal instead of path-based lookups
5. **Easier Debugging**: Processing logic is straightforward and linear
6. **No External Dependencies**: Removed lodash dependency

## Technical Details

### How processResourcesInData Works

```typescript
async function processResourcesInData(schema, data, processor) {
  const result = { ...data };

  async function traverse(schemaProperty, dataValue, key, parent) {
    // Case 1: Resource field - process it
    if (schemaProperty.isResource) {
      parent[key] = await processor(dataValue, schemaProperty);
      return;
    }

    // Case 2: Array with resource items
    if (schemaProperty.type === 'array' && schemaProperty.items?.isResource) {
      const processed = await Promise.all(
        dataValue.map(item => processor(item, schemaProperty.items))
      );
      parent[key] = processed;
      return;
    }

    // Case 3: Nested object - recurse
    if (schemaProperty.type === 'object' && schemaProperty.properties) {
      // Recursively process nested properties
      for (const [nestedKey, nestedSchema] of Object.entries(schemaProperty.properties)) {
        await traverse(nestedSchema, dataValue[nestedKey], nestedKey, dataValue);
      }
    }
  }

  // Start from root
  for (const [key, schemaProperty] of Object.entries(schema.properties)) {
    await traverse(schemaProperty, data[key], key, result);
  }

  return result;
}
```

### Resource Upload Logic

The new `uploadResource` method handles multiple input formats:

1. **Buffer**: Directly upload as base64 content
2. **Base64 Data URL**: Extract MIME type and upload
3. **External URL**: Create drive file with `externalUrl`
4. **Object with buffer**: Upload buffer with metadata

All uploads automatically:
- Infer resource type from MIME type
- Generate unique filenames with timestamps
- Set source as 'agent'
- Return fileId for reference

## Architecture Changes

### HandlerContext and HandlerConfig Updates

The `HandlerContext` and `HandlerConfig` types have been updated to support the new schema-based approach:

**HandlerContext** (in `@refly/openapi-schema`):
```typescript
export type HandlerContext = {
  user?: HandlerRequestUser;
  credentials?: { [key: string]: unknown };
  inputResourceFields?: Array<ResourceField>; // Deprecated
  outputResourceFields?: Array<ResourceField>; // Deprecated
  responseSchema?: ResponseSchema; // NEW: Schema for resource processing
  startTime: number;
};
```

**HandlerConfig** (in `@refly/openapi-schema`):
```typescript
export type HandlerConfig = {
  endpoint: string;
  method?: HttpMethod;
  credentials?: { [key: string]: unknown };
  inputResourceFields?: Array<ResourceField>; // Deprecated
  outputResourceFields?: Array<ResourceField>; // Deprecated
  responseSchema?: ResponseSchema; // NEW: Schema for resource processing
  timeout?: number;
  maxRetries?: number;
  headers?: { [key: string]: string };
  useFormData?: boolean;
};
```

### ResourceHandler Integration

The `ResourceHandler` is now properly injected through the dependency injection system:

1. **ToolFactory**: Receives `ResourceHandler` via constructor injection
2. **HttpHandler**: Receives `ResourceHandler` instance from ToolFactory through options
3. **BasePostHandler**: Uses the provided `ResourceHandler` instance for postprocessing

**Flow**:
```
ToolModule (DI)
  → ToolFactory (injected ResourceHandler)
    → HttpHandler (passed via options.resourceHandler)
      → BasePostHandler (passed via config.resourceHandler)
        → postprocessOutputResources(responseSchema)
```

## Future Improvements

1. **Stream Processing**: For very large files, use streams instead of buffers
2. **Batch Uploads**: Optimize multiple file uploads with parallelization
3. **Progress Tracking**: Add progress callbacks for long-running uploads
4. **Caching**: Cache recently downloaded files to avoid re-downloads
