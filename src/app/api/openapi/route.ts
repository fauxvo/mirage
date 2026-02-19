import { NextResponse } from 'next/server';
import {
  visualizerConfigJsonSchema,
  createSetJsonSchema,
  updateSetJsonSchema,
  createCueJsonSchema,
  updateCueJsonSchema,
} from '@/lib/schemas';

export async function GET() {
  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'Mirage API',
      version: '0.2.0',
      description: 'Real-time 3D music visualizer - set and cue management API',
    },
    paths: {
      '/api/sets': {
        post: {
          summary: 'Create a new set with a default cue',
          security: [{ cookieAuth: [] }],
          requestBody: {
            content: {
              'application/json': {
                schema: createSetJsonSchema,
              },
            },
          },
          responses: {
            '201': { description: 'Set created with default cue' },
            '401': { description: 'Authentication required' },
          },
        },
        get: {
          summary: "List current user's sets",
          security: [{ cookieAuth: [] }],
          responses: {
            '200': { description: "User's sets" },
            '401': { description: 'Authentication required' },
          },
        },
      },
      '/api/sets/{id}': {
        get: {
          summary: 'Get set with all cues (public if is_public)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Set with cues' },
            '404': { description: 'Set not found' },
          },
        },
        put: {
          summary: 'Update set metadata (owner only)',
          security: [{ cookieAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            content: {
              'application/json': {
                schema: updateSetJsonSchema,
              },
            },
          },
          responses: {
            '200': { description: 'Set updated' },
            '403': { description: 'Forbidden' },
            '404': { description: 'Set not found' },
          },
        },
        delete: {
          summary: 'Delete set and all cues (owner only)',
          security: [{ cookieAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Set deleted' },
            '403': { description: 'Forbidden' },
            '404': { description: 'Set not found' },
          },
        },
      },
      '/api/sets/{id}/cues': {
        post: {
          summary: 'Add a cue to a set (owner only)',
          security: [{ cookieAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            content: {
              'application/json': {
                schema: createCueJsonSchema,
              },
            },
          },
          responses: {
            '201': { description: 'Cue created' },
            '403': { description: 'Forbidden' },
            '404': { description: 'Set not found' },
          },
        },
      },
      '/api/sets/{id}/cues/{cueId}': {
        put: {
          summary: 'Update a cue (owner only)',
          security: [{ cookieAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'cueId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          requestBody: {
            content: {
              'application/json': {
                schema: updateCueJsonSchema,
              },
            },
          },
          responses: {
            '200': { description: 'Cue updated' },
            '403': { description: 'Forbidden' },
            '404': { description: 'Cue not found' },
          },
        },
        delete: {
          summary: 'Delete a cue (owner only)',
          security: [{ cookieAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'cueId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'Cue deleted' },
            '403': { description: 'Forbidden' },
            '404': { description: 'Cue not found' },
          },
        },
      },
      '/api/sets/{id}/cues/reorder': {
        put: {
          summary: 'Reorder cues in a set (owner only)',
          security: [{ cookieAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      position: { type: 'integer', minimum: 1 },
                    },
                    required: ['id', 'position'],
                  },
                },
              },
            },
          },
          responses: {
            '200': { description: 'Cues reordered' },
            '403': { description: 'Forbidden' },
            '404': { description: 'Set not found' },
          },
        },
      },
      '/api/upload': {
        post: {
          summary: 'Upload texture image',
          security: [{ cookieAuth: [] }],
          requestBody: {
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: {
                    file: { type: 'string', format: 'binary' },
                  },
                },
              },
            },
          },
          responses: {
            '201': { description: 'Texture uploaded' },
            '501': { description: 'S3 not configured' },
          },
        },
      },
      '/api/health': {
        get: {
          summary: 'Health check',
          responses: {
            '200': { description: 'Service healthy' },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'mirage-session',
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
        },
      },
      schemas: {
        VisualizerConfig: visualizerConfigJsonSchema,
        CreateSet: createSetJsonSchema,
        UpdateSet: updateSetJsonSchema,
        CreateCue: createCueJsonSchema,
        UpdateCue: updateCueJsonSchema,
      },
    },
  };

  return NextResponse.json(spec);
}
