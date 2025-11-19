# Resource Field Preprocessing Flow Diagram

## Overview Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Tool Invocation Layer                              │
│                                                                             │
│  User/Agent calls tool with params containing fileIds                      │
│  { avatar: "file_123", documents: ["file_456", "file_789"] }              │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             ToolFactory.func()                              │
│  apps/api/src/modules/tool/core/registry/factory.ts:273                    │
│                                                                             │
│  1. Build HandlerRequest from raw params                                   │
│  2. Set up execution context (user, canvasId)                              │
│  3. *** INPUT PREPROCESSING PHASE ***                                      │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│               🔄 INPUT PREPROCESSING: fileId → Content                      │
│                                                                             │
│  ResourceHandler.preprocessInputResources(request, inputSchema)            │
│  apps/api/src/modules/tool/utils/resource.ts:788-1058                      │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│            Schema-Based Traversal: processResourcesInData()                │
│            apps/api/src/modules/tool/utils/resource.ts:142-238             │
│                                                                             │
│  For each field in schema:                                                 │
│    if (field.isResource === true) {                                        │
│      ┌───────────────────────────────────────────────────────────────┐    │
│      │  Extract fileId from request.params                          │    │
│      │    e.g., "file_123" from avatar field                        │    │
│      └───────────────────────┬───────────────────────────────────────┘    │
│                              ▼                                             │
│      ┌───────────────────────────────────────────────────────────────┐    │
│      │  ResourceResolver.resolveDriveFile()                         │    │
│      │    - Get file from DriveService                              │    │
│      │    - Convert to resourceOutputFormat:                        │    │
│      │      * "buffer" → Node.js Buffer                             │    │
│      │      * "base64" → base64 string                              │    │
│      │      * "url" → download URL                                  │    │
│      │      * "text" → UTF-8 text                                   │    │
│      └───────────────────────┬───────────────────────────────────────┘    │
│                              ▼                                             │
│      ┌───────────────────────────────────────────────────────────────┐    │
│      │  Replace fileId with actual content in request.params        │    │
│      │    avatar: Buffer(...) or "data:image/png;base64,..."        │    │
│      └───────────────────────────────────────────────────────────────┘    │
│    }                                                                       │
│                                                                             │
│  Result: request.params now contains actual file content                  │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        HttpHandler.handle(request)                          │
│                apps/api/src/modules/tool/handlers/handler.ts:124            │
│                                                                             │
│  Orchestrates the full request lifecycle                                   │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Pre-handlers Execution                             │
│           apps/api/src/modules/tool/handlers/pre/base.ts:42                │
│                                                                             │
│  • BasePreHandler: Inject credentials only                                 │
│  • (Resource resolution already done in ToolFactory)                       │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Execute Tool via Adapter                             │
│                                                                             │
│  HttpAdapter makes actual API call to external service                     │
│    - Request body contains processed file content                          │
│    - External API processes and returns result                             │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        API Response Received                                │
│                                                                             │
│  Response may contain generated resources:                                 │
│  {                                                                          │
│    generatedImage: Buffer(...),                                            │
│    audioUrl: "https://example.com/audio.mp3",                              │
│    videoFile: "data:video/mp4;base64,..."                                  │
│  }                                                                          │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Post-handlers Execution                             │
│           apps/api/src/modules/tool/handlers/post/base.ts:147              │
│                                                                             │
│  1. BasePostHandler.processBilling() - Calculate usage credits             │
│  2. *** OUTPUT POSTPROCESSING PHASE ***                                    │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              🔄 OUTPUT POSTPROCESSING: Content → fileId                     │
│                                                                             │
│  ResourceHandler.postprocessOutputResources(response, request, schema)     │
│  apps/api/src/modules/tool/utils/resource.ts:788-1058                      │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│          Schema-Based Traversal: processResourcesInData()                  │
│          apps/api/src/modules/tool/utils/resource.ts:142-238               │
│                                                                             │
│  For each field in responseSchema:                                         │
│    if (field.isResource === true) {                                        │
│      ┌───────────────────────────────────────────────────────────────┐    │
│      │  Detect resource type in response                            │    │
│      │    - Buffer object                                           │    │
│      │    - Base64 data URL                                         │    │
│      │    - External URL                                            │    │
│      │    - Local file path                                         │    │
│      └───────────────────────┬───────────────────────────────────────┘    │
│                              ▼                                             │
│      ┌───────────────────────────────────────────────────────────────┐    │
│      │  ResourceUploader.uploadResource()                           │    │
│      │    - Upload to DriveService                                  │    │
│      │    - Infer MIME type and resource type                       │    │
│      │    - Store file with metadata                                │    │
│      │    - Return { fileId, resourceType, metadata }               │    │
│      └───────────────────────┬───────────────────────────────────────┘    │
│                              ▼                                             │
│      ┌───────────────────────────────────────────────────────────────┐    │
│      │  Replace content with fileId reference in response           │    │
│      │    generatedImage: { fileId: "file_999" }                    │    │
│      └───────────────────────────────────────────────────────────────┘    │
│    }                                                                       │
│                                                                             │
│  Result: response now contains fileId references instead of raw content    │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Return to Caller                                   │
│                                                                             │
│  Tool returns processed response with fileIds:                             │
│  {                                                                          │
│    generatedImage: { fileId: "file_999" },                                 │
│    audioUrl: { fileId: "file_1000" },                                      │
│    videoFile: { fileId: "file_1001" }                                      │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Components Detailed View

### 1. Schema-Based Resource Detection

```
┌───────────────────────────────────────────────────────────────────────┐
│                 Tool Schema Definition (JSON)                         │
│                                                                       │
│  {                                                                    │
│    "inputSchema": {                                                   │
│      "type": "object",                                                │
│      "properties": {                                                  │
│        "avatar": {                                                    │
│          "type": "string",                                            │
│          "isResource": true,              ← Resource marker           │
│          "resourceOutputFormat": "base64"  ← Format specification     │
│        },                                                             │
│        "documents": {                                                 │
│          "type": "array",                                             │
│          "items": {                                                   │
│            "type": "string",                                          │
│            "isResource": true             ← Array of resources        │
│          }                                                            │
│        }                                                              │
│      }                                                                │
│    },                                                                 │
│    "responseSchema": {                                                │
│      "type": "object",                                                │
│      "properties": {                                                  │
│        "generatedImage": {                                            │
│          "type": "string",                                            │
│          "isResource": true               ← Output resource           │
│        }                                                              │
│      }                                                                │
│    }                                                                  │
│  }                                                                    │
└───────────────────────────────────────────────────────────────────────┘
```

### 2. ResourceHandler Internal Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      ResourceHandler Class                              │
│         apps/api/src/modules/tool/utils/resource.ts:788-1058           │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  constructor(driveService, objectStorageService)                │   │
│  │    - Inject services for file operations                        │   │
│  │    - Create ResourceResolver and ResourceUploader               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  preprocessInputResources(request, schema)                      │   │
│  │    │                                                             │   │
│  │    ├─► processResourcesInData(                                  │   │
│  │    │     request.params,                                        │   │
│  │    │     schema.properties,                                     │   │
│  │    │     async (value, fieldSchema) => {                        │   │
│  │    │       // For each resource field:                          │   │
│  │    │       fileId = extractFileId(value)                        │   │
│  │    │       content = await resolver.resolveDriveFile(fileId)    │   │
│  │    │       return formatContent(content, fieldSchema)           │   │
│  │    │     }                                                       │   │
│  │    │   )                                                         │   │
│  │    │                                                             │   │
│  │    └─► Return modified request with resolved content            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  postprocessOutputResources(response, request, schema)          │   │
│  │    │                                                             │   │
│  │    ├─► processResourcesInData(                                  │   │
│  │    │     response,                                              │   │
│  │    │     schema.properties,                                     │   │
│  │    │     async (value, fieldSchema) => {                        │   │
│  │    │       // For each resource field:                          │   │
│  │    │       result = await uploader.uploadResource(value)        │   │
│  │    │       return { fileId: result.fileId }                     │   │
│  │    │     }                                                       │   │
│  │    │   )                                                         │   │
│  │    │                                                             │   │
│  │    └─► Return modified response with fileIds                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Private helper methods:                                        │   │
│  │    - uploadResource()     - Upload any format to DriveService   │   │
│  │    - downloadFromUrl()    - Download external URLs              │   │
│  │    - inferResourceType()  - Detect MIME type and category       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3. Context Management Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│               AsyncLocalStorage Context (Thread-Safe)                   │
│      apps/api/src/modules/tool/core/context/tool-context.ts:91         │
│                                                                         │
│  ToolFactory.func() calls:                                              │
│                                                                         │
│  runInContext({ user, canvasId }, async () => {                        │
│    ┌───────────────────────────────────────────────────────────────┐   │
│    │  Context stored in AsyncLocalStorage:                        │   │
│    │    {                                                          │   │
│    │      user: { id: "user_123", ... },                          │   │
│    │      canvasId: "canvas_456"                                  │   │
│    │    }                                                          │   │
│    └───────────────────────────────────────────────────────────────┘   │
│                                                                         │
│    Any code can now call:                                               │
│    ┌───────────────────────────────────────────────────────────────┐   │
│    │  const user = getCurrentUser()      // No params needed!     │   │
│    │  const canvasId = getCanvasId()     // Context from storage  │   │
│    └───────────────────────────────────────────────────────────────┘   │
│                                                                         │
│    Used by:                                                             │
│    • ResourceResolver.resolveDriveFile()                                │
│    • ResourceUploader.uploadFile()                                      │
│    • DriveService operations                                            │
│    • All resource operations without explicit params                    │
│  })                                                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4. Resource Format Conversion Matrix

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  Input Resource Formats                                 │
│                  (resourceOutputFormat in schema)                       │
│                                                                         │
│  fileId (from DB)                                                       │
│       │                                                                 │
│       ├─► "buffer"   → Node.js Buffer object                           │
│       │                Example: Buffer(0x89, 0x50, 0x4E, 0x47...)      │
│       │                                                                 │
│       ├─► "base64"   → Base64 encoded string                           │
│       │                Example: "iVBORw0KGgoAAAANSUhEUgAA..."          │
│       │                                                                 │
│       ├─► "url"      → Temporary download URL                          │
│       │                Example: "https://storage/files/file_123?..."   │
│       │                                                                 │
│       └─► "text"     → UTF-8 decoded text string                       │
│                       Example: "This is the file content..."           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                 Output Resource Detection                               │
│                 (Automatic detection by ResourceHandler)                │
│                                                                         │
│  API Response Value                                                     │
│       │                                                                 │
│       ├─► Buffer object                                                │
│       │     → Upload directly to DriveService                          │
│       │                                                                 │
│       ├─► Base64 data URL                                              │
│       │     → Parse and decode → Upload                                │
│       │     Example: "data:image/png;base64,iVBORw0KG..."              │
│       │                                                                 │
│       ├─► External URL                                                 │
│       │     → Download → Upload to DriveService                        │
│       │     Example: "https://api.example.com/generated/image.jpg"     │
│       │                                                                 │
│       └─► Local file path                                              │
│             → Read file → Upload                                        │
│             Example: "/tmp/generated-audio.mp3"                         │
│                                                                         │
│  All formats → { fileId: "file_xxx" } in final response                │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow Example

### Complete Example: Image Generation Tool

```
Step 1: User Invokes Tool
──────────────────────────
Input:
{
  "referenceImage": "file_123",
  "prompt": "A beautiful sunset"
}

Schema:
{
  "inputSchema": {
    "properties": {
      "referenceImage": {
        "type": "string",
        "isResource": true,
        "resourceOutputFormat": "base64"
      }
    }
  },
  "responseSchema": {
    "properties": {
      "generatedImage": {
        "type": "string",
        "isResource": true
      }
    }
  }
}

Step 2: Input Preprocessing
────────────────────────────
ResourceHandler detects referenceImage.isResource = true
↓
Extract fileId: "file_123"
↓
DriveService downloads file
↓
Convert to base64 (as specified by resourceOutputFormat)
↓
Replace in request:
{
  "referenceImage": "data:image/png;base64,iVBORw0KGgoAAAA...",
  "prompt": "A beautiful sunset"
}

Step 3: API Call
────────────────
HttpAdapter sends to external API:
POST https://api.image-generator.com/generate
Body: {
  "referenceImage": "data:image/png;base64,iVBORw0KGgoAAAA...",
  "prompt": "A beautiful sunset"
}

Step 4: API Response
────────────────────
{
  "generatedImage": "https://cdn.image-generator.com/result/abc123.png",
  "metadata": { "model": "sdxl-turbo" }
}

Step 5: Output Postprocessing
──────────────────────────────
ResourceHandler detects generatedImage.isResource = true
↓
Detect value type: External URL
↓
Download from https://cdn.image-generator.com/result/abc123.png
↓
Upload to DriveService → fileId: "file_999"
↓
Replace in response:
{
  "generatedImage": { "fileId": "file_999" },
  "metadata": { "model": "sdxl-turbo" }
}

Step 6: Return to Caller
─────────────────────────
Final result:
{
  "generatedImage": { "fileId": "file_999" },
  "metadata": { "model": "sdxl-turbo" }
}
```

## Architecture Principles

### 1. **Separation of Concerns**

```
┌────────────────────────────────────────────────────────────┐
│  ToolFactory          → Orchestration & Context Setup      │
│  ResourceHandler      → Resource Processing Logic          │
│  ResourceResolver     → Input: fileId → content            │
│  ResourceUploader     → Output: content → fileId           │
│  DriveService         → Actual file storage operations     │
│  HttpHandler          → HTTP request/response lifecycle    │
└────────────────────────────────────────────────────────────┘
```

### 2. **Schema-Driven Automation**

```
Developer only needs to:
  1. Mark fields with "isResource": true
  2. Specify "resourceOutputFormat" (for inputs)

Framework automatically:
  1. Detects all resource fields
  2. Resolves fileIds to content
  3. Converts formats
  4. Uploads generated resources
  5. Returns fileId references
```

### 3. **Context Propagation**

```
ToolFactory.func()
  └─► runInContext({ user, canvasId })
        ├─► ResourceHandler (uses context)
        ├─► DriveService (uses context)
        ├─► HttpHandler (uses context)
        └─► All operations have access without explicit params
```

### 4. **Two-Phase Processing**

```
Phase 1: INPUT PREPROCESSING (Before API call)
  fileId → actual content → send to external API

Phase 2: OUTPUT POSTPROCESSING (After API call)
  API response with content → upload → fileId references
```

## File References

### Core Implementation Files

- **Resource Handler**: [apps/api/src/modules/tool/utils/resource.ts](../utils/resource.ts) (1059 lines)
  - `processResourcesInData()` - Schema traversal (lines 142-238)
  - `ResourceHandler` class (lines 788-1058)
  - `createResourceResolver()` (lines 514-622)
  - `createResourceUploader()` (lines 632-779)

- **Tool Factory**: [apps/api/src/modules/tool/core/registry/factory.ts](../core/registry/factory.ts:273)
  - Input preprocessing before handler execution

- **HTTP Handler**: [apps/api/src/modules/tool/handlers/handler.ts](../handlers/handler.ts:124)
  - Request/response lifecycle orchestration

- **Post Handler**: [apps/api/src/modules/tool/handlers/post/base.ts](../handlers/post/base.ts:147)
  - Output postprocessing after API response

- **Context Management**: [apps/api/src/modules/tool/core/context/tool-context.ts](../core/context/tool-context.ts:91)
  - Thread-safe context using AsyncLocalStorage

## Summary

The resource field preprocessing system is a **fully automatic, schema-driven pipeline** that:

1. **Detects** resource fields via `isResource: true` in JSON schemas
2. **Preprocesses** inputs by resolving fileIds to actual content before API calls
3. **Postprocesses** outputs by uploading generated resources and returning fileId references
4. **Handles** multiple formats transparently (Buffer, base64, URL, text)
5. **Uses** context propagation for clean API without explicit parameter passing
6. **Separates** concerns across dedicated components (resolver, uploader, handler)

Developers simply mark fields as resources in their tool schemas, and the framework handles all file operations automatically.
