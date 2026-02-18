import { NextResponse } from 'next/server';
import {
  visualizerConfigJsonSchema,
  createSessionJsonSchema,
  updateSessionJsonSchema,
} from '@/lib/schemas';

export async function GET() {
  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'Mirage API',
      version: '0.1.0',
      description: 'Real-time 3D music visualizer - session management API',
    },
    paths: {
      '/api/sessions': {
        post: {
          summary: 'Create a new visualizer session',
          security: [{ apiKey: [] }],
          requestBody: {
            content: {
              'application/json': {
                schema: createSessionJsonSchema,
              },
            },
          },
          responses: {
            '201': {
              description: 'Session created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          sessionId: { type: 'string' },
                          adminToken: { type: 'string' },
                          url: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/sessions/{id}': {
        get: {
          summary: 'Get session details (public)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Session details' },
            '404': { description: 'Session not found' },
          },
        },
        put: {
          summary: 'Update session (admin token required)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            content: {
              'application/json': {
                schema: updateSessionJsonSchema,
              },
            },
          },
          responses: {
            '200': { description: 'Session updated' },
            '403': { description: 'Invalid admin token' },
            '404': { description: 'Session not found' },
          },
        },
        delete: {
          summary: 'Delete session (admin token required)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': { description: 'Session deleted' },
            '403': { description: 'Invalid admin token' },
            '404': { description: 'Session not found' },
          },
        },
      },
      '/api/upload': {
        post: {
          summary: 'Upload texture image',
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
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
        },
      },
      schemas: {
        VisualizerConfig: visualizerConfigJsonSchema,
        CreateSession: createSessionJsonSchema,
        UpdateSession: updateSessionJsonSchema,
      },
    },
  };

  return NextResponse.json(spec);
}
