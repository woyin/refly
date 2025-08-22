# Media Generation Parameter Usage Examples

This document shows examples of how to use the newly defined `ModelParameter` schema for media generation.

## Parameter Types

### 1. URL Parameter (Single URL)
```yaml
name: "image_url"
type: "url"
value: "https://example.com/image.jpg"
description: "Source image URL for processing"
required: true
visible: true
```

### 2. URL Parameter (Multiple URLs)
```yaml
name: "reference_images"
type: "url"
value: 
  - "https://example.com/ref1.jpg"
  - "https://example.com/ref2.jpg"
description: "Reference images for style transfer"
required: false
visible: true
```

### 3. Text Parameter
```yaml
name: "prompt"
type: "text"
value: "A beautiful sunset over mountains"
description: "Text prompt for image generation"
required: true
visible: true
```

### 4. Option Parameter (String Options)
```yaml
name: "style"
type: "option"
value: "realistic"
options:
  - "realistic"
  - "artistic"
  - "cartoon"
  - "abstract"
description: "Art style for image generation"
required: true
visible: true
```

### 5. Option Parameter (Numeric Options)
```yaml
name: "quality"
type: "option"
value: 8
options:
  - 1
  - 2
  - 4
  - 8
  - 16
description: "Image quality level"
required: false
visible: true
```

### 6. Option Parameter (Boolean Options)
```yaml
name: "enhance"
type: "option"
value: true
options:
  - true
  - false
description: "Enable image enhancement"
required: false
visible: true
```

## Complete MediaGenerationModelConfig Example

```yaml
MediaGenerationModelConfig:
  modelId: "dall-e-3"
  modelName: "DALL-E 3"
  capabilities:
    image: true
    video: false
    audio: false
  description: "Advanced image generation model"
  supportedLanguages:
    - "en"
    - "zh"
  inputParameters:
    - name: "prompt"
      type: "text"
      value: ""
      description: "Text description of the image to generate"
      required: true
      visible: true
    - name: "size"
      type: "option"
      value: "1024x1024"
      options:
        - "256x256"
        - "512x512"
        - "1024x1024"
        - "1792x1024"
        - "1024x1792"
      description: "Image size"
      required: false
      visible: true
    - name: "style"
      type: "option"
      value: "vivid"
      options:
        - "vivid"
        - "natural"
      description: "Image style"
      required: false
      visible: true
  outputParameters:
    - name: "image_url"
      type: "url"
      value: ""
      description: "Generated image URL"
      required: true
      visible: true
    - name: "revised_prompt"
      type: "text"
      value: ""
      description: "Revised prompt used for generation"
      required: false
      visible: true
```

## TypeScript Usage

After running the code generation, you can use the types like this:

```typescript
import type { ModelParameter } from '@refly/openapi-schema';

const imagePrompt: ModelParameter = {
  name: "prompt",
  type: "text",
  value: "A beautiful landscape",
  description: "Image generation prompt",
  required: true,
  visible: true
};

const imageSize: ModelParameter = {
  name: "size",
  type: "option",
  value: "1024x1024",
  options: ["256x256", "512x512", "1024x1024"],
  description: "Image size",
  required: false,
  visible: true
};
```
