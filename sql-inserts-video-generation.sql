-- ============================================================================
-- Video Generation APIs - Tool Methods Insert Statements
-- Generated with async polling support
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. HeyGen - Create Avatar Video V2
-- ----------------------------------------------------------------------------
INSERT INTO tool_methods (
  inventory_key,
  version_id,
  name,
  description,
  endpoint,
  http_method,
  request_schema,
  response_schema,
  adapter_type,
  adapter_config,
  enabled
) VALUES (
  'heygen',
  1,
  'create_avatar_video_v2',
  'Generate AI avatar videos with automatic polling and download',
  'https://api.heygen.com/v2/video/generate',
  'POST',
  -- Request Schema
  '{
    "type": "object",
    "required": ["video_inputs"],
    "properties": {
      "caption": {
        "type": "boolean",
        "description": "Enable captions in the video",
        "default": false
      },
      "title": {
        "type": "string",
        "description": "Title of this video"
      },
      "callback_id": {
        "type": "string",
        "description": "Custom ID for callback purposes"
      },
      "video_inputs": {
        "type": "array",
        "description": "Array of video input settings (scenes). Must contain between 1 to 50 items",
        "minItems": 1,
        "maxItems": 50,
        "items": {
          "type": "object",
          "properties": {
            "character": {
              "type": "object",
              "required": ["type"],
              "properties": {
                "type": {
                  "type": "string",
                  "enum": ["avatar", "talking_photo"],
                  "default": "avatar",
                  "description": "Could be either avatar or talking_photo"
                },
                "avatar_id": {
                  "type": "string",
                  "description": "Unique identifier of the avatar (required for avatar type)"
                },
                "talking_photo_id": {
                  "type": "string",
                  "description": "Unique identifier of the talking photo (required for talking_photo type)"
                },
                "scale": {
                  "type": "number",
                  "minimum": 0.0,
                  "maximum": 5.0,
                  "default": 1.0,
                  "description": "Adjusts the size of the avatar or talking photo"
                },
                "avatar_style": {
                  "type": "string",
                  "enum": ["circle", "closeUp", "normal"],
                  "default": "normal",
                  "description": "Visual style of the avatar"
                },
                "offset": {
                  "type": "object",
                  "description": "Position adjustment",
                  "properties": {
                    "x": {"type": "number"},
                    "y": {"type": "number"}
                  }
                }
              }
            },
            "voice": {
              "type": "object",
              "required": ["type"],
              "properties": {
                "type": {
                  "type": "string",
                  "enum": ["text", "audio", "silence"],
                  "description": "Format of the voice input"
                },
                "voice_id": {
                  "type": "string",
                  "description": "Voice ID (for text type)"
                },
                "input_text": {
                  "type": "string",
                  "description": "Text to speak (for text type)"
                },
                "speed": {
                  "type": "number",
                  "minimum": 0.5,
                  "maximum": 1.5,
                  "default": 1.0,
                  "description": "Voice speed"
                },
                "audio_url": {
                  "type": "string",
                  "description": "Audio URL (for audio type)"
                }
              }
            },
            "background": {
              "type": "object",
              "properties": {
                "type": {
                  "type": "string",
                  "enum": ["color", "image", "video"]
                },
                "value": {
                  "type": "string",
                  "default": "#FFFFFF"
                },
                "url": {
                  "type": "string"
                }
              }
            }
          }
        }
      }
    }
  }',
  -- Response Schema
  '{
    "type": "object",
    "properties": {
      "videoId": {
        "type": "string",
        "description": "Unique identifier of the generated video"
      },
      "status": {
        "type": "string",
        "description": "Final status (completed)"
      },
      "videoUrl": {
        "type": "string",
        "description": "Video download URL"
      },
      "thumbnailUrl": {
        "type": "string",
        "description": "Thumbnail URL"
      },
      "duration": {
        "type": "number",
        "description": "Video duration in seconds"
      },
      "buffer": {
        "type": "object",
        "description": "Downloaded video buffer (internal)"
      },
      "filename": {
        "type": "string",
        "description": "Generated filename"
      },
      "mimetype": {
        "type": "string",
        "description": "MIME type"
      }
    }
  }',
  'http',
  -- Adapter Config with Polling
  '{
    "headers": {
      "X-Api-Key": "${HEYGEN_API_KEY}",
      "Content-Type": "application/json"
    },
    "timeout": 30000,
    "polling": {
      "statusUrl": "/v1/video_status.get?video_id={id}",
      "maxWaitSeconds": 600,
      "intervalSeconds": 5
    }
  }',
  true
);

