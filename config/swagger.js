// config/swagger.js
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PIC-ME Backend API',
      version: '1.0.0',
      description: 'A comprehensive photography booking platform API that connects clients with professional photographers and videographers.',
      contact: {
        name: 'PIC-ME Support',
        email: 'support@picme.com',
        url: 'https://picme.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? 'https://api.picme.com' 
          : `http://localhost:${process.env.PORT || 5000}`,
        description: process.env.NODE_ENV === 'production' ? 'Production Server' : 'Development Server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '60f7a5c3e8a1a9b3a8e4b123' },
            email: { type: 'string', format: 'email', example: 'john@example.com' },
            firstName: { type: 'string', example: 'John' },
            lastName: { type: 'string', example: 'Doe' },
            userName: { type: 'string', example: 'johndoe' },
            role: { type: 'string', enum: ['client', 'creative', 'admin'], example: 'client' },
            profilePic: { type: 'string', format: 'uri', example: 'https://example.com/profile.jpg' },
            isCompleted: { type: 'boolean', example: true },
            wallet: {
              type: 'object',
              properties: {
                balance: { type: 'number', example: 1500.00 }
              }
            },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        Booking: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '60f8a7b3e9b3c9d8e4b789' },
            client_id: { type: 'string', example: '60f7a5c3e8a1a9b3a8e4b123' },
            creative_id: { type: 'string', example: '60f7a5c3e8a1a9b3a8e4b456' },
            date_time: { type: 'string', format: 'date-time', example: '2025-03-12T14:00:00Z' },
            location: {
              type: 'object',
              properties: {
                type: { type: 'string', example: 'Point' },
                coordinates: { 
                  type: 'array', 
                  items: { type: 'number' },
                  example: [3.3792, 6.5244]
                }
              }
            },
            total_price: { type: 'number', example: 150.00 },
            status: { 
              type: 'string', 
              enum: ['pending', 'confirmed', 'completed', 'cancelled'], 
              example: 'pending' 
            }
          }
        },
        Transaction: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '60f9b8d4f1c4d5e6f7a8b9c0' },
            user: { type: 'string', example: '60f7a5c3e8a1a9b3a8e4b123' },
            type: { 
              type: 'string', 
              enum: ['deposit', 'withdrawal', 'booking', 'payout', 'tip'], 
              example: 'deposit' 
            },
            amount: { type: 'number', example: 1000.00 },
            status: { 
              type: 'string', 
              enum: ['success', 'failed', 'pending'], 
              example: 'success' 
            },
            reference: { type: 'string', example: 'txn_1642780800_abc123' },
            description: { type: 'string', example: 'Wallet deposit via Paystack' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Error message' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string', example: 'email' },
                  message: { type: 'string', example: 'Email is required' }
                }
              }
            }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Operation successful' },
            data: { type: 'object' }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Not authorized, no token' }
                }
              }
            }
          }
        },
        ForbiddenError: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Insufficient permissions' }
                }
              }
            }
          }
        },
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        ServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  message: { type: 'string', example: 'Internal server error' }
                }
              }
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and account management'
      },
      {
        name: 'Users',
        description: 'User profile management'
      },
      {
        name: 'Bookings',
        description: 'Booking management between clients and creatives'
      },
      {
        name: 'Wallet',
        description: 'Wallet and payment management'
      },
      {
        name: 'Creatives',
        description: 'Creative user search and filtering'
      },
      {
        name: 'Products',
        description: 'Portfolio and product management'
      },
      {
        name: 'Messaging',
        description: 'Real-time messaging between users'
      },
      {
        name: 'Notifications',
        description: 'User notifications management'
      }
    ]
  },
  apis: [
    './routes/*.js',
    './controllers/*.js',
    './models/*.js'
  ]
};

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: Register a new user
 *     description: Register a new user with email and password. An OTP will be sent for verification.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: SecurePass123
 *               referralCode:
 *                 type: string
 *                 example: REFER123
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: OTP sent to email. Please verify to complete registration.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: User login
 *     description: Authenticate user with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 example: SecurePass123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Profile incomplete
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */

const specs = swaggerJsdoc(options);

const swaggerOptions = {
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info hgroup.main h2 { color: #ff6600; }
    .swagger-ui .scheme-container { background: #f8f9fa; }
  `,
  customSiteTitle: "PIC-ME API Documentation",
  customfavIcon: "/favicon.ico",
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'none',
    filter: true,
    showExtensions: true,
    tryItOutEnabled: true
  }
};

module.exports = {
  specs,
  swaggerUi,
  swaggerOptions
};
