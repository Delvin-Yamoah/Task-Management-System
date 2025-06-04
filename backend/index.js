const express = require('express');
const cors = require('cors');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const app = express();
const port = process.env.PORT || 3000;

// Configure AWS SDK
const region = process.env.AWS_REGION || 'eu-west-1';
AWS.config.update({ region });

// Initialize AWS services
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const ses = new AWS.SES();

// Environment variables
const TASKS_TABLE = process.env.TASKS_TABLE || 'Tasks';
const FRONTEND_URL = process.env.FRONTEND_URL || '*';

// Basic middleware
app.use(express.json());
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));

// Import task handlers
const { createTask, getTasks, updateTask } = require('./tasks');

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('Health check endpoint called');
  res.status(200).json({ 
    status: 'healthy',
    region: region,
    tasksTable: TASKS_TABLE,
    frontendUrl: FRONTEND_URL
  });
});

// Root endpoint
app.get('/', (req, res) => {
  console.log('Root endpoint called');
  res.status(200).json({ message: 'Task Management API is running' });
});

// Simplified authentication middleware for testing
const authenticate = (req, res, next) => {
  // For testing purposes, we'll use a simple token check
  const authHeader = req.headers.authorization;
  
  // During development/testing, allow requests without auth
  if (!authHeader) {
    console.log('No authorization header, proceeding with default user');
    req.user = {
      email: 'admin@example.com',
      groups: ['Admins']
    };
    return next();
  }
  
  // In a real app, we would verify the token here
  req.user = {
    email: 'admin@example.com',
    groups: ['Admins']
  };
  next();
};

// Tasks endpoints with authentication
app.post('/tasks', authenticate, async (req, res) => {
  try {
    // Mock the event structure expected by the Lambda handler
    const event = {
      body: JSON.stringify(req.body),
      requestContext: {
        authorizer: {
          claims: {
            'email': req.user.email,
            'cognito:groups': req.user.groups
          }
        }
      }
    };
    
    const result = await createTask(event);
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (error) {
    console.error('Error in /tasks POST endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/tasks', authenticate, async (req, res) => {
  try {
    // Mock the event structure expected by the Lambda handler
    const event = {
      requestContext: {
        authorizer: {
          claims: {
            'email': req.user.email,
            'cognito:groups': req.user.groups
          }
        }
      }
    };
    
    const result = await getTasks(event);
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (error) {
    console.error('Error in /tasks GET endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/tasks/:taskId', authenticate, async (req, res) => {
  try {
    // Mock the event structure expected by the Lambda handler
    const event = {
      pathParameters: {
        taskId: req.params.taskId
      },
      body: JSON.stringify(req.body),
      requestContext: {
        authorizer: {
          claims: {
            'email': req.user.email,
            'cognito:groups': req.user.groups
          }
        }
      }
    };
    
    const result = await updateTask(event);
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (error) {
    console.error('Error in /tasks/:taskId PUT endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start the server
const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Environment variables:`);
  console.log(`PORT: ${process.env.PORT}`);
  console.log(`AWS_REGION: ${process.env.AWS_REGION}`);
  console.log(`TASKS_TABLE: ${process.env.TASKS_TABLE}`);
  console.log(`FRONTEND_URL: ${process.env.FRONTEND_URL}`);
});

// Handle process termination
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

module.exports = app;