-- ----------------------------------------------------------------------------
-- 2. FAL.ai - Video Generation
-- ----------------------------------------------------------------------------
INSERT INTO tool_methods (
  inventory_key,
  version_id,
  name,
  description,
  endpoint,
  http_method,
  request_schema,
  response_schema,
  adapter_type,
  adapter_config,
  enabled
) VALUES (
  'fal_ai',
  1,
  'generate_video',
  'Generate videos using FAL.ai with automatic polling',
  'https://queue.fal.run/fal-ai/fast-animatediff/text-to-video',
  'POST',
  -- Request Schema
  '{
    "type": "object",
    "required": ["prompt"],
    "properties": {
      "prompt": {
        "type": "string",
        "description": "Text description of the video to generate"
      },
      "num_frames": {
        "type": "integer",
        "description": "Number of frames",
        "default": 16
      },
      "fps": {
        "type": "integer",
        "description": "Frames per second",
        "default": 8
      }
    }
  }',
  -- Response Schema
  '{
    "type": "object",
    "properties": {
      "video": {
        "type": "object",
        "properties": {
          "url": {
            "type": "string",
            "description": "Video URL"
          }
        }
      },
      "buffer": {
        "type": "object"
      },
      "filename": {
        "type": "string"
      }
    }
  }',
  'http',
  -- Adapter Config
  '{
    "headers": {
      "Authorization": "Key ${FAL_API_KEY}",
      "Content-Type": "application/json"
    },
    "timeout": 30000,
    "polling": {
      "statusUrl": "/requests/{id}/status",
      "maxWaitSeconds": 600,
      "intervalSeconds": 3
    }
  }',
  true
);

-- ----------------------------------------------------------------------------
-- 3. Runway ML - Video Generation
-- ----------------------------------------------------------------------------
INSERT INTO tool_methods (
  inventory_key,
  version_id,
  name,
  description,
  endpoint,
  http_method,
  request_schema,
  response_schema,
  adapter_type,
  adapter_config,
  enabled
) VALUES (
  'runway_ml',
  1,
  'generate_video',
  'Generate videos using Runway ML Gen-3 with automatic polling',
  'https://api.dev.runwayml.com/v1/generate',
  'POST',
  -- Request Schema
  '{
    "type": "object",
    "required": ["prompt"],
    "properties": {
      "prompt": {
        "type": "string",
        "description": "Text prompt for video generation"
      },
      "duration": {
        "type": "integer",
        "description": "Video duration in seconds",
        "default": 5
      },
      "aspect_ratio": {
        "type": "string",
        "enum": ["16:9", "9:16", "1:1"],
        "default": "16:9"
      }
    }
  }',
  -- Response Schema
  '{
    "type": "object",
    "properties": {
      "id": {
        "type": "string"
      },
      "output": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "buffer": {
        "type": "object"
      },
      "filename": {
        "type": "string"
      }
    }
  }',
  'http',
  -- Adapter Config
  '{
    "headers": {
      "Authorization": "Bearer ${RUNWAY_API_KEY}",
      "Content-Type": "application/json"
    },
    "timeout": 30000,
    "polling": {
      "statusUrl": "/v1/tasks/{id}",
      "maxWaitSeconds": 900,
      "intervalSeconds": 5
    }
  }',
  true
);

-- ----------------------------------------------------------------------------
-- 4. Replicate - Video Generation
-- ----------------------------------------------------------------------------
INSERT INTO tool_methods (
  inventory_key,
  version_id,
  name,
  description,
  endpoint,
  http_method,
  request_schema,
  response_schema,
  adapter_type,
  adapter_config,
  enabled
) VALUES (
  'replicate',
  1,
  'create_prediction',
  'Create a prediction on Replicate with automatic polling',
  'https://api.replicate.com/v1/predictions',
  'POST',
  -- Request Schema
  '{
    "type": "object",
    "required": ["version", "input"],
    "properties": {
      "version": {
        "type": "string",
        "description": "Model version ID"
      },
      "input": {
        "type": "object",
        "description": "Model input parameters"
      }
    }
  }',
  -- Response Schema
  '{
    "type": "object",
    "properties": {
      "id": {
        "type": "string"
      },
      "status": {
        "type": "string"
      },
      "output": {
        "description": "Model output (can be string, array, or object)"
      },
      "buffer": {
        "type": "object"
      },
      "filename": {
        "type": "string"
      }
    }
  }',
  'http',
  -- Adapter Config
  '{
    "headers": {
      "Authorization": "Token ${REPLICATE_API_TOKEN}",
      "Content-Type": "application/json"
    },
    "timeout": 30000,
    "polling": {
      "statusUrl": "/v1/predictions/{id}",
      "maxWaitSeconds": 600,
      "intervalSeconds": 2
    }
  }',
  true
);

-- ============================================================================
-- Notes:
-- 1. Replace ${API_KEY} placeholders with actual environment variable names
-- 2. Adjust inventory_key to match your ToolsetInventory records
-- 3. Polling configuration is minimal - uses intelligent auto-detection
-- 4. All APIs will automatically download generated files
-- ============================================================================
